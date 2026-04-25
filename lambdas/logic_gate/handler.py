import json
import os
import urllib.parse
from decimal import Decimal

import boto3

s3 = boto3.client("s3")

BUCKET = os.environ["DATA_BUCKET_NAME"]
TABLE_NAME = os.environ["AUDIT_TABLE_NAME"]

import sys
sys.path.insert(0, "/opt/python")
from models import AuditResult, AuditStatus
from dynamo import put_audit, get_audit, list_audits


def lambda_handler(event, context):
    try:
        http_method = event.get("httpMethod")
        resource = event.get("resource", "")

        if http_method == "GET" and resource == "/audits":
            return _handle_list_audits()

        if http_method == "GET" and "auditId" in (event.get("pathParameters") or {}):
            return _handle_get_audit(event["pathParameters"]["auditId"])

        if _is_s3_event(event):
            return _handle_analysis_output(event)

        return _response(400, {"error": "Unsupported request"})
    except Exception as exc:
        import traceback
        traceback.print_exc()
        return _response(500, {"error": str(exc)})


def _is_s3_event(event: dict) -> bool:
    return "Records" in event and event["Records"][0].get("eventSource") == "aws:s3"


def _handle_analysis_output(event: dict):
    record = event["Records"][0]["s3"]
    bucket = record["bucket"]["name"]
    key = urllib.parse.unquote_plus(record["object"]["key"])

    # key format: output/{audit_id}/analysis.json
    parts = key.split("/")
    audit_id = parts[1] if len(parts) >= 3 else None
    if not audit_id:
        print(f"Could not extract audit_id from key: {key}")
        return

    obj = s3.get_object(Bucket=bucket, Key=key)
    analysis_output = json.loads(obj["Body"].read().decode("utf-8"))

    existing = get_audit(audit_id)
    facet_column = existing.get("facet_column", "unknown") if existing else "unknown"
    outcome_column = existing.get("outcome_column", "unknown") if existing else "unknown"
    filename = existing.get("filename") if existing else None

    result = _evaluate_bias(audit_id, analysis_output, facet_column, outcome_column)
    result.filename = filename
    result.facet_column = facet_column
    result.outcome_column = outcome_column

    put_audit(result.to_dynamo())

    print(f"Audit {audit_id}: status={result.status.value}, "
          f"impact_ratio={result.impact_ratio}, "
          f"liability=${result.legal_liability_debt:,.2f}")


def _evaluate_bias(
    audit_id: str,
    analysis_output: dict,
    facet_column: str,
    outcome_column: str,
) -> AuditResult:
    pre_training = analysis_output.get("pre_training_bias_metrics", {})
    facets = pre_training.get("facets", {})

    selection_rates = {}

    direct_rates = analysis_output.get("selection_rates")
    if direct_rates and isinstance(direct_rates, dict):
        selection_rates = {k: float(v) for k, v in direct_rates.items()}
    else:
        for facet_name, facet_data in facets.items():
            for value_data in facet_data:
                value = value_data.get("value_or_threshold", "unknown")
                group_stats = value_data.get("group_stats", {})
                if "selection_rate" in group_stats:
                    selection_rates[value] = group_stats["selection_rate"]
                else:
                    metrics = value_data.get("metrics", [])
                    for m in metrics:
                        if m.get("name") == "DPL":
                            selection_rates[value] = 0.5 + m.get("value", 0)

    if not selection_rates:
        selection_rates = _extract_selection_rates_fallback(analysis_output)

    if len(selection_rates) < 2:
        return AuditResult(
            audit_id=audit_id,
            status=AuditStatus.PASSED,
            impact_ratio=1.0,
            legal_liability_debt=0.0,
            reason="Insufficient group data for disparate impact analysis",
        )

    max_rate = max(selection_rates.values())
    min_rate = min(selection_rates.values())

    if max_rate == 0:
        impact_ratio = 1.0
    else:
        impact_ratio = min_rate / max_rate

    proxy_warnings = _detect_proxy_bias(analysis_output, facet_column)

    # 4/5ths Rule
    if impact_ratio < 0.8:
        liability_debt = (1.0 - impact_ratio) * 1_000_000
        return AuditResult(
            audit_id=audit_id,
            status=AuditStatus.BLOCKED,
            impact_ratio=round(impact_ratio, 4),
            legal_liability_debt=round(liability_debt, 2),
            facet_column=facet_column,
            outcome_column=outcome_column,
            proxy_warnings=proxy_warnings,
            reason=f"Disparate Impact detected. Impact Ratio: {impact_ratio:.4f} (threshold: 0.80)",
            action_required="Initiate Socratic Scaffolding Workshop",
        )

    return AuditResult(
        audit_id=audit_id,
        status=AuditStatus.PASSED,
        impact_ratio=round(impact_ratio, 4),
        legal_liability_debt=0.0,
        facet_column=facet_column,
        outcome_column=outcome_column,
        proxy_warnings=proxy_warnings,
        reason=f"No disparate impact. Impact Ratio: {impact_ratio:.4f}",
    )


def _extract_selection_rates_fallback(analysis_output: dict) -> dict:
    rates = {}
    for key, value in analysis_output.items():
        if "selection_rate" in key.lower() and isinstance(value, (int, float)):
            rates[key] = value
    return rates


def _detect_proxy_bias(analysis_output: dict, facet_column: str) -> list[dict]:
    warnings = []
    proxy_candidates = {
        "zip_code": "geographic/racial segregation",
        "zipcode": "geographic/racial segregation",
        "postal_code": "geographic/racial segregation",
        "neighborhood": "geographic/racial segregation",
        "years_experience": "potential age proxy",
        "years_of_experience": "potential age proxy",
        "college": "potential socioeconomic proxy",
        "university": "potential socioeconomic proxy",
        "name": "potential racial/ethnic proxy",
        "first_name": "potential racial/ethnic proxy",
        "last_name": "potential racial/ethnic proxy",
    }

    features = analysis_output.get("features", [])
    if isinstance(features, list):
        for f in features:
            fname = f if isinstance(f, str) else f.get("name", "")
            normalized = fname.lower().replace(" ", "_")
            if normalized in proxy_candidates:
                warnings.append({
                    "feature": fname,
                    "protected_attribute": facet_column,
                    "correlation": 0.0,
                    "description": f"'{fname}' may serve as a proxy for protected attributes "
                                   f"({proxy_candidates[normalized]})",
                })

    return warnings


def _handle_get_audit(audit_id: str):
    item = get_audit(audit_id)
    if not item:
        return _response(404, {"error": f"Audit {audit_id} not found"})

    result = AuditResult.from_dynamo(item)
    return _response(200, {
        "audit_id": result.audit_id,
        "status": result.status.value,
        "impact_ratio": result.impact_ratio,
        "legal_liability_debt": f"${result.legal_liability_debt:,.2f}",
        "legal_liability_debt_raw": result.legal_liability_debt,
        "proxy_warnings": result.proxy_warnings,
        "facet_column": result.facet_column,
        "outcome_column": result.outcome_column,
        "filename": result.filename,
        "reason": result.reason,
        "action_required": result.action_required,
        "created_at": result.created_at,
    })


def _handle_list_audits():
    items = list_audits()
    audits = []
    for item in items:
        r = AuditResult.from_dynamo(item)
        audits.append({
            "audit_id": r.audit_id,
            "status": r.status.value,
            "impact_ratio": r.impact_ratio,
            "legal_liability_debt": f"${r.legal_liability_debt:,.2f}",
            "filename": r.filename,
            "created_at": r.created_at,
        })
    return _response(200, {"audits": audits})


class _DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        return super().default(o)


def _response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
        },
        "body": json.dumps(body, cls=_DecimalEncoder),
    }

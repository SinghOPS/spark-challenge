import json
import csv
import os
import uuid
import base64
import io
from collections import defaultdict

import boto3

s3 = boto3.client("s3")

BUCKET = os.environ["DATA_BUCKET_NAME"]

import sys
sys.path.insert(0, "/opt/python")
from models import AuditResult, AuditStatus
from dynamo import put_audit


def lambda_handler(event, context):
    try:
        return _handle(event, context)
    except Exception as exc:
        import traceback
        traceback.print_exc()
        return _response(500, {"error": str(exc)})


def _handle(event, context):
    try:
        body = json.loads(event.get("body", "{}"))
    except (json.JSONDecodeError, TypeError):
        return _response(400, {"error": "Invalid JSON body"})

    csv_data_b64 = body.get("csv_data")
    facet_column = body.get("facet_column")
    outcome_column = body.get("outcome_column")
    filename = body.get("filename", "upload.csv")

    if not csv_data_b64 or not facet_column or not outcome_column:
        return _response(400, {
            "error": "csv_data (base64), facet_column, and outcome_column are required"
        })

    audit_id = str(uuid.uuid4())
    csv_bytes = base64.b64decode(csv_data_b64)
    rows = _parse_csv(csv_bytes, facet_column, outcome_column)

    clean_csv = _normalize_csv(rows)
    s3_key = f"uploads/{audit_id}/data.csv"
    s3.put_object(Bucket=BUCKET, Key=s3_key, Body=clean_csv.encode("utf-8"))

    audit = AuditResult(
        audit_id=audit_id,
        status=AuditStatus.PROCESSING,
        facet_column=facet_column,
        outcome_column=outcome_column,
        filename=filename,
    )
    put_audit(audit.to_dynamo())

    # Bias analysis in Lambda (industry-standard disparate impact / 4/5ths flow)
    print(f"[{audit_id}] Using in-Lambda bias engine")
    analysis = _run_bias_analysis(rows, facet_column, outcome_column)

    output_key = f"output/{audit_id}/analysis.json"
    s3.put_object(
        Bucket=BUCKET,
        Key=output_key,
        Body=json.dumps(analysis),
    )

    return _response(200, {
        "audit_id": audit_id,
        "status": "PROCESSING",
        "engine": "lambda_builtin",
        "message": "Bias audit started. Results will be available shortly.",
    })


def _parse_csv(csv_bytes: bytes, facet_col: str, outcome_col: str) -> list[dict]:
    text = csv_bytes.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    headers = reader.fieldnames or []
    missing = []
    if facet_col not in headers:
        missing.append(facet_col)
    if outcome_col not in headers:
        missing.append(outcome_col)
    if missing:
        raise ValueError(f"Missing columns: {missing}. Available: {headers}")
    return list(reader)


def _normalize_csv(rows: list[dict]) -> str:
    """Re-serialize parsed rows into a clean CSV for durable audit storage."""
    if not rows:
        return ""
    headers = list(rows[0].keys())
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=headers, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue()


def _run_bias_analysis(
    rows: list[dict],
    facet_col: str,
    outcome_col: str,
) -> dict:
    """Compute pre-training bias metrics for disparate impact analysis."""

    group_stats = defaultdict(lambda: {"total": 0, "positive": 0})
    all_features = set()

    for row in rows:
        group = row.get(facet_col, "unknown")
        try:
            outcome = int(float(row.get(outcome_col, 0)))
        except (ValueError, TypeError):
            outcome = 0

        group_stats[group]["total"] += 1
        group_stats[group]["positive"] += outcome
        all_features.update(row.keys())

    selection_rates = {}
    for group, stats in group_stats.items():
        rate = stats["positive"] / stats["total"] if stats["total"] > 0 else 0
        selection_rates[group] = rate

    max_rate = max(selection_rates.values()) if selection_rates else 0

    facets = {}
    for group, rate in selection_rates.items():
        dpl = rate - max_rate
        facets[facet_col] = facets.get(facet_col, [])
        facets[facet_col].append({
            "value_or_threshold": group,
            "metrics": [
                {"name": "DPL", "value": dpl},
                {"name": "CI", "value": (group_stats[group]["total"] / len(rows)) - (1 / len(group_stats)) if len(group_stats) > 0 else 0},
            ],
            "group_stats": {
                "total": group_stats[group]["total"],
                "positive": group_stats[group]["positive"],
                "selection_rate": rate,
            },
        })

    return {
        "pre_training_bias_metrics": {
            "facets": facets,
            "label": outcome_col,
        },
        "features": list(all_features - {facet_col, outcome_col}),
        "selection_rates": selection_rates,
    }


def _response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
        },
        "body": json.dumps(body),
    }

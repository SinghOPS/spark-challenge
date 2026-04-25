import json
import os

import boto3

bedrock = boto3.client("bedrock-runtime")

TABLE_NAME = os.environ["AUDIT_TABLE_NAME"]
MODEL_ID = os.environ.get("MODEL_ARN", "global.anthropic.claude-sonnet-4-6")

import sys
sys.path.insert(0, "/opt/python")
from dynamo import get_audit, append_chat_message, get_chat_history
from models import AuditResult

SYSTEM_PROMPT = """You are Guardian's Socratic Ethics Tutor.

Your responses must be concise, consistent, and actionable.

Output format (always use these exact section headers):
## What the audit says
- 1-2 bullets with concrete values from the audit (impact ratio, threshold, key column names).

## Likely causes
- 2-3 short bullets tied to specific proxy features or data issues.

## Next checks
1. Provide 2-3 concrete checks the user can run now (data slice, metric, or ablation test).
2. Keep each check specific and implementation-oriented.

## Question
- End with exactly one short Socratic question.

Rules:
- Keep total response under 180 words.
- No markdown tables.
- No long narratives, no repeated headings, no filler.
- Use simple markdown bullets and numbered items only.
- If context is missing, ask for one missing detail in the Question section.
"""


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

    audit_id = body.get("audit_id")
    user_message = body.get("message")

    if not audit_id or not user_message:
        return _response(400, {"error": "audit_id and message are required"})

    audit_item = get_audit(audit_id)
    if not audit_item:
        return _response(404, {"error": f"Audit {audit_id} not found"})

    audit = AuditResult.from_dynamo(audit_item)

    audit_context = _build_audit_context(audit)

    append_chat_message(audit_id, "user", user_message)

    history = get_chat_history(audit_id)

    messages = []
    for msg in history:
        messages.append({"role": msg["role"], "content": [{"text": msg["content"]}]})

    system_text = f"{SYSTEM_PROMPT}\n\n--- AUDIT CONTEXT ---\n{audit_context}"

    response = bedrock.converse(
        modelId=MODEL_ID,
        system=[{"text": system_text}],
        messages=messages,
        inferenceConfig={"maxTokens": 320, "temperature": 0.2},
    )

    assistant_text = response["output"]["message"]["content"][0]["text"]

    append_chat_message(audit_id, "assistant", assistant_text)

    return _response(200, {
        "audit_id": audit_id,
        "response": assistant_text,
        "conversation_length": len(messages) + 1,
    })


def _build_audit_context(audit: AuditResult) -> str:
    lines = [
        f"Audit ID: {audit.audit_id}",
        f"Status: {audit.status.value}",
        f"Protected Attribute Column: {audit.facet_column or 'N/A'}",
        f"Outcome Column: {audit.outcome_column or 'N/A'}",
        f"Impact Ratio: {audit.impact_ratio if audit.impact_ratio is not None else 'N/A'}",
        f"Legal Liability Debt: ${audit.legal_liability_debt:,.2f}",
        f"Reason: {audit.reason or 'N/A'}",
    ]

    if audit.proxy_warnings:
        lines.append("\nDetected Proxy Warnings:")
        for pw in audit.proxy_warnings:
            lines.append(f"  - Feature '{pw.get('feature', '?')}': {pw.get('description', '')}")

    return "\n".join(lines)


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

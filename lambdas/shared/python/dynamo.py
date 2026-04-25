from __future__ import annotations

import os
import json
from datetime import datetime, timezone
from typing import Optional

import boto3
from boto3.dynamodb.conditions import Key

TABLE_NAME = os.environ.get("AUDIT_TABLE_NAME", "GuardianAuditLogs")

_table = None


def _get_table():
    global _table
    if _table is None:
        dynamodb = boto3.resource("dynamodb")
        _table = dynamodb.Table(TABLE_NAME)
    return _table


def put_audit(item: dict) -> None:
    _get_table().put_item(Item=item)


def get_audit(audit_id: str) -> Optional[dict]:
    resp = _get_table().get_item(
        Key={"PK": f"AUDIT#{audit_id}", "SK": "META"}
    )
    return resp.get("Item")


def list_audits(limit: int = 50) -> list[dict]:
    resp = _get_table().scan(
        FilterExpression=Key("SK").eq("META"),
        Limit=limit,
    )
    items = resp.get("Items", [])
    items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return items


def append_chat_message(audit_id: str, role: str, content: str) -> str:
    ts = datetime.now(timezone.utc).isoformat()
    _get_table().put_item(
        Item={
            "PK": f"AUDIT#{audit_id}",
            "SK": f"CHAT#{ts}",
            "role": role,
            "content": content,
            "timestamp": ts,
        }
    )
    return ts


def get_chat_history(audit_id: str) -> list[dict]:
    resp = _get_table().query(
        KeyConditionExpression=Key("PK").eq(f"AUDIT#{audit_id}")
        & Key("SK").begins_with("CHAT#"),
        ScanIndexForward=True,
    )
    return [
        {"role": item["role"], "content": item["content"]}
        for item in resp.get("Items", [])
    ]

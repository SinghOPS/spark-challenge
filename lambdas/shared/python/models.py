from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Optional


class AuditStatus(str, Enum):
    PROCESSING = "PROCESSING"
    PASSED = "PASSED"
    BLOCKED = "BLOCKED"
    ERROR = "ERROR"


@dataclass
class AuditRequest:
    facet_column: str
    outcome_column: str
    filename: str
    audit_id: str = field(default_factory=lambda: str(uuid.uuid4()))


@dataclass
class ProxyWarning:
    feature: str
    protected_attribute: str
    correlation: float
    description: str


@dataclass
class AuditResult:
    audit_id: str
    status: AuditStatus
    impact_ratio: Optional[float] = None
    legal_liability_debt: float = 0.0
    proxy_warnings: list[dict] = field(default_factory=list)
    facet_column: Optional[str] = None
    outcome_column: Optional[str] = None
    filename: Optional[str] = None
    reason: Optional[str] = None
    action_required: Optional[str] = None
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def to_dynamo(self) -> dict:
        item = {
            "PK": f"AUDIT#{self.audit_id}",
            "SK": "META",
            "audit_id": self.audit_id,
            "status": self.status.value,
            "impact_ratio": str(self.impact_ratio) if self.impact_ratio is not None else None,
            "legal_liability_debt": str(self.legal_liability_debt),
            "proxy_warnings": _sanitize_floats(self.proxy_warnings),
            "facet_column": self.facet_column,
            "outcome_column": self.outcome_column,
            "filename": self.filename,
            "reason": self.reason,
            "action_required": self.action_required,
            "created_at": self.created_at,
        }
        return {k: v for k, v in item.items() if v is not None}

    @classmethod
    def from_dynamo(cls, item: dict) -> AuditResult:
        return cls(
            audit_id=item["audit_id"],
            status=AuditStatus(item["status"]),
            impact_ratio=float(item["impact_ratio"]) if item.get("impact_ratio") else None,
            legal_liability_debt=float(item.get("legal_liability_debt", 0)),
            proxy_warnings=item.get("proxy_warnings", []),
            facet_column=item.get("facet_column"),
            outcome_column=item.get("outcome_column"),
            filename=item.get("filename"),
            reason=item.get("reason"),
            action_required=item.get("action_required"),
            created_at=item.get("created_at", ""),
        )


@dataclass
class ChatMessage:
    role: str  # "user" or "assistant"
    content: str
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


def _sanitize_floats(obj):
    """Convert Python floats to Decimal for DynamoDB compatibility."""
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: _sanitize_floats(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize_floats(i) for i in obj]
    return obj

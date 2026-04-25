"use client";

import { type AuditDetail } from "@/lib/api";
import ImpactGauge from "./impact-gauge";

interface AuditResultProps {
  audit: AuditDetail;
  onStartWorkshop: () => void;
}

export default function AuditResult({ audit, onStartWorkshop }: AuditResultProps) {
  const isBlocked = audit.status === "BLOCKED";
  const isPassed = audit.status === "PASSED";
  const isProcessing = audit.status === "PROCESSING";

  return (
    <div className="space-y-6">
      {/* Status badge */}
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex rounded-full px-4 py-1.5 text-sm font-bold ${
            isBlocked
              ? "bg-[var(--color-danger-muted)] text-[var(--color-danger)]"
              : isPassed
                ? "bg-[var(--color-success-muted)] text-[var(--color-success)]"
                : "bg-[var(--color-border)] text-[var(--color-text-muted)]"
          }`}
        >
          {audit.status}
        </span>
        {audit.filename && (
          <span className="text-sm text-[var(--color-text-muted)]">
            {audit.filename}
          </span>
        )}
      </div>

      {isProcessing && (
        <div className="flex flex-col items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-10">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-border)] border-t-[var(--color-accent)]" />
          <p className="mt-4 text-[var(--color-text-muted)]">
            Running bias analysis on the governance engine...
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            This typically completes within a few seconds
          </p>
        </div>
      )}

      {!isProcessing && audit.impact_ratio !== null && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Impact Gauge */}
          <div className="flex items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <ImpactGauge ratio={audit.impact_ratio} />
          </div>

          {/* Legal Liability */}
          <div className="flex flex-col justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <p className="text-sm font-medium text-[var(--color-text-muted)]">
              Legal Liability Debt
            </p>
            <p
              className={`mt-2 break-words text-3xl font-bold leading-tight sm:text-4xl ${
                audit.legal_liability_debt_raw > 0
                  ? "text-[var(--color-danger)]"
                  : "text-[var(--color-success)]"
              }`}
            >
              {audit.legal_liability_debt}
            </p>
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              Estimated exposure based on EEOC/GDPR fine scaling
            </p>
          </div>
        </div>
      )}

      {audit.reason && !isProcessing && (
        <div
          className={`rounded-xl border p-4 ${
            isBlocked
              ? "border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5"
              : "border-[var(--color-success)]/30 bg-[var(--color-success)]/5"
          }`}
        >
          <p className="text-sm">{audit.reason}</p>
        </div>
      )}

      {/* Proxy Warnings */}
      {audit.proxy_warnings.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-warning)]">
            Proxy Bias Warnings
          </h3>
          <div className="space-y-2">
            {audit.proxy_warnings.map((pw, i) => (
              <div
                key={i}
                className="rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5 px-4 py-3"
              >
                <p className="text-sm font-medium">{pw.feature}</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {pw.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fairness Workshop button */}
      {isBlocked && (
        <button
          onClick={onStartWorkshop}
          className="w-full rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-hover)]"
        >
          Start Fairness Trade-off Workshop
        </button>
      )}

      {/* Metadata */}
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm sm:grid-cols-2 md:grid-cols-4">
        <div>
          <p className="text-[var(--color-text-muted)]">Protected Attribute</p>
          <p className="mt-0.5 font-medium">{audit.facet_column ?? "—"}</p>
        </div>
        <div>
          <p className="text-[var(--color-text-muted)]">Outcome Column</p>
          <p className="mt-0.5 font-medium">{audit.outcome_column ?? "—"}</p>
        </div>
        <div>
          <p className="text-[var(--color-text-muted)]">Created</p>
          <p className="mt-0.5 font-medium">
            {audit.created_at
              ? new Date(audit.created_at).toLocaleString()
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-[var(--color-text-muted)]">Audit ID</p>
          <p className="mt-0.5 font-mono text-xs">{audit.audit_id.slice(0, 8)}</p>
        </div>
      </div>
    </div>
  );
}

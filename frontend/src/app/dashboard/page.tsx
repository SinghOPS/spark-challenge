"use client";

import { useEffect, useState } from "react";
import { listAudits, type AuditSummary } from "@/lib/api";

export default function DashboardPage() {
  const [audits, setAudits] = useState<AuditSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAudits()
      .then((data) => setAudits(data.audits))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            History of all bias audits run through Guardian
          </p>
        </div>
        <a
          href="/"
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)]"
        >
          New Audit
        </a>
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-border)] border-t-[var(--color-accent)]" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 p-6 text-center">
          <p className="text-[var(--color-danger)]">{error}</p>
        </div>
      )}

      {!loading && !error && audits.length === 0 && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
          <p className="text-[var(--color-text-muted)]">
            No audits yet. Upload a CSV to run your first bias audit.
          </p>
          <a
            href="/"
            className="mt-4 inline-block text-sm text-[var(--color-accent)] hover:underline"
          >
            Start your first audit
          </a>
        </div>
      )}

      {!loading && audits.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">
                  Date
                </th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">
                  Dataset
                </th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">
                  Status
                </th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-text-muted)]">
                  Impact Ratio
                </th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-text-muted)]">
                  Liability Debt
                </th>
              </tr>
            </thead>
            <tbody>
              {audits.map((audit) => (
                <tr
                  key={audit.audit_id}
                  className="border-b border-[var(--color-border)] transition hover:bg-[var(--color-surface-hover)] cursor-pointer"
                  onClick={() =>
                    (window.location.href = `/audit?id=${audit.audit_id}`)
                  }
                >
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">
                    {audit.created_at
                      ? new Date(audit.created_at).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {audit.filename ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={audit.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {audit.impact_ratio !== null
                      ? `${(audit.impact_ratio * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${
                      audit.legal_liability_debt !== "$0.00"
                        ? "text-[var(--color-danger)]"
                        : "text-[var(--color-success)]"
                    }`}
                  >
                    {audit.legal_liability_debt}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    BLOCKED: "bg-[var(--color-danger-muted)] text-[var(--color-danger)]",
    PASSED: "bg-[var(--color-success-muted)] text-[var(--color-success)]",
    PROCESSING: "bg-[var(--color-border)] text-[var(--color-text-muted)]",
    ERROR: "bg-[var(--color-danger-muted)] text-[var(--color-danger)]",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        styles[status] ?? styles.ERROR
      }`}
    >
      {status}
    </span>
  );
}

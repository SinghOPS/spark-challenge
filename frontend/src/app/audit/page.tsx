"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { getAudit, type AuditDetail } from "@/lib/api";
import AuditResultView from "@/components/audit-result";
import SocraticChat from "@/components/socratic-chat";

export default function AuditPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-border)] border-t-[var(--color-accent)]" />
        </div>
      }
    >
      <AuditPageInner />
    </Suspense>
  );
}

function AuditPageInner() {
  const searchParams = useSearchParams();
  const auditId = searchParams.get("id");

  const [audit, setAudit] = useState<AuditDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);

  const fetchAudit = useCallback(async () => {
    if (!auditId) return "ERROR";
    try {
      const data = await getAudit(auditId);
      setAudit(data);
      return data.status;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit");
      return "ERROR";
    }
  }, [auditId]);

  useEffect(() => {
    if (!auditId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      const status = await fetchAudit();
      if (active && status === "PROCESSING") {
        timer = setTimeout(poll, 5000);
      }
    }

    poll();

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [auditId, fetchAudit]);

  if (!auditId) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 p-6 text-center">
          <p className="text-[var(--color-danger)]">No audit ID provided</p>
          <a
            href="/"
            className="mt-4 inline-block text-sm text-[var(--color-accent)] hover:underline"
          >
            Start a new audit
          </a>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 p-6 text-center">
          <p className="text-[var(--color-danger)]">{error}</p>
          <a
            href="/"
            className="mt-4 inline-block text-sm text-[var(--color-accent)] hover:underline"
          >
            Start a new audit
          </a>
        </div>
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-border)] border-t-[var(--color-accent)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <a
          href="/dashboard"
          className="text-sm text-[var(--color-text-muted)] transition hover:text-[var(--color-text)]"
        >
          &larr; Back to Dashboard
        </a>
        <h1 className="mt-2 text-2xl font-bold">Audit Results</h1>
      </div>

      <AuditResultView
        audit={audit}
        onStartWorkshop={() => setShowChat(true)}
      />

      {showChat && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold">
            Socratic Scaffolding Workshop
          </h2>
          <SocraticChat auditId={auditId} initialContext={audit.reason ?? undefined} />
        </div>
      )}
    </div>
  );
}

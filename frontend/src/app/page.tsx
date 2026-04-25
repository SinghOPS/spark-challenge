"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CsvUpload from "@/components/csv-upload";
import { startAudit } from "@/lib/api";

const MAX_CSV_BYTES = 6 * 1024 * 1024;

export default function HomePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [facetColumn, setFacetColumn] = useState("");
  const [outcomeColumn, setOutcomeColumn] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileAccepted(f: File, h: string[]) {
    setFile(f);
    setHeaders(h);
    setFacetColumn(h[0] ?? "");
    setOutcomeColumn(h[h.length - 1] ?? "");
    setError(null);
  }

  async function handleSubmit() {
    if (!file || !facetColumn || !outcomeColumn) return;
    if (file.size > MAX_CSV_BYTES) {
      setError("CSV is too large. Please upload a file smaller than 6 MB.");
      return;
    }
    if (facetColumn === outcomeColumn) {
      setError("Protected attribute and outcome must be different columns");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      );

      const result = await startAudit(
        base64,
        facetColumn,
        outcomeColumn,
        file.name
      );
      router.push(`/audit?id=${result.audit_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start audit");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          Algorithmic Bias Audit
        </h1>
        <p className="mt-3 text-lg text-[var(--color-text-muted)]">
          Upload your dataset to check for disparate impact, proxy bias, and
          calculate legal liability exposure.
        </p>
      </div>

      <CsvUpload onFileAccepted={handleFileAccepted} />

      {file && headers.length > 0 && (
        <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <p className="mb-4 text-sm font-medium text-[var(--color-text-muted)]">
            Selected: <span className="text-[var(--color-text)]">{file.name}</span>
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Protected Attribute
              </label>
              <select
                value={facetColumn}
                onChange={(e) => setFacetColumn(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
              >
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                e.g. race, gender, age_group
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Outcome Column
              </label>
              <select
                value={outcomeColumn}
                onChange={(e) => setOutcomeColumn(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
              >
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                e.g. approved, hired, selected
              </p>
            </div>
          </div>

          {error && (
            <p className="mt-4 text-sm text-[var(--color-danger)]">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            {loading ? "Starting audit..." : "Run Bias Audit"}
          </button>
        </div>
      )}
    </div>
  );
}

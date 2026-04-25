export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <header className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">About Guardian</h1>
        <p className="text-lg text-[var(--color-text-muted)]">
          Guardian is an AI governance layer that audits model outcomes for
          disparate impact, estimates legal risk, and guides teams through
          fairness trade-offs with an interactive Socratic tutor.
        </p>
      </header>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h2 className="text-xl font-semibold">What It Does</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[var(--color-text-muted)]">
          <li>
            Audits decisions with the 4/5ths rule using a protected attribute
            and binary outcome column.
          </li>
          <li>
            Calculates impact ratio and legal liability debt for transparency.
          </li>
          <li>
            Flags potential proxy features such as names, geography, and
            socioeconomic indicators.
          </li>
          <li>
            Launches a Bedrock-powered Socratic workshop for structured
            remediation thinking.
          </li>
        </ul>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h3 className="font-semibold">1. Upload</h3>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Upload a CSV and choose the protected attribute (for example
            `race`, `sex`, or `age_group`) plus the outcome column (for example
            `approved`).
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h3 className="font-semibold">2. Evaluate</h3>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Guardian computes selection rates by group, impact ratio, and
            liability debt, then marks the audit as PASSED or BLOCKED.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h3 className="font-semibold">3. Improve</h3>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            If blocked, use the fairness workshop to reason about root causes,
            proxy effects, and model-fairness trade-offs before retraining.
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h2 className="text-xl font-semibold">Use Cases</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="font-medium">Lending and Credit</h3>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Check loan approval or credit limit decisions for disparate
              impact across protected groups.
            </p>
          </div>
          <div>
            <h3 className="font-medium">Hiring and Recruiting</h3>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Audit screening outcomes to detect imbalances and proxy-based
              discrimination risk before production use.
            </p>
          </div>
          <div>
            <h3 className="font-medium">Insurance Underwriting</h3>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Evaluate approval and pricing decisions against fairness
              constraints and accountability requirements.
            </p>
          </div>
          <div>
            <h3 className="font-medium">Internal Model Governance</h3>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Use Guardian as a release gate in model review workflows to
              standardize risk checks and governance evidence.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h2 className="text-xl font-semibold">Key Outputs</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[var(--color-text-muted)]">
          <li>
            <span className="font-medium text-[var(--color-text)]">
              Impact Ratio:
            </span>{" "}
            Primary fairness metric based on minimum-to-maximum selection rate.
          </li>
          <li>
            <span className="font-medium text-[var(--color-text)]">
              Audit Status:
            </span>{" "}
            PASSED if impact ratio is at least 0.80, otherwise BLOCKED.
          </li>
          <li>
            <span className="font-medium text-[var(--color-text)]">
              Legal Liability Debt:
            </span>{" "}
            Estimated exposure computed from fairness gap severity.
          </li>
          <li>
            <span className="font-medium text-[var(--color-text)]">
              Proxy Bias Warnings:
            </span>{" "}
            Heuristic warnings for features likely to encode protected
            characteristics indirectly.
          </li>
        </ul>
      </section>
    </div>
  );
}

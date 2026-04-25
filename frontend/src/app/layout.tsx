import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Guardian - Algorithmic Auditor",
  description:
    "AI governance layer that audits for proxy bias, calculates legal liability, and guides ethical decision-making",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
        <body className="min-h-screen antialiased" suppressHydrationWarning>
        <nav className="border-b border-[var(--color-border)] px-6 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <a href="/" className="flex items-center gap-3 text-xl font-bold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent)] text-sm text-white">
                G
              </span>
              Guardian
            </a>
            <div className="flex gap-6 text-sm">
              <a
                href="/"
                className="text-[var(--color-text-muted)] transition hover:text-[var(--color-text)]"
              >
                New Audit
              </a>
              <a
                href="/about"
                className="text-[var(--color-text-muted)] transition hover:text-[var(--color-text)]"
              >
                About
              </a>
              <a
                href="/dashboard"
                className="text-[var(--color-text-muted)] transition hover:text-[var(--color-text)]"
              >
                Dashboard
              </a>
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}

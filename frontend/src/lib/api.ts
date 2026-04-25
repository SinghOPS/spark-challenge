const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    mode: "cors",
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }

  return res.json();
}

export interface AuditStartResponse {
  audit_id: string;
  status: string;
  message: string;
}

export interface AuditDetail {
  audit_id: string;
  status: "PROCESSING" | "PASSED" | "BLOCKED" | "ERROR";
  impact_ratio: number | null;
  legal_liability_debt: string;
  legal_liability_debt_raw: number;
  proxy_warnings: ProxyWarning[];
  facet_column: string | null;
  outcome_column: string | null;
  filename: string | null;
  reason: string | null;
  action_required: string | null;
  created_at: string;
}

export interface ProxyWarning {
  feature: string;
  protected_attribute: string;
  correlation: number;
  description: string;
}

export interface AuditSummary {
  audit_id: string;
  status: string;
  impact_ratio: number | null;
  legal_liability_debt: string;
  filename: string | null;
  created_at: string;
}

export interface ChatResponse {
  audit_id: string;
  response: string;
  conversation_length: number;
}

export async function startAudit(
  csvBase64: string,
  facetColumn: string,
  outcomeColumn: string,
  filename: string
): Promise<AuditStartResponse> {
  return request<AuditStartResponse>("/audit", {
    method: "POST",
    body: JSON.stringify({
      csv_data: csvBase64,
      facet_column: facetColumn,
      outcome_column: outcomeColumn,
      filename,
    }),
  });
}

export async function getAudit(auditId: string): Promise<AuditDetail> {
  return request<AuditDetail>(`/audit/${auditId}`);
}

export async function listAudits(): Promise<{ audits: AuditSummary[] }> {
  return request<{ audits: AuditSummary[] }>("/audits");
}

export async function sendChatMessage(
  auditId: string,
  message: string
): Promise<ChatResponse> {
  return request<ChatResponse>("/chat", {
    method: "POST",
    body: JSON.stringify({ audit_id: auditId, message }),
  });
}

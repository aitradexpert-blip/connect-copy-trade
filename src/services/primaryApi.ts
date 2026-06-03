/**
 * Primary API client — talks to our self-hosted FastAPI engine.
 *
 * Returns the inner `data` object from the canonical wrapper:
 *   { "source": "mt5", "data": {...} }
 *
 * Throws PrimaryUnavailableError on network errors, timeouts, 5xx, or when the
 * wrapper shape is unexpected. Callers should pair this with
 * `tradingDataGateway.withFailover(...)` so the legacy MetaAPI edge functions
 * stay as a silent fallback.
 *
 * NOTE: The primary engine is dormant in production today. Only requests fire
 * when VITE_API_URL is set; otherwise `withFailover` skips straight to fallback.
 */

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
const DEFAULT_TIMEOUT_MS = 6000;

export class PrimaryUnavailableError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "PrimaryUnavailableError";
  }
}

export function isPrimaryConfigured(): boolean {
  return BASE_URL.length > 0;
}

async function req<T = any>(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  if (!BASE_URL) {
    throw new PrimaryUnavailableError("VITE_API_URL not configured");
  }
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const resp = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: ctl.signal,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers || {}),
      },
    });
    if (!resp.ok) {
      throw new PrimaryUnavailableError(
        `Primary engine HTTP ${resp.status} on ${path}`,
      );
    }
    const body = await resp.json().catch(() => null);
    if (!body || typeof body !== "object" || !("data" in body)) {
      throw new PrimaryUnavailableError(
        `Primary engine returned unexpected shape on ${path}`,
      );
    }
    return (body as { data: T }).data;
  } catch (e: any) {
    if (e instanceof PrimaryUnavailableError) throw e;
    throw new PrimaryUnavailableError(
      e?.name === "AbortError"
        ? `Primary engine timeout on ${path}`
        : `Primary engine error on ${path}: ${e?.message || e}`,
      e,
    );
  } finally {
    clearTimeout(t);
  }
}

export const primaryApi = {
  configured: isPrimaryConfigured,
  getAccount: (accountId?: string) =>
    req(`/account${accountId ? `?id=${encodeURIComponent(accountId)}` : ""}`),
  getPositions: (accountId?: string) =>
    req(`/positions${accountId ? `?id=${encodeURIComponent(accountId)}` : ""}`),
  getHistory: (accountId?: string, from?: string, to?: string) => {
    const qs = new URLSearchParams();
    if (accountId) qs.set("id", accountId);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const tail = qs.toString();
    return req(`/history${tail ? `?${tail}` : ""}`);
  },
  sendOrder: (payload: Record<string, unknown>) =>
    req(`/order`, { method: "POST", body: JSON.stringify(payload) }, 10000),
  calcMargin: (payload: Record<string, unknown>) =>
    req(`/calc-margin`, { method: "POST", body: JSON.stringify(payload) }),
  orderCheck: (payload: Record<string, unknown>) =>
    req(`/order-check`, { method: "POST", body: JSON.stringify(payload) }),
};

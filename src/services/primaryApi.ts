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
        "ngrok-skip-browser-warning": "true",
        "x-vps-secret": "b27c87581e27d989c23a64d41831ab696f7dfa7820a2146f29ca2201",
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
    // Accept both the canonical wrapper { source, data } and a bare payload
    // ({...} / [...]) so a healthy bridge isn't wrongly marked unavailable just
    // because it omits the wrapper. Only an empty/invalid response fails over.
    if (body === null || body === undefined) {
      throw new PrimaryUnavailableError(
        `Primary engine returned empty body on ${path}`,
      );
    }
      const data = await resp.json();   // <-- parse JSON here
      return data;
    
    if (typeof body === "object" && !Array.isArray(body) && "data" in body) {
      return (body as { data: T }).data;
    }
    return body as T;
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
  
  // Explicitly handle headers and body for the connect route
  connect: async (payload: { login: number; password: string; server: string; account_id: string }) => {
    return req(`/connect`, { 
      method: "POST", 
      body: JSON.stringify(payload),
      headers: { 
  "Content-Type": "application/json",
  "x-vps-secret": "b27c87581e27d989c23a64d41831ab696f7dfa7820a2146f29ca2201"
              }
    }, 15000); // Increased timeout to 15s for MT5 login
  },

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

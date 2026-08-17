/**
 * Primary API client — talks to the VPS through the vps-proxy edge function.
 * The browser never holds the VPS secret; the proxy attaches it server-side
 * after verifying the caller's Supabase session and that they own the
 * account being touched.
 *
 * IMPORTANT: this client is NOT gated on the browser build variable
 * VITE_API_URL. The VPS base URL lives server-side in the `VPS_API_URL`
 * Supabase secret, so a missing/blank frontend env var must never silently
 * disable the primary trading engine (that regression made every account
 * connection skip the VPS and surface a bogus "capacity exhausted" error).
 * VITE_API_URL is optional and only used for direct browser diagnostics.
 */
import { supabase } from "@/integrations/supabase/client";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

export class PrimaryUnavailableError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "PrimaryUnavailableError";
  }
}

/** Direct browser URL for the VPS — optional, diagnostics only. */
export function getPrimaryDirectUrl(): string {
  return BASE_URL;
}

/**
 * The primary engine is always reachable through the vps-proxy edge function.
 * If the server-side secret is missing, the proxy answers with a clear
 * "VPS not configured on server" error instead of us skipping it blindly.
 */
export function isPrimaryConfigured(): boolean {
  return true;
}

const NOT_CONFIGURED_RE = /not configured|VPS_API_URL|VPS_API_SECRET/i;

async function callProxy<T = any>(path: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("vps-proxy", { body: { path, body } });
  if (error) {
    // The proxy call itself failed to complete — genuinely unreachable.
    throw new PrimaryUnavailableError(`Primary engine unreachable on ${path}: ${error.message}`, error);
  }
  if (data?.error) {
    const msg = String(data.error);
    // Server misconfiguration is an availability problem, not a broker rejection.
    if (NOT_CONFIGURED_RE.test(msg)) {
      throw new PrimaryUnavailableError(`Primary engine not configured: ${msg}`);
    }
    // The VPS answered — this is a real, honest rejection, not unreachability.
    // Return it as a structured failure instead of throwing, so callers don't
    // mistake a real broker rejection for "try the fallback engine instead."
    return { success: false, error: msg } as T;
  }
  if (data && typeof data === "object" && "data" in data) {
    return (data as { data: T }).data;
  }
  return data as T;
}

export const primaryApi = {
  configured: isPrimaryConfigured,

  /** Health probe routed through the same path production traffic uses. */
  health: async (): Promise<boolean> => {
    try {
      const res: any = await callProxy("health", {});
      if (res === null || res === undefined) return false;
      if (res?.success === false) return false;
      return true;
    } catch {
      return false;
    }
  },

  connect: (payload: { login: number; password: string; server: string; account_id: string }) =>
    callProxy("connect", payload),

  getAccount: (accountId: string) => callProxy("account", { account_id: accountId }),
  getPositions: (accountId: string) => callProxy("positions", { account_id: accountId }),
  getHistory: (accountId: string, from?: string, to?: string) =>
    callProxy("history", { account_id: accountId, from, to }),
  sendOrder: (payload: Record<string, unknown>) => callProxy("order", payload),
  copyTrade: (payload: { master_account_id: string; symbol: string; volume: number; order_type?: string; sl?: number; tp?: number }) =>
    callProxy("copy-trade", payload),
};

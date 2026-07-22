/**
 * Primary API client — talks to the VPS through the vps-proxy edge function.
 * The browser never holds the VPS secret; the proxy attaches it server-side
 * after verifying the caller's Supabase session and that they own the
 * account being touched.
 */
import { supabase } from "@/integrations/supabase/client";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$", "");

export class PrimaryUnavailableError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "PrimaryUnavailableError";
  }
}

export function isPrimaryConfigured(): boolean {
  return BASE_URL.length > 0;
}

async function callProxy<T = any>(path: string, body: Record<string, unknown>): Promise<T> {
  if (!BASE_URL) {
    throw new PrimaryUnavailableError("VITE_API_URL not configured");
  }
  const { data, error } = await supabase.functions.invoke("vps-proxy", { body: { path, body } });
  if (error) {
    // The proxy call itself failed to complete — genuinely unreachable.
    throw new PrimaryUnavailableError(`Primary engine unreachable on ${path}: ${error.message}`, error);
  }
  if (data?.error) {
    // The VPS answered — this is a real, honest rejection, not unreachability.
    // Return it as a structured failure instead of throwing, so callers don't
    // mistake a real broker rejection for "try the fallback engine instead."
    return { success: false, error: data.error } as T;
  }
  if (data && typeof data === "object" && "data" in data) {
    return (data as { data: T }).data;
  }
  return data as T;
}

export const primaryApi = {
  configured: isPrimaryConfigured,

  connect: (payload: { login: number; password: string; server: string; account_id: string }) =>
    callProxy("connect", payload),

  getAccount: (accountId: string) => callProxy("account", { account_id: accountId }),
  getPositions: (accountId: string) => callProxy("positions", { account_id: accountId }),
  getHistory: (accountId: string, from?: string, to?: string) =>
    callProxy("history", { account_id: accountId, from, to }),

  // Normalize common caller shapes: accept accountId or account_id and forward server-expected keys.
  sendOrder: (payload: Record<string, unknown>) => {
    const normalized: Record<string, unknown> = { ...payload };
    if ((normalized as any).accountId && !(normalized as any).account_id) {
      normalized.account_id = (normalized as any).accountId;
      delete (normalized as any).accountId;
    }
    return callProxy("order", normalized);
  },

  copyTrade: (payload: { master_account_id: string; symbol: string; volume: number; order_type?: string; sl?: number; tp?: number }) =>
    callProxy("copy-trade", payload),
};

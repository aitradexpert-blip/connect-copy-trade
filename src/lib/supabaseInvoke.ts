import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";

/**
 * Calls a Supabase Edge Function via fetch so non-2xx JSON bodies (e.g. MetaAPI `message`)
 * are visible. `supabase.functions.invoke` often only exposes "Edge Function returned a non-2xx status code".
 */
export async function invokeEdgeFunctionJson<T = unknown>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: T | null; errorMessage: string | null }> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (sessionError || !token) {
    return { ok: false, status: 401, data: null, errorMessage: "Not signed in" };
  }

  const url = `${SUPABASE_URL}/functions/v1/${functionName}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  });

  const rawText = await res.text();
  let parsed: unknown = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText) as unknown;
    } catch {
      parsed = null;
    }
  }

  if (!res.ok) {
    const obj = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    const message =
      (obj?.message != null && String(obj.message)) ||
      (obj?.error != null && String(obj.error)) ||
      (obj?.details != null && String(obj.details)) ||
      rawText ||
      res.statusText ||
      `HTTP ${res.status}`;
    return { ok: false, status: res.status, data: (parsed as T) ?? null, errorMessage: message };
  }

  return { ok: true, status: res.status, data: (parsed as T) ?? null, errorMessage: null };
}

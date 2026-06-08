/**
 * Dual-engine gateway: try primary (self-hosted FastAPI on the VPS), silently
 * fall back to legacy MetaAPI on PrimaryUnavailableError. The user-facing error
 * only surfaces if BOTH legs fail.
 *
 * Every call reports the route that actually served the request into the engine
 * status bus, so the UI reflects TRUE routing instead of a standalone health ping.
 */
import { PrimaryUnavailableError, isPrimaryConfigured } from "./primaryApi";
import { reportEngineRoute } from "./engineStatus";

export async function withFailover<T>(
  primaryFn: () => Promise<T>,
  fallbackFn: () => Promise<T>,
): Promise<T> {
  if (!isPrimaryConfigured()) {
    reportEngineRoute("fallback");
    return fallbackFn();
  }
  try {
    const result = await primaryFn();
    reportEngineRoute("primary");
    return result;
  } catch (e) {
    if (e instanceof PrimaryUnavailableError) {
      console.warn("[gateway] primary unavailable, using fallback:", e.message);
      reportEngineRoute("fallback");
      return fallbackFn();
    }
    throw e;
  }
}

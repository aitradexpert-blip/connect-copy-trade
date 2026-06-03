/**
 * Dual-engine gateway: try primary (self-hosted FastAPI), silently fall back
 * to legacy MetaAPI on PrimaryUnavailableError. The user-facing error only
 * surfaces if BOTH legs fail.
 */
import { PrimaryUnavailableError, isPrimaryConfigured } from "./primaryApi";

export async function withFailover<T>(
  primaryFn: () => Promise<T>,
  fallbackFn: () => Promise<T>,
): Promise<T> {
  if (!isPrimaryConfigured()) {
    return fallbackFn();
  }
  try {
    return await primaryFn();
  } catch (e) {
    if (e instanceof PrimaryUnavailableError) {
      console.warn("[gateway] primary unavailable, using fallback:", e.message);
      return fallbackFn();
    }
    throw e;
  }
}

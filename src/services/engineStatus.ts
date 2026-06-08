/**
 * Engine status bus.
 *
 * Records which execution engine actually served the most recent trading call
 * so the UI can show the TRUE routing (primary VPS vs MetaAPI fallback) instead
 * of inferring it from a standalone /health ping. `withFailover` reports into
 * this bus on every call; components subscribe via `subscribeEngineStatus`.
 */

export type EngineRoute = "primary" | "fallback";

type Listener = (route: EngineRoute, at: number) => void;

const listeners = new Set<Listener>();
let lastRoute: EngineRoute | null = null;
let lastAt = 0;

export function reportEngineRoute(route: EngineRoute): void {
  lastRoute = route;
  lastAt = Date.now();
  for (const fn of listeners) {
    try {
      fn(route, lastAt);
    } catch {
      /* listener errors must never break the trading flow */
    }
  }
}

export function getLastEngineRoute(): { route: EngineRoute | null; at: number } {
  return { route: lastRoute, at: lastAt };
}

export function subscribeEngineStatus(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

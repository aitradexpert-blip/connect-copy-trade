import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { subscribeEngineStatus, getLastEngineRoute, type EngineRoute } from "@/services/engineStatus";

type Status = "online" | "fallback" | "reconnecting" | "offline" | "disabled";

const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
const POLL_MS = 30_000;
const TIMEOUT_MS = 5_000;
// If a real trading call routed through fallback within this window, trust that
// over the health ping — it reflects what production traffic actually did.
const ROUTE_FRESH_MS = 60_000;

async function ping(): Promise<boolean> {
  if (!BASE) return false;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    // Prefer FastAPI /health; fall back to /account?id=health sentinel for older VPS builds.
    let resp = await fetch(`${BASE}/health`, {
      signal: ctl.signal,
      headers: { "ngrok-skip-browser-warning": "true" },
    });
    if (resp.status === 404) {
      resp = await fetch(`${BASE}/account?id=health`, {
        signal: ctl.signal,
        headers: { "ngrok-skip-browser-warning": "true" },
      });
    }
    return resp.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export function PrimaryStatusBadge() {
  const [healthOk, setHealthOk] = useState<boolean | null>(null);
  const [fails, setFails] = useState(0);
  const [route, setRoute] = useState<EngineRoute | null>(getLastEngineRoute().route);
  const [routeAt, setRouteAt] = useState<number>(getLastEngineRoute().at);

  // Subscribe to the TRUE routing of live trading calls.
  useEffect(() => {
    if (!BASE) return;
    return subscribeEngineStatus((r, at) => {
      setRoute(r);
      setRouteAt(at);
    });
  }, []);

  // Background health probe of the primary engine.
  useEffect(() => {
    if (!BASE) return;
    let alive = true;
    const tick = async () => {
      const ok = await ping();
      if (!alive) return;
      setHealthOk(ok);
      setFails((f) => (ok ? 0 : f + 1));
    };
    tick();
    const i = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(i);
    };
  }, []);

  if (!BASE) return null;

  // Derive a single status. Real traffic routing (when fresh) wins over the ping.
  let status: Status;
  const routeFresh = route !== null && Date.now() - routeAt < ROUTE_FRESH_MS;
  if (routeFresh && route === "fallback") {
    status = "fallback";
  } else if (routeFresh && route === "primary") {
    status = "online";
  } else if (healthOk === true) {
    status = "online";
  } else if (healthOk === null) {
    status = "reconnecting";
  } else {
    status = fails >= 3 ? "offline" : "reconnecting";
  }

  const map: Record<Status, { label: string; cls: string; tip: string }> = {
    online: {
      label: "VPS Engine Online",
      cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
      tip: "Trades are routing through your primary VPS (MT5) engine.",
    },
    fallback: {
      label: "MetaAPI Fallback",
      cls: "bg-amber-500/15 text-amber-600 border-amber-500/30",
      tip: "Primary VPS engine failed a recent call — trades are routing through the MetaAPI backup.",
    },
    reconnecting: {
      label: "Reconnecting…",
      cls: "bg-amber-500/15 text-amber-600 border-amber-500/30",
      tip: "Trying to reach the primary VPS engine.",
    },
    offline: {
      label: "VPS Offline · Backup",
      cls: "bg-rose-500/15 text-rose-600 border-rose-500/30",
      tip: "Primary VPS engine is offline — using the MetaAPI backup execution path.",
    },
    disabled: { label: "", cls: "", tip: "" },
  };
  const m = map[status];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`hidden md:inline-flex ${m.cls}`}>
            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current" />
            {m.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{m.tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Status = "online" | "reconnecting" | "offline" | "disabled";

const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
const POLL_MS = 30_000;
const TIMEOUT_MS = 5_000;

async function ping(): Promise<boolean> {
  if (!BASE) return false;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    // Use the verified /account endpoint with a sentinel id — a 200 means engine is up
    const resp = await fetch(`${BASE}/account?id=health`, { signal: ctl.signal });
    return resp.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export function PrimaryStatusBadge() {
  const [status, setStatus] = useState<Status>(BASE ? "reconnecting" : "disabled");
  const [fails, setFails] = useState(0);

  useEffect(() => {
    if (!BASE) return;
    let alive = true;
    const tick = async () => {
      const ok = await ping();
      if (!alive) return;
      if (ok) {
        setFails(0);
        setStatus("online");
      } else {
        setFails((f) => {
          const next = f + 1;
          setStatus(next >= 3 ? "offline" : "reconnecting");
          return next;
        });
      }
    };
    tick();
    const i = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(i);
    };
  }, []);

  if (status === "disabled") return null;

  const map: Record<Status, { label: string; cls: string; tip: string }> = {
    online: { label: "Engine Online", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", tip: "Primary trading engine is connected." },
    reconnecting: { label: "Reconnecting…", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30", tip: "Trying to reach the primary engine." },
    offline: { label: "Fallback Active", cls: "bg-rose-500/15 text-rose-600 border-rose-500/30", tip: "Primary engine offline — using backup execution path." },
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

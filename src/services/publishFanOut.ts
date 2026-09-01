import { supabase } from "@/integrations/supabase/client";

export interface FanOutErrorGroup {
  /** Short human label for this failure bucket. */
  label: string;
  /** How many followers failed with this kind of error. */
  count: number;
  /** One raw error message from this bucket, for detail. */
  sample: string;
}

export interface FanOutSummary {
  invoked: boolean;
  copied: number;
  failed: number;
  followers: number;
  /** @deprecated kept for backwards compatibility — prefer errorGroups. */
  firstError: string | null;
  errorGroups: FanOutErrorGroup[];
  results: any[];
  invokeError: string | null;
}

/** Maps a raw follower error string to a short bucket label. */
export function classifyFanOutError(raw: string): string {
  const e = (raw || "").toLowerCase();
  if (/timed? ?out|timeout|abort|unreachable|network|econn|fetch failed|bridge/.test(e))
    return "timed out";
  if (/invalid[_ -]?credential|password|auth failed|unauthor|login failed/.test(e))
    return "need a password update";
  if (/not deployed|deploying|redeploy|undeployed|provision/.test(e))
    return "still deploying";
  if (/symbol/.test(e)) return "symbol unavailable on broker";
  if (/no (linked |trading )?account|account not found|follower_user_id|orphan/.test(e))
    return "no linked account";
  return (raw || "unknown error").trim().slice(0, 140);
}

/** Tally every failed result into labelled buckets, largest first. */
export function groupFanOutErrors(results: any[]): FanOutErrorGroup[] {
  const map = new Map<string, FanOutErrorGroup>();
  for (const r of results || []) {
    if (!r || r.success !== false) continue;
    const raw = String(r.error ?? "unknown error");
    const label = classifyFanOutError(raw);
    const existing = map.get(label);
    if (existing) existing.count += 1;
    else map.set(label, { label, count: 1, sample: raw });
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

/**
 * Renders buckets honestly:
 *  - many buckets  -> "6 timed out, 3 still deploying, 1 needs a password update"
 *  - single bucket -> the raw message (no detail lost)
 */
export function formatErrorGroups(groups: FanOutErrorGroup[], fallback = ""): string {
  if (!groups.length) return fallback;
  if (groups.length === 1) {
    const g = groups[0];
    return g.count > 1 ? `All ${g.count} failed: ${g.sample}` : g.sample;
  }
  const top = groups.slice(0, 3).map((g) => `${g.count} ${g.label}`);
  const restCount = groups.slice(3).reduce((n, g) => n + g.count, 0);
  if (restCount > 0) top.push(`${restCount} other`);
  return top.join(", ");
}

/**
 * Invokes copy-trade-listener for a freshly published signal and returns a
 * TRUTHFUL summary of what actually happened per follower.
 */
export async function runCopyFanOut(
  signalId: string,
  masterUserId: string,
): Promise<FanOutSummary> {
  const summary: FanOutSummary = {
    invoked: true,
    copied: 0,
    failed: 0,
    followers: 0,
    firstError: null,
    errorGroups: [],
    results: [],
    invokeError: null,
  };

  try {
    const { data, error } = await supabase.functions.invoke("copy-trade-listener", {
      body: { signal_id: signalId, master_user_id: masterUserId },
    });
    if (error) {
      summary.invokeError = error.message;
      summary.firstError = error.message;
      return summary;
    }
    summary.copied = Number(data?.copied_count ?? 0);
    summary.failed = Number(data?.failed_count ?? 0);
    summary.results = Array.isArray(data?.results) ? data.results : [];
    summary.followers = summary.copied + summary.failed;
    summary.errorGroups = groupFanOutErrors(summary.results);
    summary.firstError =
      summary.results.find((r: any) => r && r.success === false)?.error ?? null;
  } catch (e: any) {
    summary.invokeError = e?.message || String(e);
    summary.firstError = summary.invokeError;
  }

  console.info("[publish] copy-trade-listener result", {
    signal_id: signalId,
    master_user_id: masterUserId,
    copied: summary.copied,
    failed: summary.failed,
    invokeError: summary.invokeError,
    errorGroups: summary.errorGroups,
    results: summary.results,
  });

  return summary;
}

/** Human-readable toast content for a publish attempt. */
export function describeFanOut(
  summary: FanOutSummary | null,
  broadcast: any,
): { title: string; description: string; destructive: boolean } {
  console.info("[publish] broadcastSignal legs", broadcast);

  if (!summary || !summary.invoked) {
    return {
      title: "Idea published",
      description: "Copy Trading broadcast was skipped for this idea.",
      destructive: false,
    };
  }

  if (summary.invokeError) {
    return {
      title: "Published, but copy fan-out failed",
      description: summary.invokeError,
      destructive: true,
    };
  }

  if (summary.followers === 0) {
    return {
      title: "Idea published",
      description:
        "No active copy-trading followers yet — the idea is live on the Ideas tab for one-click execution.",
      destructive: false,
    };
  }

  if (summary.copied === 0) {
    return {
      title: `Published, but 0 of ${summary.followers} followers filled`,
      description: formatErrorGroups(
        summary.errorGroups,
        "All follower executions were rejected.",
      ),
      destructive: true,
    };
  }

  return {
    title: `Published — copied to ${summary.copied} of ${summary.followers} followers`,
    description:
      summary.failed > 0
        ? `${summary.failed} failed — ${formatErrorGroups(
            summary.errorGroups,
            "see console for details",
          )}`
        : "All follower accounts filled automatically.",
    destructive: false,
  };
}

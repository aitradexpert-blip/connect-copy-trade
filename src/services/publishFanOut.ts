import { supabase } from "@/integrations/supabase/client";

export interface FanOutSummary {
  invoked: boolean;
  copied: number;
  failed: number;
  followers: number;
  firstError: string | null;
  results: any[];
  invokeError: string | null;
}

/**
 * Invokes copy-trade-listener for a freshly published signal and returns a
 * TRUTHFUL summary of what actually happened per follower.
 *
 * Previously every publish flow fired this and swallowed the response, so the
 * UI reported "published & broadcast!" even when zero followers filled.
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
      description: summary.firstError || "All follower executions were rejected.",
      destructive: true,
    };
  }

  return {
    title: `Published — copied to ${summary.copied} of ${summary.followers} followers`,
    description:
      summary.failed > 0
        ? `${summary.failed} failed: ${summary.firstError || "see console for details"}`
        : "All follower accounts filled automatically.",
    destructive: false,
  };
}

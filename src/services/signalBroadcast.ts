import { supabase } from "@/integrations/supabase/client";

export interface BroadcastOptions {
  toAiBot?: boolean;        // run auto-execute-signal across opted-in bot users
  toCopyFactory?: boolean;  // push external signal through CopyFactory
  toPrimary?: boolean;      // deprecated, ignored
  toCopyTrading?: boolean;  // invoke copy-trade-listener (set false when caller runs it itself)
}

export interface BroadcastSignal {
  id: string;
  symbol: string;
  direction: "BUY" | "SELL" | "buy" | "sell";
  lot_size: number;
  stop_loss?: number | null;
  take_profit?: number | null;
  comment?: string | null;
  mentor_id?: string | null;
}

/**
 * Cascades a freshly-published trading signal through every available channel.
 * The dashboard publish action is the single source of truth — trades do NOT
 * wait on a master broker fill before reaching followers.
 *
 *   1) Direct primary /order fan-out to each opted-in follower / AI-bot account
 *      (skipped silently when VITE_API_URL is not configured).
 *      Per-follower isolation: a failing primary call instantly retries that
 *      follower via the legacy metaapi-execute-trade edge function.
 *   2) AI-bot auto-execution (server-side signal_assignments).
 *   3) MetaAPI CopyFactory external signal (master strategy → all subscribers).
 *
 * All legs are best-effort and isolated via Promise.allSettled.
 */
export async function broadcastSignal(
  signal: BroadcastSignal,
  opts: BroadcastOptions = { toAiBot: true, toCopyFactory: true, toPrimary: true },
): Promise<{ aiBot: any; copyFactory: any; primary: any; copyTrading: any }> {
  const results: { aiBot: any; copyFactory: any; primary: any; copyTrading: any } = {
    aiBot: null,
    copyFactory: null,
    primary: null,
    copyTrading: null,
  };

  // Automatic copy trading is server-owned. This runs for every published idea,
  // regardless of whether the publisher later presses a manual Execute button.
  const copyTradingPromise = signal.mentor_id && opts.toCopyTrading !== false
    ? supabase.functions
        .invoke("copy-trade-listener", { body: { signal_id: signal.id, mentor_id: signal.mentor_id } })
        .then(({ data, error }) => (error ? { error: error.message } : data))
        .catch((e: any) => ({ error: e?.message || String(e) }))
    : Promise.resolve({ skipped: "listener invoked by caller or no mentor_id" });

  const primaryPromise: Promise<any> = Promise.resolve({ skipped: "listener owns automatic copy trading" });

  // 1) AI Bot fan-out
  const aiPromise: Promise<any> =
    opts.toAiBot === false
      ? Promise.resolve({ skipped: "disabled" })
      : supabase.functions
          .invoke("auto-execute-signal", { body: { signal_id: signal.id } })
          .then(({ data, error }) => (error ? { error: error.message } : data))
          .catch((e: any) => ({ error: e?.message || String(e) }));

  // 2) CopyFactory broadcast
  const cfPromise: Promise<any> =
    opts.toCopyFactory === false || !signal.mentor_id
      ? Promise.resolve({ skipped: opts.toCopyFactory === false ? "disabled" : "no mentor_id" })
      : runCopyFactory(signal).catch((e) => ({ error: e?.message || String(e) }));

  const [p, a, c, ct] = await Promise.allSettled([primaryPromise, aiPromise, cfPromise, copyTradingPromise]);
  results.primary = p.status === "fulfilled" ? p.value : { error: String(p.reason) };
  results.aiBot = a.status === "fulfilled" ? a.value : { error: String(a.reason) };
  results.copyFactory = c.status === "fulfilled" ? c.value : { error: String(c.reason) };
  results.copyTrading = ct.status === "fulfilled" ? ct.value : { error: String(ct.reason) };
  return results;
}

async function runCopyFactory(signal: BroadcastSignal) {
  const { data: mentor } = await supabase
    .from("mentor_profiles")
    .select("user_id")
    .eq("id", signal.mentor_id!)
    .maybeSingle();
  if (!mentor?.user_id) return { skipped: "Mentor not found" };

  const { data: masterAcc } = await supabase
    .from("trading_accounts")
    .select("copyfactory_strategy_id")
    .eq("user_id", mentor.user_id)
    .eq("is_master", true)
    .not("copyfactory_strategy_id", "is", null)
    .limit(1)
    .maybeSingle();

  const strategyId = (masterAcc as any)?.copyfactory_strategy_id;
  if (!strategyId) return { skipped: "No CopyFactory strategy on master account" };

  const { data, error } = await supabase.functions.invoke("copyfactory-send-signal", {
    body: {
      strategyId,
      signalId: signal.id,
      symbol: signal.symbol,
      direction: String(signal.direction).toUpperCase(),
      volume: signal.lot_size,
      stopLoss: signal.stop_loss ?? null,
      takeProfit: signal.take_profit ?? null,
      comment: signal.comment ?? null,
    },
  });
  return error ? { error: error.message } : data;
}

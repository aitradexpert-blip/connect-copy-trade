import { supabase } from "@/integrations/supabase/client";
import { primaryApi, isPrimaryConfigured, PrimaryUnavailableError } from "./primaryApi";

export interface BroadcastOptions {
  toAiBot?: boolean;        // run auto-execute-signal across opted-in bot users
  toCopyFactory?: boolean;  // push external signal through CopyFactory
  toPrimary?: boolean;      // direct fan-out via primary FastAPI /order (default true when configured)
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
): Promise<{ aiBot: any; copyFactory: any; primary: any }> {
  const results: { aiBot: any; copyFactory: any; primary: any } = {
    aiBot: null,
    copyFactory: null,
    primary: null,
  };

  // 0) Direct primary /order fan-out (dormant unless VITE_API_URL is set)
  const wantPrimary = opts.toPrimary !== false && isPrimaryConfigured();
  const primaryPromise: Promise<any> = wantPrimary
    ? fanOutDirect(signal).catch((e) => ({ error: e?.message || String(e) }))
    : Promise.resolve({ skipped: "primary engine not configured" });

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

  const [p, a, c] = await Promise.allSettled([primaryPromise, aiPromise, cfPromise]);
  results.primary = p.status === "fulfilled" ? p.value : { error: String(p.reason) };
  results.aiBot = a.status === "fulfilled" ? a.value : { error: String(a.reason) };
  results.copyFactory = c.status === "fulfilled" ? c.value : { error: String(c.reason) };
  return results;
}

async function fanOutDirect(signal: BroadcastSignal) {
  // Resolve mentor.user_id (so we only fan out to followers of THIS mentor)
  let mentorUserId: string | null = null;
  if (signal.mentor_id) {
    const { data: mp } = await supabase
      .from("mentor_profiles")
      .select("user_id")
      .eq("id", signal.mentor_id)
      .maybeSingle();
    mentorUserId = (mp as any)?.user_id ?? null;
  }

  // Followers = active copy_trading_relationships scoped to this mentor's master
  let relsQuery = supabase
    .from("copy_trading_relationships")
    .select("follower_account_id, master_user_id")
    .eq("status", "active");
  if (mentorUserId) relsQuery = relsQuery.eq("master_user_id", mentorUserId);
  const { data: rels } = await relsQuery;

  // AI-bot opted-in accounts = ai_bot_assignments referencing this signal (eligible accounts)
  const { data: botAcc } = await supabase
    .from("ai_bot_assignments")
    .select("trading_account_id")
    .eq("signal_id", signal.id)
    .eq("auto_execute", true);


  const ids = new Set<string>();
  (rels || []).forEach((r: any) => r?.follower_account_id && ids.add(r.follower_account_id));
  (botAcc || []).forEach((b: any) => b?.trading_account_id && ids.add(b.trading_account_id));
  if (!ids.size) return { delivered: 0, skipped: "no eligible followers" };

  const { data: accounts } = await supabase
    .from("trading_accounts")
    .select("id, metaapi_account_id, login, server, platform")
    .in("id", Array.from(ids));

  const payloadBase = {
    signalId: signal.id,
    symbol: signal.symbol,
    direction: String(signal.direction).toUpperCase(),
    volume: signal.lot_size,
    stopLoss: signal.stop_loss ?? null,
    takeProfit: signal.take_profit ?? null,
    comment: signal.comment ?? "HuMi signal",
  };

  const out = await Promise.allSettled(
    (accounts || []).map(async (a: any) => {
      try {
        const res = await primaryApi.sendOrder({
          accountId: a.metaapi_account_id || a.id,
          ...payloadBase,
        });
        return { accountId: a.id, via: "primary", res };
      } catch (e) {
        // Per-follower fallback: route this single trade through MetaAPI execute
        if (!(e instanceof PrimaryUnavailableError)) throw e;
        if (!a.metaapi_account_id) {
          return { accountId: a.id, via: "fallback", error: "no metaapi_account_id" };
        }
        const { data, error } = await supabase.functions.invoke("metaapi-execute-trade", {
          body: {
            accountId: a.metaapi_account_id,
            trade: {
              symbol: signal.symbol,
              direction: String(signal.direction).toUpperCase(),
              volume: signal.lot_size,
              stopLoss: signal.stop_loss ?? null,
              takeProfit: signal.take_profit ?? null,
              comment: signal.comment || "HuMi signal",
            },
          },
        });
        return { accountId: a.id, via: "fallback", res: error ? { error: error.message } : data };
      }
    }),
  );
  return {
    delivered: out.filter((r) => r.status === "fulfilled").length,
    failed: out.filter((r) => r.status === "rejected").length,
    detail: out.map((r) => (r.status === "fulfilled" ? r.value : { error: String(r.reason) })),
  };
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

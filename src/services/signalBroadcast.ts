import { supabase } from "@/integrations/supabase/client";

export interface BroadcastOptions {
  toAiBot?: boolean;        // run auto-execute-signal across opted-in bot users
  toCopyFactory?: boolean;  // push external signal through CopyFactory
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
 * Cascades a freshly-published trading signal through both channels:
 *   1) AI Bot auto-execution (per-user signal_assignments)
 *   2) MetaAPI CopyFactory external signal (master strategy → all subscribers)
 *
 * Both legs are best-effort and isolated: a failure in one does not block the other.
 * The dashboard publish action is the source of truth; the master broker does not
 * need to fill first.
 */
export async function broadcastSignal(
  signal: BroadcastSignal,
  opts: BroadcastOptions = { toAiBot: true, toCopyFactory: true },
): Promise<{ aiBot: any; copyFactory: any }> {
  const results: { aiBot: any; copyFactory: any } = { aiBot: null, copyFactory: null };

  // 1) AI Bot fan-out
  if (opts.toAiBot !== false) {
    try {
      const { data, error } = await supabase.functions.invoke("auto-execute-signal", {
        body: { signal_id: signal.id },
      });
      results.aiBot = error ? { error: error.message } : data;
    } catch (e: any) {
      results.aiBot = { error: e?.message || String(e) };
    }
  }

  // 2) CopyFactory broadcast — resolve master strategyId from mentor's master account
  if (opts.toCopyFactory !== false && signal.mentor_id) {
    try {
      const { data: mentor } = await supabase
        .from("mentor_profiles")
        .select("user_id")
        .eq("id", signal.mentor_id)
        .maybeSingle();

      if (mentor?.user_id) {
        const { data: masterAcc } = await supabase
          .from("trading_accounts")
          .select("copyfactory_strategy_id")
          .eq("user_id", mentor.user_id)
          .eq("is_master", true)
          .not("copyfactory_strategy_id", "is", null)
          .limit(1)
          .maybeSingle();

        const strategyId = (masterAcc as any)?.copyfactory_strategy_id;
        if (strategyId) {
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
          results.copyFactory = error ? { error: error.message } : data;
        } else {
          results.copyFactory = { skipped: "No CopyFactory strategy on master account" };
        }
      } else {
        results.copyFactory = { skipped: "Mentor not found" };
      }
    } catch (e: any) {
      results.copyFactory = { error: e?.message || String(e) };
    }
  }

  return results;
}

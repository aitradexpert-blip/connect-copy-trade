import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Database {
  public: {
    Tables: {
      copy_trading_relationships: {
        Row: {
          id: string;
          master_user_id: string;
          master_account_id: string;
          follower_user_id: string;
          follower_account_id: string;
          status: string;
        };
      };
      trading_accounts: {
        Row: {
          id: string;
          metaapi_account_id: string | null;
          balance: number;
          name: string;
          user_id: string;
          provider: string | null;
          connection_type: string | null;
        };
      };
    };
  };
}

// Simple concurrency-limited runner — caps parallel MetaAPI calls at 5
// to respect broker/provider rate limits while staying well under the
// 150s edge-function envelope.
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = { status: 'fulfilled', value: await worker(items[i], i) };
      } catch (reason) {
        results[i] = { status: 'rejected', reason };
      }
    }
  });
  await Promise.all(runners);
  return results;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    const { signal_id, master_user_id } = await req.json();

    if (!signal_id || !master_user_id) {
      return new Response(
        JSON.stringify({ error: 'signal_id and master_user_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Copy trading triggered for signal:', signal_id, 'by master:', master_user_id);

    const { data: signal, error: signalError } = await supabase
      .from('trading_signals')
      .select('*')
      .eq('id', signal_id)
      .single();

    if (signalError || !signal) {
      console.error('Signal not found:', signalError);
      return new Response(
        JSON.stringify({ error: 'Signal not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: relationships, error: relationshipsError } = await supabase
      .from('copy_trading_relationships')
      .select('*, follower_account:trading_accounts!follower_account_id(*), master_account:trading_accounts!master_account_id(*)')
      .eq('master_user_id', master_user_id)
      .eq('status', 'active');

    if (relationshipsError) {
      console.error('Failed to fetch relationships:', relationshipsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch copy relationships' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rels = relationships || [];
    console.log(`Found ${rels.length} active copy relationships — dispatching in parallel (max 5 concurrent)`);

    const VPS_URL = (Deno.env.get('VPS_API_URL') || '').replace(/\/+$/, '');
    const VPS_SECRET = Deno.env.get('VPS_API_SECRET') || '';

    const auditFailure = async (relationship: any, message: string, via: string) => {
      try {
        await supabase.from('trade_history').insert({
          user_id: relationship.follower_user_id,
          trading_account_id: relationship.follower_account_id,
          symbol: signal.symbol,
          direction: signal.direction,
          volume: 0,
          status: 'failed',
          comment: `[${via}] ${message} (relationship ${relationship.id})`.slice(0, 500),
          signal_id,
        } as any);
      } catch (auditErr) {
        console.error('Failed to write audit row:', auditErr);
      }
    };

    const logSuccess = async (relationship: any, volume: number, via: string, entryPrice?: number | null) => {
      try {
        await supabase.from('trade_history').insert({
          user_id: relationship.follower_user_id,
          trading_account_id: relationship.follower_account_id,
          symbol: signal.symbol,
          direction: signal.direction,
          volume,
          entry_price: entryPrice ?? null,
          stop_loss: signal.stop_loss ?? null,
          take_profit: signal.take_profit ?? null,
          status: 'open',
          comment: `Copied via ${via} (relationship ${relationship.id})`,
          signal_id,
        } as any);
      } catch (logErr) {
        console.error('Failed to write success row:', logErr);
      }
    };

    // ---- VPS helpers -------------------------------------------------------
    const vpsHeaders = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(VPS_SECRET ? { 'x-vps-secret': VPS_SECRET } : {}),
    };

    async function fetchJson(url: string, body: unknown, ms: number, label: string) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), ms);
      try {
        const res = await fetch(url, {
          method: 'POST',
          signal: ctrl.signal,
          headers: vpsHeaders,
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => null);
        return { ok: res.ok, status: res.status, json, error: null as string | null, timedOut: false, unreachable: false };
      } catch (err: any) {
        const aborted = err?.name === 'AbortError' || String(err?.message || '').includes('aborted');
        return {
          ok: false,
          status: 0,
          json: null,
          error: aborted
            ? `${label} timed out after ${ms / 1000}s — the trading bridge did not respond`
            : `${label} unreachable: ${err?.message || String(err)}`,
          timedOut: aborted,
          unreachable: !aborted,
        };
      } finally {
        clearTimeout(timer);
      }
    }

    // Bridge reachability probe — done once, so a down bridge fails fast with a
    // clear message instead of nine identical 8s aborts.
    let vpsOnline = false;
    if (VPS_URL) {
      const probe = await fetchJson(`${VPS_URL}/health`, {}, 5000, 'VPS /health').catch(() => null);
      vpsOnline = !!probe?.json || !!probe?.ok;
      if (!vpsOnline) {
        // /health may be GET-only; retry with GET before giving up.
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 5000);
          const r = await fetch(`${VPS_URL}/health`, { headers: vpsHeaders, signal: ctrl.signal }).finally(() => clearTimeout(t));
          vpsOnline = r.ok;
        } catch { vpsOnline = false; }
      }
      console.log(`[fan-out] VPS bridge online=${vpsOnline}`);
    }

    // One terminal session per account per invocation.
    const vpsSessions = new Map<string, boolean>();
    async function ensureVpsSession(account: any): Promise<{ ok: boolean; error?: string }> {
      if (vpsSessions.get(account.id)) return { ok: true };
      if (!account.login || !account.server || !account.mt5_password) {
        return { ok: false, error: 'Follower account is missing MT5 login/server/password — reconnect the account to enable copying' };
      }
      const res = await fetchJson(`${VPS_URL}/connect`, {
        login: parseInt(String(account.login), 10),
        password: account.mt5_password,
        server: account.server,
        account_id: account.id,
      }, 8000, 'VPS /connect');
      if (res.json?.success) {
        vpsSessions.set(account.id, true);
        return { ok: true };
      }
      return { ok: false, error: res.error || res.json?.error || `VPS /connect HTTP ${res.status}` };
    }

    const settled = await runWithConcurrency(rels, 5, async (relationship: any) => {
      const follower = relationship.follower_account;

      // Guard against orphaned/broken relationship rows — these previously
      // produced null-follower rows in the result set.
      if (!follower || !relationship.follower_user_id) {
        const msg = 'Broken copy relationship: follower account or user is missing';
        console.error(`[fan-out] ${msg} (relationship ${relationship.id})`);
        return { follower_user_id: relationship.follower_user_id ?? null, success: false, via: 'none', error: msg };
      }

      const masterBalance = relationship.master_account?.balance || 10000;
      const followerBalance = follower.balance || 10000;
      const balanceRatio = followerBalance / masterBalance;
      // Floor at 0.01 (min broker lot), ceiling at 10.0 (safety cap so
      // followers with much larger accounts don't submit oversized orders).
      const rawVolume = signal.lot_size * balanceRatio;
      const adjustedVolume = Number(Math.min(10.0, Math.max(0.01, rawVolume)).toFixed(2));

      console.log(`[fan-out] follower=${relationship.follower_user_id} vol=${adjustedVolume}`);

      // Any account holding live MT5 credentials can execute through the bridge.
      const vpsEligible = !!(VPS_URL && vpsOnline && follower.mt5_password && follower.login && follower.server);
      let vpsError: string | null = null;

      if (VPS_URL && !vpsOnline) {
        vpsError = 'Trading bridge (VPS) is offline';
      }

      if (vpsEligible) {
        const session = await ensureVpsSession(follower);
        if (!session.ok) {
          vpsError = session.error!;
        } else {
          const orderBody = {
            accountId: follower.id,
            account_id: follower.id,
            symbol: signal.symbol,
            order_type: String(signal.direction || '').toLowerCase(),
            volume: adjustedVolume,
            sl: signal.stop_loss ?? null,
            tp: signal.take_profit ?? null,
            comment: `Copy from ${relationship.master_account?.name || 'master'}`,
          };

          // Fail fast: 8s window, and retry ONLY on a genuinely transient
          // network/5xx condition. A timeout or a broker-level rejection
          // returns immediately — retrying either one just holds the single
          // shared MT5 terminal lock and starves other publishes.
          let orderRes = await fetchJson(`${VPS_URL}/order`, orderBody, 8000, 'VPS /order');
          const transient = !orderRes.json?.success && !orderRes.timedOut &&
            (orderRes.unreachable || orderRes.status >= 500);
          if (transient) {
            const firstMsg = orderRes.error || orderRes.json?.error || `VPS HTTP ${orderRes.status}`;
            console.warn(`[fan-out] VPS transient failure for ${relationship.follower_user_id}: ${firstMsg} — one retry`);
            vpsSessions.delete(follower.id);
            const re = await ensureVpsSession(follower);
            if (re.ok) orderRes = await fetchJson(`${VPS_URL}/order`, orderBody, 8000, 'VPS /order (retry)');
            else orderRes = { ok: false, status: 0, json: null, error: re.error!, timedOut: false, unreachable: false };
          }

          if (orderRes.json?.success) {
            await logSuccess(relationship, adjustedVolume, 'vps', orderRes.json?.data?.price ?? null);
            return { follower_user_id: relationship.follower_user_id, success: true, via: 'vps', data: orderRes.json };
          }

          vpsError = orderRes.error || orderRes.json?.error || `VPS HTTP ${orderRes.status}`;
        }
      }

      if (vpsError) {
        console.warn(`[fan-out] VPS path failed for ${relationship.follower_user_id}: ${vpsError}`);
        await auditFailure(relationship, vpsError, 'vps');
      }

      // MetaAPI fallback — only meaningful if this account actually has one.
      if (!follower.metaapi_account_id) {
        const msg = vpsError || 'No execution path available: account has neither live MT5 credentials nor a MetaAPI account';
        await auditFailure(relationship, msg, 'none');
        return { follower_user_id: relationship.follower_user_id, success: false, via: vpsError ? 'vps' : 'none', error: msg };
      }

      const invokeMetaApi = async () => await supabase.functions.invoke('metaapi-execute-trade', {
        body: {
          accountId: follower.metaapi_account_id,
          trade: {
            symbol: signal.symbol,
            direction: signal.direction,
            volume: adjustedVolume,
            stopLoss: signal.stop_loss,
            takeProfit: signal.take_profit,
            comment: `Copy from ${relationship.master_account?.name || 'master'}`,
            signal_id,
            user_id: relationship.follower_user_id,
          },
        },
      });

      let { data: tradeResult, error: tradeError } = await invokeMetaApi();

      // The invoke call can succeed at the HTTP level (tradeError stays
      // null) while metaapi-execute-trade's own response body still
      // reports a real failure (e.g. "Missing accountId", "deploying").
      // Check the actual content, don't just trust a clean HTTP call.
      let failMsg = tradeError?.message || tradeResult?.error || (tradeResult?.success === false ? (tradeResult?.text || 'MetaAPI execution failed') : null);

      // "Account not deployed" is recoverable: deploy the account, wait for
      // the broker terminal, then retry the order once.
      if (failMsg && /not deployed|undeployed|deploying|DEPLOY/i.test(failMsg)) {
        console.log(`[fan-out] Deploying MetaAPI account ${follower.metaapi_account_id} then retrying`);
        try {
          await supabase.functions.invoke('metaapi-redeploy-account', {
            body: { accountId: follower.metaapi_account_id, account_id: follower.id },
          });
        } catch (deployErr: any) {
          console.warn('[fan-out] redeploy invoke failed:', deployErr?.message || deployErr);
        }
        await new Promise((r) => setTimeout(r, 12000));
        const retry = await invokeMetaApi();
        tradeResult = retry.data;
        tradeError = retry.error;
        failMsg = tradeError?.message || tradeResult?.error || (tradeResult?.success === false ? (tradeResult?.text || 'MetaAPI execution failed') : null);
        if (failMsg && /not deployed|deploying/i.test(failMsg)) {
          failMsg = 'Broker terminal is still starting up (account deploying) — retry in ~1 minute';
        }
      }

      if (failMsg) {
        console.error(`[fan-out] MetaAPI failed for ${relationship.follower_user_id}:`, failMsg);
        await auditFailure(relationship, failMsg, 'metaapi');
        return { follower_user_id: relationship.follower_user_id, success: false, via: 'metaapi', error: failMsg };
      }

      await logSuccess(relationship, adjustedVolume, 'metaapi', tradeResult?.price ?? null);
      return { follower_user_id: relationship.follower_user_id, success: true, via: 'metaapi', data: tradeResult };
    });


    const results = settled.map((s, i) =>
      s.status === 'fulfilled'
        ? s.value
        : { follower_user_id: rels[i]?.follower_user_id, success: false, error: String((s as any).reason?.message || (s as any).reason) },
    );

    const copied_count = results.filter((r: any) => r.success).length;
    const failed_count = results.length - copied_count;

    return new Response(
      JSON.stringify({ success: true, signal_id, copied_count, failed_count, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Copy trade listener error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

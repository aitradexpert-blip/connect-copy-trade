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

    const { signal_id, master_user_id, mentor_id } = await req.json();
    let resolvedMasterUserId = master_user_id;
    if (!resolvedMasterUserId && mentor_id) {
      const { data: mentorProfile } = await supabase
        .from('mentor_profiles')
        .select('user_id')
        .eq('id', mentor_id)
        .maybeSingle();
      resolvedMasterUserId = mentorProfile?.user_id;
    }

    if (!signal_id || !resolvedMasterUserId) {
      return new Response(
        JSON.stringify({ error: 'signal_id and master_user_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Copy trading triggered for signal:', signal_id, 'by master:', resolvedMasterUserId);

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
      .eq('master_user_id', resolvedMasterUserId)
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

    const settled = await runWithConcurrency(rels, 5, async (relationship: any) => {
      const masterBalance = relationship.master_account?.balance || 10000;
      const followerBalance = relationship.follower_account?.balance || 10000;
      const balanceRatio = followerBalance / masterBalance;
      // Floor at 0.01 (min broker lot), ceiling at 10.0 (safety cap so
      // followers with much larger accounts don't submit oversized orders).
      const rawVolume = signal.lot_size * balanceRatio;
      const adjustedVolume = Number(Math.min(10.0, Math.max(0.01, rawVolume)).toFixed(2));

      console.log(`[fan-out] follower=${relationship.follower_user_id} vol=${adjustedVolume}`);

      // Idempotency: a retried publish/webhook must not place a second order.
      const { data: existingAudit } = await supabase
        .from('trade_history')
        .select('id,status')
        .eq('signal_id', signal_id)
        .eq('trading_account_id', relationship.follower_account_id)
        .in('status', ['open', 'pending'])
        .limit(1)
        .maybeSingle();
      if (existingAudit) {
        return { follower_user_id: relationship.follower_user_id, success: true, skipped: 'already executed', audit_id: existingAudit.id };
      }

      const isVpsAccount = relationship.follower_account?.connection_type === 'vps'
        || relationship.follower_account?.provider === 'vps';

      if (isVpsAccount && VPS_URL) {
        const vpsCtrl = new AbortController();
        const vpsTimeout = setTimeout(() => vpsCtrl.abort(), 8000);
        try {
          const vpsRes = await fetch(`${VPS_URL}/order`, {
            method: 'POST',
            signal: vpsCtrl.signal,
            headers: {
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': 'true',
              ...(VPS_SECRET ? { 'X-VPS-Secret': VPS_SECRET } : {}),
            },
            body: JSON.stringify({
              accountId: relationship.follower_account.id,
              symbol: signal.symbol,
              order_type: String(signal.direction || '').toLowerCase(),
              volume: adjustedVolume,
              sl: signal.stop_loss ?? null,
              tp: signal.take_profit ?? null,
            }),
          }).finally(() => clearTimeout(vpsTimeout));
          const vpsResult = await vpsRes.json().catch(() => null);
          const vpsData = vpsResult?.data && typeof vpsResult.data === 'object' ? vpsResult.data : vpsResult;
          const retcode = Number(vpsData?.retcode);
          const confirmed = vpsResult?.success === true && (!Number.isFinite(retcode) || [10008, 10009].includes(retcode));
          if (confirmed) {
            await logSuccess(relationship, adjustedVolume, 'vps', vpsData?.price ?? null);
            return { follower_user_id: relationship.follower_user_id, success: true, via: 'vps', data: vpsResult };
          }
          const msg = vpsResult?.error || vpsData?.comment || (Number.isFinite(retcode) ? `MT5 order rejected (retcode ${retcode})` : `VPS HTTP ${vpsRes.status}`);
          console.warn(`[fan-out] VPS rejected for ${relationship.follower_user_id}: ${msg}`);
          await auditFailure(relationship, msg, 'vps');
          // Do not send a rejected VPS order to another broker/provider.
          return { follower_user_id: relationship.follower_user_id, success: false, via: 'vps', error: msg };
        } catch (vpsErr: any) {
          console.warn(`[fan-out] VPS unreachable for ${relationship.follower_user_id}:`, vpsErr?.message || vpsErr);
          await auditFailure(relationship, vpsErr?.message || String(vpsErr), 'vps-network');
        }
      }

      // MetaAPI fallback
      const { data: tradeResult, error: tradeError } = await supabase.functions.invoke('metaapi-execute-trade', {
        body: {
          accountId: relationship.follower_account?.metaapi_account_id,
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

      if (tradeError) {
        console.error(`[fan-out] MetaAPI failed for ${relationship.follower_user_id}:`, tradeError.message);
        await auditFailure(relationship, tradeError.message, 'metaapi');
        throw new Error(tradeError.message);
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

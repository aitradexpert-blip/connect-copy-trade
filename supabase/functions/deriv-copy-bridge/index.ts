// Deriv Copy Trading Bridge
// Handles cross-broker copy trading: Deriv-to-Deriv and Deriv-to-MetaAPI

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CopyTradeRequest {
  master_account_id: string;
  master_user_id: string;
  trade: {
    action: 'buy' | 'sell';
    symbol: string;
    volume: number;
    contract_id?: number;
    direction?: string;
  };
}

// Symbol mapping from Deriv to MT5
const SYMBOL_MAP: Record<string, string> = {
  'frxEURUSD': 'EURUSD',
  'frxGBPUSD': 'GBPUSD',
  'frxUSDJPY': 'USDJPY',
  'frxAUDUSD': 'AUDUSD',
  'frxUSDCAD': 'USDCAD',
  'frxUSDCHF': 'USDCHF',
  'frxNZDUSD': 'NZDUSD',
  'frxXAUUSD': 'XAUUSD',
  'frxXAGUSD': 'XAGUSD',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { master_account_id, master_user_id, trade }: CopyTradeRequest = await req.json();

    console.log(`[CopyBridge] Processing copy trade from master ${master_account_id}`);
    console.log(`[CopyBridge] Trade:`, trade);

    // Get all active copy relationships for this master
    const { data: relationships, error: relError } = await supabase
      .from('copy_trading_relationships')
      .select(`
        id,
        follower_user_id,
        follower_account_id,
        trading_accounts!copy_trading_relationships_follower_account_id_fkey (
          id,
          provider,
          metaapi_account_id,
          deriv_token,
          balance,
          deriv_currency
        )
      `)
      .eq('master_account_id', master_account_id)
      .eq('status', 'active');

    if (relError) {
      console.error('[CopyBridge] Error fetching relationships:', relError);
      throw new Error(`Failed to fetch copy relationships: ${relError.message}`);
    }

    if (!relationships || relationships.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active followers', copied: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[CopyBridge] Found ${relationships.length} active followers`);

    const results: Array<{ follower_id: string; success: boolean; error?: string }> = [];

    for (const rel of relationships) {
      const followerAccount = rel.trading_accounts as any;
      
      if (!followerAccount) {
        results.push({ follower_id: rel.id, success: false, error: 'No account found' });
        continue;
      }

      try {
        if (followerAccount.provider === 'deriv') {
          // Deriv-to-Deriv: Use native copy trading
          // Note: Native copy_start should already be set up
          // This is for monitoring/logging purposes
          console.log(`[CopyBridge] Deriv follower ${followerAccount.id} - native copy should handle`);
          results.push({ follower_id: rel.id, success: true });
          
        } else if (followerAccount.provider === 'metaapi') {
          // Deriv-to-MetaAPI: Execute trade via MetaAPI edge function
          const mtSymbol = SYMBOL_MAP[trade.symbol] || trade.symbol;
          
          // Check if this is a tradeable symbol on MT5
          if (!mtSymbol || mtSymbol.startsWith('frx') || mtSymbol.includes('_')) {
            console.log(`[CopyBridge] Skipping non-MT5 symbol: ${trade.symbol}`);
            results.push({ 
              follower_id: rel.id, 
              success: false, 
              error: `Symbol ${trade.symbol} not available on MT5` 
            });
            continue;
          }
          
          // Calculate proportional volume based on balance ratio
          const masterBalance = 10000; // Default if unknown
          const followerBalance = followerAccount.balance || 1000;
          const volumeRatio = Math.min(followerBalance / masterBalance, 1);
          const adjustedVolume = Math.max(0.01, trade.volume * volumeRatio);
          
          // Execute via MetaAPI
          const metaApiResponse = await fetch(`${supabaseUrl}/functions/v1/metaapi-execute-trade`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              accountId: followerAccount.metaapi_account_id,
              trade: {
                actionType: trade.action === 'buy' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
                symbol: mtSymbol,
                volume: adjustedVolume,
                comment: `Copy from ${master_account_id}`,
              },
            }),
          });
          
          if (!metaApiResponse.ok) {
            const errorText = await metaApiResponse.text();
            throw new Error(`MetaAPI error: ${errorText}`);
          }
          
          const metaApiResult = await metaApiResponse.json();
          console.log(`[CopyBridge] MetaAPI trade result:`, metaApiResult);
          
          results.push({ follower_id: rel.id, success: true });
          
        } else {
          results.push({ 
            follower_id: rel.id, 
            success: false, 
            error: `Unsupported provider: ${followerAccount.provider}` 
          });
        }
      } catch (err: any) {
        console.error(`[CopyBridge] Error copying to follower ${rel.id}:`, err);
        results.push({ follower_id: rel.id, success: false, error: err.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        copied: successCount,
        failed: failCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error: any) {
    console.error('[CopyBridge] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

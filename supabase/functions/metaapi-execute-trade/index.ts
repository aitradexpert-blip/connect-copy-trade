// Supabase Edge Function: metaapi-execute-trade
// Purpose: Execute trades on MetaAPI trading accounts

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CLIENT_API_URL = 'https://mt-client-api-v1.london.agiliumtrade.ai'

interface MetaApiTradeRequest {
  actionType: 'ORDER_TYPE_BUY' | 'ORDER_TYPE_SELL'
  symbol: string
  volume: number
  stopLoss?: number
  takeProfit?: number
  comment?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const { accountId, trade } = await req.json()
    if (!accountId || !trade) {
      return new Response(JSON.stringify({ error: 'Missing accountId or trade data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const token = Deno.env.get('METAAPI_TOKEN')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Server misconfiguration: METAAPI_TOKEN not set' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Map incoming payload to MetaAPI format
    const direction: 'BUY' | 'SELL' | undefined = trade.direction
    const actionType = trade.actionType
      ? trade.actionType
      : direction === 'BUY'
        ? 'ORDER_TYPE_BUY'
        : direction === 'SELL'
          ? 'ORDER_TYPE_SELL'
          : undefined

    if (!actionType) {
      return new Response(JSON.stringify({ error: 'Missing or invalid direction/actionType' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const tradeData: MetaApiTradeRequest = {
      actionType,
      symbol: trade.symbol,
      volume: trade.volume,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit,
      comment: trade.comment || 'Executed via platform'
    }

    console.log(`Executing trade for account ${accountId}:`, tradeData)

    const resp = await fetch(`${CLIENT_API_URL}/users/current/accounts/${accountId}/trade`, {
      method: 'POST',
      headers: {
        'auth-token': token,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tradeData)
    })

    if (!resp.ok) {
      const text = await resp.text()
      console.error('MetaAPI trade error', resp.status, text)
      return new Response(JSON.stringify({ 
        error: 'Failed to execute trade', 
        status: resp.status, 
        details: text 
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const result = await resp.json()
    console.log('Trade executed successfully:', result)

    // Log trade to trade_history
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      
      await fetch(`${supabaseUrl}/rest/v1/trade_history`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: trade.user_id,
          trading_account_id: accountId,
          signal_id: trade.signal_id || null,
          symbol: trade.symbol,
          direction: trade.direction,
          volume: trade.volume,
          stop_loss: trade.stopLoss,
          take_profit: trade.takeProfit,
          status: 'open',
          comment: trade.comment
        })
      });
    } catch (e) {
      console.error('Failed to log trade history:', e);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      tradeId: result?.stringCode ?? result?.id ?? result?.dealId ?? result?.orderId ?? null,
      message: 'Trade executed successfully',
      details: result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (e) {
    console.error('Function error:', e)
    return new Response(JSON.stringify({ error: 'Unexpected error', message: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
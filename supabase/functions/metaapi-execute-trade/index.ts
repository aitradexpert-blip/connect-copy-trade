// Supabase Edge Function: metaapi-execute-trade
// Purpose: Execute trades on MetaAPI trading accounts

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CLIENT_API_URL = 'https://mt-client-api-v1.london.agiliumtrade.ai'

interface TradeRequest {
  symbol: string
  direction: 'BUY' | 'SELL'
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

    // Execute trade
    const tradeData: TradeRequest = {
      symbol: trade.symbol,
      direction: trade.direction,
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

    return new Response(JSON.stringify({ 
      success: true, 
      tradeId: result.stringCode,
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
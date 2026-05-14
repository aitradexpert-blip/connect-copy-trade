// Supabase Edge Function: metaapi-execute-trade
// Purpose: Execute trades on MetaAPI trading accounts with dynamic region resolution and auto-redeploy

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PROVISIONING_API_URL = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai'

interface MetaApiTradeRequest {
  actionType: 'ORDER_TYPE_BUY' | 'ORDER_TYPE_SELL'
  symbol: string
  volume: number
  stopLoss?: number
  takeProfit?: number
  comment?: string
}

function normalizeSymbol(symbol: string): string {
  let normalized = symbol.replace(/[\s\/]/g, '').toUpperCase();
  const SYMBOL_MAP: Record<string, string> = {
    'XAUUSD': 'XAUUSD',
    'GOLD': 'XAUUSD',
    'XAGUSD': 'XAGUSD',
    'SILVER': 'XAGUSD',
  };
  return SYMBOL_MAP[normalized] || normalized;
}

async function getAccountDetails(token: string, accountId: string) {
  const resp = await fetch(`${PROVISIONING_API_URL}/users/current/accounts/${accountId}`, {
    headers: { 'auth-token': token, 'Accept': 'application/json' },
  })
  if (!resp.ok) return null
  return await resp.json()
}

async function redeployAccount(token: string, accountId: string) {
  try {
    await fetch(`${PROVISIONING_API_URL}/users/current/accounts/${accountId}/redeploy`, {
      method: 'POST',
      headers: { 'auth-token': token, 'Accept': 'application/json' },
    })
    console.log(`Redeploy initiated for ${accountId}`)
  } catch (e) {
    console.warn('Redeploy attempt failed:', e)
  }
}

async function attemptTrade(clientApiUrl: string, token: string, accountId: string, tradeData: MetaApiTradeRequest) {
  const resp = await fetch(`${clientApiUrl}/users/current/accounts/${accountId}/trade`, {
    method: 'POST',
    headers: {
      'auth-token': token,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(tradeData)
  })
  return resp
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

Deno.serve(async (req) => {
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
      return new Response(JSON.stringify({ 
        text: "I need both an account and trade details to execute. Please try again.",
        error: 'Missing accountId or trade data' 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const token = Deno.env.get('METAAPI_TOKEN')
    if (!token) {
      return new Response(JSON.stringify({ 
        text: "I couldn't connect to the trading platform. Please contact support.",
        error: 'Trading bridge token not configured' 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Step 1: Resolve account region and state
    const acctData = await getAccountDetails(token, accountId)
    if (!acctData) {
      return new Response(JSON.stringify({ 
        text: "Could not find the trading account. Please check your connection.",
        error: 'Account not found in provisioning API'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const region = acctData.region || 'london'
    const accountState = acctData.state || 'UNKNOWN'
    const connectionStatus = acctData.connectionStatus || 'UNKNOWN'
    console.log(`Account ${accountId}: region=${region}, state=${accountState}, connectionStatus=${connectionStatus}`)

    // Step 2: If account is not deployed, deploy it
    if (accountState !== 'DEPLOYED') {
      console.log(`Account not deployed (state=${accountState}), triggering deploy...`)
      await redeployAccount(token, accountId)
      return new Response(JSON.stringify({ 
        text: "Your trading account is reconnecting to the broker. Please try again in 30-60 seconds.",
        error: 'Account not deployed',
        status: 'deploying'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Step 3: Build region-specific Client API URL
    const clientApiUrl = `https://mt-client-api-v1.${region}.agiliumtrade.ai`

    // Map direction to actionType
    const direction = trade.direction
    const actionType = trade.actionType
      ? trade.actionType
      : direction === 'BUY' ? 'ORDER_TYPE_BUY'
      : direction === 'SELL' ? 'ORDER_TYPE_SELL'
      : undefined

    if (!actionType) {
      return new Response(JSON.stringify({ error: 'Missing or invalid direction/actionType' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const normalizedSymbol = normalizeSymbol(trade.symbol)
    const tradeData: MetaApiTradeRequest = {
      actionType,
      symbol: normalizedSymbol,
      volume: trade.volume,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit,
      comment: trade.comment || 'Executed via HuMi'
    }

    console.log(`Executing trade on ${clientApiUrl} for account ${accountId}:`, tradeData)

    // Step 4: Attempt trade, with redeploy+retry on DISCONNECTED/504
    let resp = await attemptTrade(clientApiUrl, token, accountId, tradeData)

    if (!resp.ok && (resp.status === 504 || resp.status === 502)) {
      const errorText = await resp.text()
      console.warn(`Trade attempt got ${resp.status}, attempting redeploy and retry...`, errorText)
      
      // Redeploy and wait
      await redeployAccount(token, accountId)
      await sleep(5000) // Wait 5 seconds for connection to re-establish
      
      // Retry once
      resp = await attemptTrade(clientApiUrl, token, accountId, tradeData)
    }

    if (!resp.ok) {
      const text = await resp.text()
      console.error('Trade execution failed:', resp.status, text)
      
      // Check if it's still a timeout - suggest reconnection
      if (resp.status === 504 || resp.status === 502) {
        return new Response(JSON.stringify({ 
          text: "Your broker connection is temporarily unavailable. We've initiated a reconnection — please try again in 30-60 seconds.",
          error: 'Broker connection timeout',
          status: 'reconnecting'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }
      
      return new Response(JSON.stringify({ 
        text: "The trade couldn't be placed right now. Please try again shortly.",
        error: 'Failed to execute trade', 
        status: resp.status, 
        details: text 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const result = await resp.json()
    console.log('Trade executed successfully:', result)

    // Log trade to trade_history and credit usage
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      
      await fetch(`${supabaseUrl}/rest/v1/credit_usage`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: trade.user_id,
          service: 'trade_execution',
          credits_used: 2,
          description: `Trade executed: ${trade.direction} ${trade.volume} ${trade.symbol}`
        })
      })

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
      })
    } catch (e) {
      console.error('Failed to log trade history:', e)
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
    return new Response(JSON.stringify({ 
      text: "I hit an unexpected issue while executing. Let's try that again.",
      error: 'Unexpected error', 
      message: String(e) 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})

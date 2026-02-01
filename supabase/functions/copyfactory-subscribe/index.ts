// Supabase Edge Function: copyfactory-subscribe
// Purpose: Subscribe to a CopyFactory strategy (become a follower/copier)

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const COPYFACTORY_API_URL = 'https://copyfactory-api-v1.agiliumtrade.agiliumtrade.ai'

interface SubscribeRequest {
  subscriberId: string // MetaAPI account ID of the follower
  strategyId: string // Strategy ID to copy
  name?: string
  // Copy settings
  copyRatio?: number // Multiplier (e.g., 0.5 = half the lots, 2 = double)
  skipPendingOrders?: boolean
  maxTradeRisk?: number // Max risk per trade as percentage
  reverse?: boolean // Reverse trades (buy becomes sell)
  reduceCorrelations?: string // 'none' | 'pairs' | 'symbols'
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const body: SubscribeRequest = await req.json()
    const { 
      subscriberId, 
      strategyId, 
      name,
      copyRatio = 1, 
      skipPendingOrders = false,
      maxTradeRisk,
      reverse = false,
      reduceCorrelations = 'none'
    } = body

    if (!subscriberId || !strategyId) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: subscriberId and strategyId are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const token = Deno.env.get('METAAPI_TOKEN')
    if (!token) {
      console.error('METAAPI_TOKEN not configured')
      return new Response(JSON.stringify({ 
        error: 'Server misconfiguration: MetaAPI token not set' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    console.log(`Subscribing account ${subscriberId} to strategy ${strategyId}`)

    // Build subscription payload
    const subscriptionPayload = {
      name: name || `Subscription to ${strategyId}`,
      strategyId,
      multiplier: copyRatio,
      skipPendingOrders,
      reverse,
      reduceCorrelations,
      ...(maxTradeRisk && { maxTradeRisk }),
    }

    // Create subscription via CopyFactory Configuration API
    const response = await fetch(
      `${COPYFACTORY_API_URL}/users/current/configuration/subscribers/${subscriberId}/subscriptions`,
      {
        method: 'POST',
        headers: {
          'auth-token': token,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(subscriptionPayload),
      }
    )

    const responseText = await response.text()
    console.log(`CopyFactory subscribe response status: ${response.status}`)
    console.log(`CopyFactory subscribe response: ${responseText}`)

    if (response.ok) {
      let data
      try {
        data = JSON.parse(responseText)
      } catch {
        data = { subscriptionId: responseText }
      }

      console.log(`Subscription created successfully`)

      return new Response(JSON.stringify({
        success: true,
        subscriptionId: data.id || data._id || strategyId,
        message: 'Successfully subscribed to strategy. Trades will be copied automatically.',
        details: data,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    } else {
      let errorData
      try {
        errorData = JSON.parse(responseText)
      } catch {
        errorData = { message: responseText }
      }

      console.error(`CopyFactory subscribe error: ${errorData.message || responseText}`)

      // Provide user-friendly error messages
      let userMessage = 'Failed to subscribe to strategy'
      if (errorData.message?.includes('copy factory roles')) {
        userMessage = 'Please enable CopyFactory SUBSCRIBER role on this account first'
      } else if (errorData.message?.includes('strategy not found')) {
        userMessage = 'Strategy not found. It may have been deleted or is not available.'
      } else if (errorData.message?.includes('already subscribed')) {
        userMessage = 'You are already subscribed to this strategy'
      }

      return new Response(JSON.stringify({
        success: false,
        error: userMessage,
        code: errorData.id || 'COPYFACTORY_ERROR',
        details: errorData.message,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }
  } catch (e) {
    console.error('Function error:', e)
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Unexpected error occurred',
      details: String(e)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})

// Supabase Edge Function: copyfactory-subscribe
// Purpose: Subscribe to a CopyFactory strategy (become a follower/copier)
//
// MetaAPI CopyFactory workflow for subscribers:
// The subscriber account must be configured with subscriptions via PUT to
// /users/current/configuration/subscribers/:subscriberId

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// CopyFactory Configuration API
const COPYFACTORY_API_URL = 'https://copyfactory-api-v1.london.agiliumtrade.ai'

interface SubscribeRequest {
  subscriberId: string // MetaAPI account ID of the follower
  strategyId: string // Strategy ID to copy
  name?: string
  // Copy settings
  copyRatio?: number // Multiplier (e.g., 0.5 = half the lots, 2 = double)
  skipPendingOrders?: boolean
  maxTradeRisk?: number // Max risk per trade as percentage
  reverse?: boolean // Reverse trades (buy becomes sell)
  reduceCorrelations?: string // 'none' | 'by-strategy' | 'by-symbol'
}

interface SubscriptionPayload {
  name: string
  subscriptions: Array<{
    strategyId: string
    multiplier: number
    skipPendingOrders: boolean
    reverse: boolean
    reduceCorrelations?: string
    maxTradeRisk?: number
  }>
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

    // Build subscriber configuration payload
    // The subscriber PUT endpoint expects an object with name and subscriptions array
    const subscriberPayload: SubscriptionPayload = {
      name: name || `HuMi Subscriber - ${subscriberId.substring(0, 8)}`,
      subscriptions: [
        {
          strategyId,
          multiplier: copyRatio,
          skipPendingOrders,
          reverse,
          reduceCorrelations,
          ...(maxTradeRisk !== undefined && { maxTradeRisk }),
        }
      ]
    }

    console.log('Subscriber payload:', JSON.stringify(subscriberPayload, null, 2))

    // Configure subscriber via PUT endpoint
    let response = await fetch(
      `${COPYFACTORY_API_URL}/users/current/configuration/subscribers/${subscriberId}`,
      {
        method: 'PUT',
        headers: {
          'auth-token': token,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(subscriberPayload),
      }
    )

    let responseText = await response.text()
    console.log(`CopyFactory subscribe response status: ${response.status}`)
    console.log(`CopyFactory subscribe response: ${responseText}`)

    // Auto-recovery: if MetaAPI complains about SUBSCRIBER role, enable it and retry once.
    if (!response.ok && /copy.?factory.?role|copyFactoryRoles/i.test(responseText)) {
      console.log('Auto-enabling SUBSCRIBER role on subscriber account and retrying...')
      try {
        const enableResp = await fetch(
          `https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${subscriberId}/enable-copy-factory-api`,
          {
            method: 'POST',
            headers: { 'auth-token': token, 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ copyFactoryRoles: ['SUBSCRIBER'], copyFactoryResourceSlots: 1 }),
          },
        )
        console.log('enable-copy-factory-api status:', enableResp.status)
      } catch (e) {
        console.warn('Auto-enable SUBSCRIBER failed:', e)
      }
      response = await fetch(
        `${COPYFACTORY_API_URL}/users/current/configuration/subscribers/${subscriberId}`,
        {
          method: 'PUT',
          headers: {
            'auth-token': token,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(subscriberPayload),
        }
      )
      responseText = await response.text()
      console.log(`Retry status: ${response.status}, body: ${responseText}`)
    }

    if (response.ok || response.status === 204) {
      // 204 No Content is a valid success response
      let data = { subscriptionId: strategyId }
      if (responseText) {
        try {
          data = JSON.parse(responseText)
        } catch {
          // If response is not JSON, use the strategy ID
        }
      }

      console.log(`Subscription created successfully`)

      return new Response(JSON.stringify({
        success: true,
        subscriptionId: strategyId,
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
      if (errorData.message?.includes('copy factory roles') || errorData.message?.includes('copyFactoryRoles')) {
        userMessage = 'Please enable CopyFactory SUBSCRIBER role on this account first'
      } else if (errorData.message?.includes('strategy not found') || errorData.message?.includes('not found')) {
        userMessage = 'Strategy not found. It may have been deleted or is not available.'
      } else if (errorData.message?.includes('already subscribed')) {
        userMessage = 'You are already subscribed to this strategy'
      } else if (errorData.message?.includes('not deployed')) {
        userMessage = 'Your account is not fully deployed. Please wait a moment and try again.'
      }

      return new Response(JSON.stringify({
        success: false,
        error: userMessage,
        code: errorData.id || 'COPYFACTORY_ERROR',
        details: errorData.message || responseText,
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

// Supabase Edge Function: copyfactory-create-strategy
// Purpose: Create a CopyFactory strategy (become a provider/master trader)

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const COPYFACTORY_API_URL = 'https://copyfactory-api-v1.agiliumtrade.agiliumtrade.ai'

interface CreateStrategyRequest {
  accountId: string
  name: string
  description?: string
  connectionType?: 'cloud' | 'self-hosted'
  // Optional settings
  commissionScheme?: {
    type: 'flat-fee' | 'percentage'
    billingPeriod?: 'day' | 'week' | 'month'
    commissionRate?: number
  }
  riskLimits?: {
    maxAbsoluteRisk?: number
    maxRelativeRisk?: number
    maxDailyRisk?: number
  }
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

    const body: CreateStrategyRequest = await req.json()
    const { accountId, name, description, commissionScheme, riskLimits } = body

    if (!accountId || !name) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: accountId and name are required' 
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

    console.log(`Creating CopyFactory strategy for account ${accountId}: ${name}`)

    // Build the strategy payload
    const strategyPayload = {
      name,
      description: description || `HuMi Master Strategy - ${name}`,
      accountId,
      // Default commission scheme if not provided
      commissionScheme: commissionScheme || {
        type: 'flat-fee',
        billingPeriod: 'month',
        commissionRate: 0
      },
      // Optional risk limits
      ...(riskLimits && { riskLimits }),
    }

    // Create strategy via CopyFactory Configuration API
    const response = await fetch(`${COPYFACTORY_API_URL}/users/current/configuration/strategies`, {
      method: 'POST',
      headers: {
        'auth-token': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(strategyPayload),
    })

    const responseText = await response.text()
    console.log(`CopyFactory response status: ${response.status}`)
    console.log(`CopyFactory response: ${responseText}`)

    if (response.ok) {
      let data
      try {
        data = JSON.parse(responseText)
      } catch {
        data = { id: responseText } // Sometimes returns just the ID
      }

      console.log(`Strategy created successfully: ${data.id || data._id}`)

      return new Response(JSON.stringify({
        success: true,
        strategyId: data.id || data._id,
        message: 'Strategy created successfully. Your account is now a provider.',
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

      console.error(`CopyFactory error: ${errorData.message || responseText}`)

      // Provide user-friendly error messages
      let userMessage = 'Failed to create strategy'
      if (errorData.message?.includes('copy factory roles')) {
        userMessage = 'Please enable CopyFactory PROVIDER role on this account first'
      } else if (errorData.message?.includes('not found')) {
        userMessage = 'Account not found in MetaAPI. Please verify the account is connected.'
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

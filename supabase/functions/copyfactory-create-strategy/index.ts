// Supabase Edge Function: copyfactory-create-strategy
// Purpose: Create a CopyFactory strategy (become a provider/master trader)
// 
// MetaAPI CopyFactory workflow:
// 1. First, generate a strategy ID via GET /users/current/configuration/unused-strategy-id
// 2. Then, create the strategy via PUT /users/current/configuration/strategies/:strategyId

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// CopyFactory Configuration API - correct endpoint
const COPYFACTORY_API_URL = 'https://copyfactory-api-v1.london.agiliumtrade.ai'

interface CreateStrategyRequest {
  accountId: string
  name: string
  description?: string
  // Optional settings
  commissionScheme?: {
    type: 'flat-fee' | 'lots'
    billingPeriod?: 'day' | 'week' | 'month'
    commissionRate?: number
  }
  riskLimits?: Array<{
    type: 'day' | 'week' | 'month'
    applyTo: 'balance-difference' | 'equity'
    maxAbsoluteRisk?: number
    maxRelativeRisk?: number
    closePositions?: boolean
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

    // Step 1: Generate a unique strategy ID
    console.log('Step 1: Generating strategy ID...')
    const idResponse = await fetch(`${COPYFACTORY_API_URL}/users/current/configuration/unused-strategy-id`, {
      method: 'GET',
      headers: {
        'auth-token': token,
        'Accept': 'application/json',
      },
    })

    if (!idResponse.ok) {
      const idError = await idResponse.text()
      console.error('Failed to generate strategy ID:', idResponse.status, idError)
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to generate strategy ID',
        details: idError,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const { id: strategyId } = await idResponse.json()
    console.log(`Generated strategy ID: ${strategyId}`)

    // Step 2: Create the strategy using PUT with the generated ID
    console.log('Step 2: Creating strategy...')
    
    // Build the strategy payload according to MetaAPI spec
    const strategyPayload = {
      name,
      description: description || `HuMi Master Strategy - ${name}`,
      accountId,
      // Default commission scheme if not provided (no commission)
      commissionScheme: commissionScheme || {
        type: 'flat-fee',
        billingPeriod: 'month',
        commissionRate: 0
      },
      // Optional risk limits
      ...(riskLimits && { riskLimits }),
    }

    console.log('Strategy payload:', JSON.stringify(strategyPayload, null, 2))

    // Use PUT to create/update strategy with the generated ID
    const response = await fetch(`${COPYFACTORY_API_URL}/users/current/configuration/strategies/${strategyId}`, {
      method: 'PUT',
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

    if (response.ok || response.status === 204) {
      // 204 No Content is a valid success response for PUT
      let data = { id: strategyId }
      if (responseText) {
        try {
          data = JSON.parse(responseText)
        } catch {
          // If response is not JSON, use the generated ID
        }
      }

      console.log(`Strategy created successfully: ${strategyId}`)

      return new Response(JSON.stringify({
        success: true,
        strategyId: strategyId,
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
      if (errorData.message?.includes('copy factory roles') || errorData.message?.includes('copyFactoryRoles')) {
        userMessage = 'Please enable CopyFactory PROVIDER role on this account first. The account must be set up as a provider before creating strategies.'
      } else if (errorData.message?.includes('not found')) {
        userMessage = 'Account not found in MetaAPI. Please verify the account is connected and deployed.'
      } else if (errorData.message?.includes('not deployed')) {
        userMessage = 'Account is not deployed. Please wait for the account to be fully connected before creating a strategy.'
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

// Supabase Edge Function: copyfactory-list-strategies
// Purpose: List available CopyFactory strategies to copy

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const COPYFACTORY_API_URL = 'https://copyfactory-api-v1.london.agiliumtrade.ai'

interface StrategyInfo {
  _id: string
  name: string
  description?: string
  accountId: string
  platformCommissionRate?: number
  commissionScheme?: {
    type: string
    billingPeriod?: string
    commissionRate?: number
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
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

    console.log('Fetching CopyFactory strategies...')

    // Fetch all strategies for the account
    const response = await fetch(`${COPYFACTORY_API_URL}/users/current/configuration/strategies`, {
      method: 'GET',
      headers: {
        'auth-token': token,
        'Accept': 'application/json',
      },
    })

    const responseText = await response.text()
    console.log(`CopyFactory strategies response status: ${response.status}`)

    if (response.ok) {
      let strategies: StrategyInfo[] = []
      try {
        strategies = JSON.parse(responseText)
      } catch {
        console.error('Failed to parse strategies response:', responseText)
        strategies = []
      }

      console.log(`Found ${strategies.length} strategies`)

      // Transform to a cleaner format
      const formattedStrategies = strategies.map(strategy => ({
        id: strategy._id,
        name: strategy.name,
        description: strategy.description || '',
        accountId: strategy.accountId,
        commissionRate: strategy.commissionScheme?.commissionRate || 0,
        commissionType: strategy.commissionScheme?.type || 'flat-fee',
      }))

      return new Response(JSON.stringify({
        success: true,
        strategies: formattedStrategies,
        count: formattedStrategies.length,
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

      console.error(`CopyFactory list error: ${errorData.message || responseText}`)

      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to fetch strategies',
        details: errorData.message,
        strategies: [], // Return empty array on error
      }), {
        status: 200, // Return 200 with empty list rather than error
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }
  } catch (e) {
    console.error('Function error:', e)
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Unexpected error occurred',
      details: String(e),
      strategies: [],
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})

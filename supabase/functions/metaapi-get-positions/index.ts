// Supabase Edge Function: metaapi-get-positions
// Purpose: Get open positions from MetaAPI trading accounts

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CLIENT_API_URL = 'https://mt-client-api-v1.london.agiliumtrade.ai'

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

    const { accountId } = await req.json()
    if (!accountId) {
      return new Response(JSON.stringify({ error: 'Missing accountId' }), {
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

    // Fetch positions
    const resp = await fetch(`${CLIENT_API_URL}/users/current/accounts/${accountId}/positions`, {
      headers: {
        'auth-token': token,
        'Accept': 'application/json',
      },
    })

    if (!resp.ok) {
      const text = await resp.text()
      console.error('MetaAPI positions error', resp.status, text)
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch positions', 
        status: resp.status, 
        details: text 
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const positions = await resp.json()

    return new Response(JSON.stringify({ 
      positions: Array.isArray(positions) ? positions : [],
      count: Array.isArray(positions) ? positions.length : 0
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
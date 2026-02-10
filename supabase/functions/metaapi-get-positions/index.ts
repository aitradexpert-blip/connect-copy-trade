// Supabase Edge Function: metaapi-get-positions
// Purpose: Get open positions from MetaAPI trading accounts

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PROVISIONING_API_URL = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai'

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

    // Get account region from provisioning API
    const acctResp = await fetch(`${PROVISIONING_API_URL}/users/current/accounts/${accountId}`, {
      headers: { 'auth-token': token, 'Accept': 'application/json' },
    })

    let region = 'london'
    if (acctResp.ok) {
      const acctData = await acctResp.json()
      region = acctData.region || 'london'
    }

    const clientApiUrl = `https://mt-client-api-v1.${region}.agiliumtrade.ai`

    const resp = await fetch(`${clientApiUrl}/users/current/accounts/${accountId}/positions`, {
      headers: { 'auth-token': token, 'Accept': 'application/json' },
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
// Supabase Edge Function: metaapi-account-info
// Purpose: Fetch account information (balance/equity) from MetaAPI securely using server-side secret

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

    // Step 1: Get account details from provisioning API to find the correct region URL
    const acctResp = await fetch(`${PROVISIONING_API_URL}/users/current/accounts/${accountId}`, {
      headers: { 'auth-token': token, 'Accept': 'application/json' },
    })

    if (!acctResp.ok) {
      const text = await acctResp.text()
      console.error('MetaAPI provisioning error', acctResp.status, text)
      return new Response(JSON.stringify({ error: 'Failed to fetch account details', status: acctResp.status, details: text }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const acctData = await acctResp.json()
    const region = acctData.region || 'london'
    const state = acctData.state
    const connectionStatus = acctData.connectionStatus

    // Step 2: If account is not deployed, deploy it first
    if (state !== 'DEPLOYED') {
      console.log(`Account ${accountId} state is ${state}, attempting deploy...`)
      const deployResp = await fetch(`${PROVISIONING_API_URL}/users/current/accounts/${accountId}/deploy`, {
        method: 'POST',
        headers: { 'auth-token': token, 'Accept': 'application/json' },
      })
      if (!deployResp.ok) {
        const text = await deployResp.text()
        console.error('Deploy error', deployResp.status, text)
      }
      // Return partial data - account is deploying
      return new Response(JSON.stringify({ 
        balance: null, equity: null, 
        status: 'deploying',
        message: `Account is being deployed (state: ${state}). Please retry in a few moments.`
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Step 3: Use region-specific client API URL
    const clientApiUrl = `https://mt-client-api-v1.${region}.agiliumtrade.ai`

    const resp = await fetch(`${clientApiUrl}/users/current/accounts/${accountId}/account-information`, {
      headers: { 'auth-token': token, 'Accept': 'application/json' },
    })

    if (!resp.ok) {
      const text = await resp.text()
      console.error('MetaAPI client error', resp.status, text)
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch account information', 
        status: resp.status, 
        details: text,
        region,
        connectionStatus 
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const data = await resp.json()
    const balance = typeof data?.balance === 'number' ? data.balance : null
    const equity = typeof data?.equity === 'number' ? data.equity : null

    return new Response(JSON.stringify({ balance, equity, raw: data }), {
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

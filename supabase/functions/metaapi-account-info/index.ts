// Supabase Edge Function: metaapi-account-info
// Purpose: Fetch account information (balance/equity) with auto-redeploy on DISCONNECTED

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PROVISIONING_API_URL = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai'

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const { accountId } = await req.json()
    if (!accountId) {
      return new Response(JSON.stringify({ error: 'Missing accountId' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const token = Deno.env.get('METAAPI_TOKEN')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Server misconfiguration: METAAPI_TOKEN not set' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Get account details from provisioning API
    const acctResp = await fetch(`${PROVISIONING_API_URL}/users/current/accounts/${accountId}`, {
      headers: { 'auth-token': token, 'Accept': 'application/json' },
    })

    if (!acctResp.ok) {
      const text = await acctResp.text()
      console.error('Provisioning error', acctResp.status, text)
      return new Response(JSON.stringify({ error: 'Failed to fetch account details', status: acctResp.status, details: text }), {
        status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const acctData = await acctResp.json()
    const region = acctData.region || 'london'
    const state = acctData.state
    const connectionStatus = acctData.connectionStatus

    // If not deployed, trigger deploy
    if (state !== 'DEPLOYED') {
      console.log(`Account ${accountId} state is ${state}, attempting deploy...`)
      const deployResp = await fetch(`${PROVISIONING_API_URL}/users/current/accounts/${accountId}/deploy`, {
        method: 'POST',
        headers: { 'auth-token': token, 'Accept': 'application/json' },
      })
      if (!deployResp.ok) {
        const text = await deployResp.text()
        return new Response(JSON.stringify({ 
          balance: null, equity: null, 
          status: 'deploy_failed',
          state, connectionStatus, region,
          message: `Account deployment failed (state: ${state}). Error: ${text}`
        }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
      }
      return new Response(JSON.stringify({ 
        balance: null, equity: null, 
        status: 'deploying',
        state, connectionStatus, region,
        message: 'Account is being deployed. Please retry in 30-60 seconds.'
      }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }

    const clientApiUrl = `https://mt-client-api-v1.${region}.agiliumtrade.ai`

    // Attempt to fetch account info
    let resp = await fetch(`${clientApiUrl}/users/current/accounts/${accountId}/account-information`, {
      headers: { 'auth-token': token, 'Accept': 'application/json' },
    })

    // On 504/502 timeout, redeploy and retry once
    if (!resp.ok && (resp.status === 504 || resp.status === 502)) {
      console.warn(`Account info got ${resp.status}, redeploying and retrying...`)
      await fetch(`${PROVISIONING_API_URL}/users/current/accounts/${accountId}/redeploy`, {
        method: 'POST',
        headers: { 'auth-token': token, 'Accept': 'application/json' },
      })
      await sleep(5000)
      resp = await fetch(`${clientApiUrl}/users/current/accounts/${accountId}/account-information`, {
        headers: { 'auth-token': token, 'Accept': 'application/json' },
      })
    }

    if (!resp.ok) {
      const text = await resp.text()
      console.error('Client API error', resp.status, text)
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch account information', 
        status: resp.status, details: text,
        region, connectionStatus,
        nextAction: resp.status === 504 ? 'Account is reconnecting. Please try again in 30-60 seconds.' : undefined
      }), {
        status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const data = await resp.json()
    return new Response(JSON.stringify({ 
      balance: typeof data?.balance === 'number' ? data.balance : null,
      equity: typeof data?.equity === 'number' ? data.equity : null,
      state, connectionStatus, region,
      raw: data 
    }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (e) {
    console.error('Function error:', e)
    return new Response(JSON.stringify({ error: 'Unexpected error', message: String(e) }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})

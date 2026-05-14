// Supabase Edge Function: metaapi-get-positions
// Purpose: Get open positions with auto-redeploy on DISCONNECTED

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

    // Get account region
    const acctResp = await fetch(`${PROVISIONING_API_URL}/users/current/accounts/${accountId}`, {
      headers: { 'auth-token': token, 'Accept': 'application/json' },
    })

    let region = 'london'
    if (acctResp.ok) {
      const acctData = await acctResp.json()
      region = acctData.region || 'london'
      
      // If not deployed, trigger deploy
      if (acctData.state !== 'DEPLOYED') {
        await fetch(`${PROVISIONING_API_URL}/users/current/accounts/${accountId}/deploy`, {
          method: 'POST',
          headers: { 'auth-token': token, 'Accept': 'application/json' },
        })
        return new Response(JSON.stringify({ 
          positions: [], count: 0, 
          status: 'deploying',
          message: 'Account is being deployed. Please retry in 30-60 seconds.'
        }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
      }
    }

    const clientApiUrl = `https://mt-client-api-v1.${region}.agiliumtrade.ai`

    let resp = await fetch(`${clientApiUrl}/users/current/accounts/${accountId}/positions`, {
      headers: { 'auth-token': token, 'Accept': 'application/json' },
    })

    // On 504/502, redeploy and retry
    if (!resp.ok && (resp.status === 504 || resp.status === 502)) {
      console.warn(`Positions got ${resp.status}, redeploying and retrying...`)
      await fetch(`${PROVISIONING_API_URL}/users/current/accounts/${accountId}/redeploy`, {
        method: 'POST',
        headers: { 'auth-token': token, 'Accept': 'application/json' },
      })
      await sleep(5000)
      resp = await fetch(`${clientApiUrl}/users/current/accounts/${accountId}/positions`, {
        headers: { 'auth-token': token, 'Accept': 'application/json' },
      })
    }

    if (!resp.ok) {
      const text = await resp.text()
      console.error('Positions error', resp.status, text)
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch positions', status: resp.status, details: text 
      }), {
        status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const positions = await resp.json()
    return new Response(JSON.stringify({ 
      positions: Array.isArray(positions) ? positions : [],
      count: Array.isArray(positions) ? positions.length : 0
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

// Supabase Edge Function: metaapi-account-info
// Purpose: Fetch account information (balance/equity) from MetaAPI securely using server-side secret

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
    const url = new URL(req.url)

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

    // Fetch account information
    const resp = await fetch(`${CLIENT_API_URL}/users/current/accounts/${accountId}/account-information`, {
      headers: {
        'auth-token': token,
        'Accept': 'application/json',
      },
    })

    if (!resp.ok) {
      const text = await resp.text()
      console.error('MetaAPI error', resp.status, text)
      return new Response(JSON.stringify({ error: 'Failed to fetch account information', status: resp.status, details: text }), {
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

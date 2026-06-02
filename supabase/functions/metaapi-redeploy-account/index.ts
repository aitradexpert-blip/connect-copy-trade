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
      return new Response(JSON.stringify({ error: 'Server misconfiguration: API token not set' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    console.log(`Redeploying account ${accountId}...`)

    const resp = await fetch(`${PROVISIONING_API_URL}/users/current/accounts/${accountId}/redeploy`, {
      method: 'POST',
      headers: { 'auth-token': token, 'Accept': 'application/json' },
    })

    if (!resp.ok) {
      const text = await resp.text()
      console.error('Redeploy error:', resp.status, text)
      
      // Parse error for human-readable message
      let userMessage = 'Account reconnection failed'
      try {
        const errBody = JSON.parse(text)
        if (errBody.message) userMessage = errBody.message
        if (text.includes('top up') || text.includes('credits') || text.includes('resource slots')) {
          userMessage = 'API credits depleted. Please contact HuMi support to resolve this.'
        }
        if (resp.status === 403) {
          userMessage = errBody.message || 'Access denied — API credits may be depleted. Contact support.'
        }
      } catch { /* use default */ }
      
      return new Response(JSON.stringify({ 
        success: false,
        error: userMessage, 
        status: resp.status, 
        details: text 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Get updated account info
    const acctResp = await fetch(`${PROVISIONING_API_URL}/users/current/accounts/${accountId}`, {
      headers: { 'auth-token': token, 'Accept': 'application/json' },
    })

    let state = 'DEPLOYING'
    let connectionStatus = 'DEPLOYING'
    if (acctResp.ok) {
      const acctData = await acctResp.json()
      state = acctData.state || 'DEPLOYING'
      connectionStatus = acctData.connectionStatus || 'DEPLOYING'
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Account reconnection initiated. Connection should restore in 30-60 seconds.',
      state,
      connectionStatus,
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

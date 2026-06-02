import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PROVISIONING_API_URL = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai'

async function getAccountRegion(token: string, accountId: string): Promise<string> {
  const resp = await fetch(`${PROVISIONING_API_URL}/users/current/accounts/${accountId}`, {
    headers: { 'auth-token': token, 'Accept': 'application/json' },
  })
  if (!resp.ok) return 'vint-hill'
  const data = await resp.json()
  return data.region || 'vint-hill'
}

async function closePosition(clientApiUrl: string, token: string, accountId: string, positionId: string) {
  const resp = await fetch(`${clientApiUrl}/users/current/accounts/${accountId}/trade`, {
    method: 'POST',
    headers: { 'auth-token': token, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ actionType: 'POSITION_CLOSE_ID', positionId }),
  })
  return resp.ok
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const token = Deno.env.get('METAAPI_TOKEN')
    if (!token) throw new Error('API token not configured')

    const { accountIds } = await req.json()
    if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
      return new Response(JSON.stringify({ error: 'accountIds array required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const results: { accountId: string; closed: number; errors: number }[] = []

    for (const accountId of accountIds) {
      try {
        const region = await getAccountRegion(token, accountId)
        const clientApiUrl = `https://mt-client-api-v1.${region}.agiliumtrade.ai`

        // Get open positions
        const posResp = await fetch(`${clientApiUrl}/users/current/accounts/${accountId}/positions`, {
          headers: { 'auth-token': token, 'Accept': 'application/json' },
        })

        if (!posResp.ok) {
          results.push({ accountId, closed: 0, errors: 1 })
          continue
        }

        const positions = await posResp.json()
        let closed = 0, errors = 0

        for (const pos of positions) {
          const success = await closePosition(clientApiUrl, token, accountId, pos.id)
          if (success) closed++
          else errors++
        }

        results.push({ accountId, closed, errors })
      } catch (e) {
        console.error(`Error closing trades for ${accountId}:`, e)
        results.push({ accountId, closed: 0, errors: 1 })
      }
    }

    const totalClosed = results.reduce((s, r) => s + r.closed, 0)
    return new Response(JSON.stringify({
      success: true,
      message: `Closed ${totalClosed} positions across ${accountIds.length} accounts`,
      results,
    }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (e) {
    console.error('Function error:', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})

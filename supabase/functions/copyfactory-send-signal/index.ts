// Supabase Edge Function: copyfactory-send-signal
// Purpose: Broadcast an external trade signal through a CopyFactory strategy
// so subscribers receive it instantly without waiting for a master broker fill.
//
// MetaAPI docs: PUT /users/current/configuration/strategies/:strategyId/external-signals/:signalId

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const COPYFACTORY_API_URL = 'https://copyfactory-api-v1.london.agiliumtrade.ai'

interface SendSignalRequest {
  strategyId: string
  signalId?: string // optional; defaults to a fresh UUID
  symbol: string
  direction: 'BUY' | 'SELL' | 'buy' | 'sell'
  volume: number
  stopLoss?: number | null
  takeProfit?: number | null
  comment?: string | null
  expiresInSeconds?: number // default 24h
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405)
    }

    const body: SendSignalRequest = await req.json()
    const { strategyId, symbol, direction, volume } = body
    if (!strategyId || !symbol || !direction || !volume) {
      return json({ error: 'Missing required fields: strategyId, symbol, direction, volume' }, 400)
    }

    const token = Deno.env.get('METAAPI_TOKEN')
    if (!token) return json({ error: 'Server misconfiguration: METAAPI_TOKEN not set' }, 500)

    const signalId = body.signalId || crypto.randomUUID()
    const time = new Date().toISOString()
    const expires = new Date(Date.now() + (body.expiresInSeconds ?? 86_400) * 1000).toISOString()

    const payload: Record<string, unknown> = {
      symbol,
      type: direction.toUpperCase() === 'BUY' ? 'POSITION_TYPE_BUY' : 'POSITION_TYPE_SELL',
      time,
      volume,
      signalSource: 'HuMi Trade Idea',
    }
    if (body.stopLoss != null) payload.stopLoss = body.stopLoss
    if (body.takeProfit != null) payload.takeProfit = body.takeProfit
    if (body.comment) payload.comment = String(body.comment).slice(0, 27)
    payload.expirationTime = expires

    const url = `${COPYFACTORY_API_URL}/users/current/configuration/strategies/${strategyId}/external-signals/${signalId}`
    console.log('CopyFactory external signal PUT', url, payload)

    const resp = await fetch(url, {
      method: 'PUT',
      headers: {
        'auth-token': token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const text = await resp.text()
    if (resp.ok || resp.status === 204) {
      return json({ success: true, strategyId, signalId, details: safeParse(text) }, 200)
    }

    const err = safeParse(text)
    console.error('CopyFactory send-signal error', resp.status, text)
    return json(
      {
        success: false,
        error: err?.message || `CopyFactory returned ${resp.status}`,
        code: err?.id || 'COPYFACTORY_ERROR',
        details: err?.message || text,
      },
      400,
    )
  } catch (e) {
    console.error('Function error:', e)
    return json({ success: false, error: 'Unexpected error', details: String(e) }, 500)
  }
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
function safeParse(t: string): any {
  try { return JSON.parse(t) } catch { return { message: t } }
}

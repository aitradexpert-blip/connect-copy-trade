import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const API = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai'
const MAX_AGE_MS = 30 * 60 * 1000

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
function message(body: any) {
  return String(body?.message || body?.details || body?.error || 'MetaAPI request failed').slice(0, 500)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return response({ error: 'Method not allowed' }, 405)

  const token = Deno.env.get('METAAPI_TOKEN')
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!token || !url || !serviceKey) return response({ error: 'Worker is not configured' }, 500)
  const admin = createClient(url, serviceKey)

  let requestedId: string | null = null
  try {
    const body = await req.json()
    requestedId = body?.tradingAccountId || body?.accountId || null
  } catch { /* empty body is valid for batch */ }

  let query = admin.from('trading_accounts').select('id,metaapi_account_id,connection_status,metaapi_health_status,metaapi_last_error,metaapi_health_checked_at,created_at').eq('provider', 'metaapi').not('metaapi_account_id', 'is', null)
  if (requestedId) query = query.eq('id', requestedId)
  else query = query.or('connection_status.eq.provisioning,metaapi_health_status.in.(deploying,error,unknown)')
  const { data: accounts, error } = await query.order('metaapi_health_checked_at', { ascending: true, nullsFirst: true }).limit(requestedId ? 1 : 20)
  if (error) return response({ error: error.message }, 500)

  const results: any[] = []
  for (const account of accounts || []) {
    const checkedAt = account.metaapi_health_checked_at ? new Date(account.metaapi_health_checked_at).getTime() : new Date(account.created_at).getTime()
    const now = new Date().toISOString()
    try {
      const infoResp = await fetch(`${API}/users/current/accounts/${account.metaapi_account_id}`, { headers: { 'auth-token': token, Accept: 'application/json' } })
      if (!infoResp.ok) {
        const text = await infoResp.text()
        const err = message(JSON.parse(text || '{}'))
        const terminal = [401, 403, 404].includes(infoResp.status)
        await admin.from('trading_accounts').update({ connection_status: terminal ? 'needs_reconnect' : 'provisioning', metaapi_health_status: 'error', metaapi_last_error: err, metaapi_health_checked_at: now }).eq('id', account.id)
        results.push({ id: account.id, status: 'error', error: err })
        continue
      }
      const info = await infoResp.json()
      const state = String(info.state || '').toUpperCase()
      const connection = String(info.connectionStatus || '').toUpperCase()
      if (state === 'DEPLOYED' && connection === 'CONNECTED') {
        await admin.from('trading_accounts').update({ connection_status: 'connected', metaapi_health_status: 'healthy', metaapi_last_error: null, metaapi_health_checked_at: now }).eq('id', account.id)
        results.push({ id: account.id, status: 'healthy' })
        continue
      }
      if (Date.now() - checkedAt > MAX_AGE_MS) {
        const reason = `Provisioning timed out: state=${state || 'UNKNOWN'}; connectionStatus=${connection || 'UNKNOWN'}`
        await admin.from('trading_accounts').update({ connection_status: 'needs_reconnect', metaapi_health_status: 'error', metaapi_last_error: reason, metaapi_health_checked_at: now }).eq('id', account.id)
        results.push({ id: account.id, status: 'needs_reconnect', error: reason })
        continue
      }
      let nudge = 'none'
      if (state === 'UNDEPLOYED' || state === 'CREATED' || state === '') {
        const deploy = await fetch(`${API}/users/current/accounts/${account.metaapi_account_id}/deploy`, { method: 'POST', headers: { 'auth-token': token, Accept: 'application/json' } })
        nudge = deploy.ok ? 'deploy' : `deploy_failed_${deploy.status}`
      }
      const reason = `state=${state || 'UNKNOWN'}; connectionStatus=${connection || 'UNKNOWN'}; nudge=${nudge}`
      await admin.from('trading_accounts').update({ connection_status: 'provisioning', metaapi_health_status: 'deploying', metaapi_last_error: reason, metaapi_health_checked_at: now }).eq('id', account.id)
      results.push({ id: account.id, status: 'deploying', state, connectionStatus: connection, nudge })
    } catch (e) {
      const err = message(e)
      await admin.from('trading_accounts').update({ metaapi_health_status: 'error', metaapi_last_error: err, metaapi_health_checked_at: now }).eq('id', account.id)
      results.push({ id: account.id, status: 'error', error: err })
    }
  }
  return response({ success: true, processed: results.length, results })
})

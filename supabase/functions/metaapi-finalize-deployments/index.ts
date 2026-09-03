// Supabase Edge Function: metaapi-finalize-deployments
// Purpose: Follow-up worker that finishes MetaAPI provisioning.
// Provisioning itself only waits ~15s, so accounts can be left in
// state CREATED/DEPLOYING forever. This worker polls those accounts,
// nudges a deploy/redeploy, records the real state + error on the row,
// and gives up (needs_reconnect) after a grace period so they stop
// silently failing every publish.
//
// Trigger: pg_cron every 5 minutes, or on demand with { accountId } /
// { tradingAccountId } for a single row ("Check now" button).

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PROVISIONING_API_URL = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai'

// Accounts that have been "deploying" longer than this are parked.
const GIVE_UP_MINUTES = 30
const BATCH_SIZE = 20

const HARD_ERROR_RE = /E_AUTH|E_SERVER_NOT_FOUND|E_SERVER_TIMEZONE|ERR_OTP_REQUIRED|E_PASSWORD_CHANGE_REQUIRED|invalid (login|credential)/i

type Row = {
  id: string
  name: string | null
  login: string | null
  metaapi_account_id: string | null
  connection_status: string | null
  metaapi_health_status: string | null
  created_at: string
  updated_at: string
}

function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  return fetch(url, { ...init, signal: ctl.signal }).finally(() => clearTimeout(t))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })

  try {
    const token = Deno.env.get('METAAPI_TOKEN')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!token || !supabaseUrl || !serviceKey) {
      return json({ success: false, error: 'Server misconfiguration: missing METAAPI_TOKEN or Supabase env' }, 500)
    }
    const admin = createClient(supabaseUrl, serviceKey)

    let body: Record<string, unknown> = {}
    try { body = await req.json() } catch { /* cron sends no body */ }
    const singleMetaapiId = typeof body.accountId === 'string' ? body.accountId : null
    const singleRowId = typeof body.tradingAccountId === 'string' ? body.tradingAccountId : null

    // ---- Select candidates -------------------------------------------
    let query = admin
      .from('trading_accounts')
      .select('id,name,login,metaapi_account_id,connection_status,metaapi_health_status,created_at,updated_at')
      .eq('provider', 'metaapi')
      .not('metaapi_account_id', 'is', null)

    if (singleRowId) {
      query = query.eq('id', singleRowId)
    } else if (singleMetaapiId) {
      query = query.eq('metaapi_account_id', singleMetaapiId)
    } else {
      // Unfinished provisioning only — healthy/connected rows are left alone.
      query = query
        .or('connection_status.eq.provisioning,metaapi_health_status.eq.deploying,metaapi_health_status.is.null,metaapi_health_status.eq.unknown')
        .order('metaapi_health_checked_at', { ascending: true, nullsFirst: true })
        .limit(BATCH_SIZE)
    }

    const { data: rows, error: selErr } = await query
    if (selErr) return json({ success: false, error: selErr.message }, 500)

    const candidates = (rows || []) as Row[]
    const results: Array<Record<string, unknown>> = []

    for (const row of candidates) {
      const accountId = row.metaapi_account_id as string
      const checkedAt = new Date().toISOString()
      let state: string | null = null
      let connectionStatus: string | null = null
      let outcome = 'unknown'
      let detail = ''

      try {
        const resp = await fetchWithTimeout(
          `${PROVISIONING_API_URL}/users/current/accounts/${accountId}`,
          { headers: { 'auth-token': token, Accept: 'application/json' } },
          8000,
        )
        const text = await resp.text()

        if (resp.status === 404) {
          await admin.from('trading_accounts').update({
            connection_status: 'needs_reconnect',
            metaapi_health_status: 'error',
            metaapi_last_error: 'Account no longer exists on the trading bridge — reconnect it.',
            metaapi_health_checked_at: checkedAt,
          }).eq('id', row.id)
          results.push({ id: row.id, login: row.login, outcome: 'missing_on_bridge' })
          continue
        }

        if (!resp.ok) {
          const hard = HARD_ERROR_RE.test(text)
          await admin.from('trading_accounts').update({
            metaapi_health_status: 'error',
            metaapi_last_error: `Bridge ${resp.status}: ${text.slice(0, 300)}`,
            metaapi_health_checked_at: checkedAt,
            ...(hard ? { connection_status: 'needs_reconnect' } : {}),
          }).eq('id', row.id)
          results.push({ id: row.id, login: row.login, outcome: hard ? 'hard_error' : 'bridge_error', status: resp.status })
          continue
        }

        const data = JSON.parse(text)
        state = data.state ?? null
        connectionStatus = data.connectionStatus ?? null
        detail = `state=${state}, connectionStatus=${connectionStatus}`

        if (state === 'DEPLOYED' && connectionStatus === 'CONNECTED') {
          await admin.from('trading_accounts').update({
            connection_status: 'connected',
            metaapi_health_status: 'healthy',
            metaapi_last_error: null,
            metaapi_health_checked_at: checkedAt,
          }).eq('id', row.id)
          outcome = 'healthy'
        } else {
          // Not ready. Nudge it, unless we've been waiting too long.
          const waitedMs = Date.now() - new Date(row.updated_at || row.created_at).getTime()
          const gaveUp = waitedMs > GIVE_UP_MINUTES * 60_000

          if (state !== 'DEPLOYED') {
            const action = state === 'UNDEPLOYED' || state === 'CREATED' ? 'deploy' : 'redeploy'
            await fetchWithTimeout(
              `${PROVISIONING_API_URL}/users/current/accounts/${accountId}/${action}`,
              { method: 'POST', headers: { 'auth-token': token, Accept: 'application/json' } },
              8000,
            ).catch(() => {})
            detail += `, nudged=${action}`
          }

          if (gaveUp) {
            await admin.from('trading_accounts').update({
              connection_status: 'needs_reconnect',
              metaapi_health_status: 'error',
              metaapi_last_error: `Still not ready after ${GIVE_UP_MINUTES} min (${detail}). Reconnect with fresh credentials.`,
              metaapi_health_checked_at: checkedAt,
            }).eq('id', row.id)
            outcome = 'gave_up'
          } else {
            await admin.from('trading_accounts').update({
              connection_status: 'provisioning',
              metaapi_health_status: 'deploying',
              metaapi_last_error: `Broker terminal is still starting up (${detail}).`,
              metaapi_health_checked_at: checkedAt,
            }).eq('id', row.id)
            outcome = 'deploying'
          }
        }
      } catch (e) {
        await admin.from('trading_accounts').update({
          metaapi_health_status: 'error',
          metaapi_last_error: `Health check failed: ${String((e as Error)?.message || e).slice(0, 300)}`,
          metaapi_health_checked_at: checkedAt,
        }).eq('id', row.id)
        outcome = 'check_failed'
      }

      results.push({ id: row.id, login: row.login, name: row.name, state, connectionStatus, outcome, detail })
    }

    console.log(`finalize-deployments: examined ${results.length}`, JSON.stringify(results))
    return json({ success: true, examined: results.length, results })
  } catch (e) {
    console.error('finalize-deployments error:', e)
    return json({ success: false, error: String(e) }, 500)
  }
})

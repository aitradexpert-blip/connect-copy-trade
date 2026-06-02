// Supabase Edge Function: metaapi-provision-account
// Purpose: Provision MT4/MT5 accounts via MetaAPI Provisioning API with validation

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const PROVISIONING_API_URL = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai'

const ERROR_MESSAGES: Record<string, string> = {
  'E_AUTH': 'Invalid login credentials. Please check your login ID and password with your broker.',
  'E_SERVER_TIMEZONE': 'Broker server not reachable. Please verify the server name is correct.',
  'ERR_OTP_REQUIRED': 'Your MT terminal requires 2FA. Please disable two-factor authentication to connect.',
  'E_NO_SYMBOLS': 'No trading symbols enabled on this account. Please contact your broker.',
  'E_PASSWORD_CHANGE_REQUIRED': 'Your broker requires a password change. Please log into your MT terminal directly first.',
  'E_SERVER_NOT_FOUND': 'Server not found. Please check the server name matches your broker exactly.',
  'E_TIMEOUT': 'Connection timed out. The broker server may be temporarily unavailable.',
  'E_RESOURCE_SLOTS': 'Account resource limit reached. Please contact HuMi support for assistance.',
  'ValidationError': 'Invalid input. Please check all fields are filled correctly.',
}

function generateTransactionId(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const { login, password, server, platform, name } = await req.json()

    if (!login || !password || !server || !platform) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: login, password, server, platform',
        code: 'ValidationError'
      }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    if (!['mt4', 'mt5'].includes(platform.toLowerCase())) {
      return new Response(JSON.stringify({ 
        error: 'Platform must be "mt4" or "mt5"',
        code: 'ValidationError'
      }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const token = Deno.env.get('METAAPI_TOKEN')
    if (!token) {
      return new Response(JSON.stringify({ 
        error: 'Server misconfiguration: Trading bridge token not set',
        code: 'SERVER_ERROR'
      }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const loginDigits = String(login).replace(/\D/g, '')
    if (!loginDigits) {
      return new Response(JSON.stringify({
        error: 'Login must contain digits (MT account number)',
        code: 'ValidationError',
      }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const transactionId = generateTransactionId()
    console.log(`Provisioning account: login=${loginDigits}, server=${server}, platform=${platform}`)

    // Heuristic broker keywords help MetaAPI route to the correct broker pool
    const serverLower = String(server).toLowerCase()
    const keywords: string[] = []
    if (serverLower.includes('octa')) keywords.push('Octa Markets')
    if (serverLower.includes('headway')) keywords.push('Headway')

    const magic = Math.floor(100000 + Math.random() * 899999)

    const provisionBody: Record<string, unknown> = {
      name: name || `HuMi-${loginDigits}`,
      type: 'cloud-g2',
      login: loginDigits,
      password: password,
      server: server,
      platform: platform.toLowerCase(),
      magic,
      quoteStreamingIntervalInSeconds: 2.5,
      reliability: 'high',
    }
    if (keywords.length) provisionBody.keywords = keywords

    const response = await fetch(`${PROVISIONING_API_URL}/users/current/accounts`, {
      method: 'POST',
      headers: {
        'auth-token': token,
        'transaction-id': transactionId,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(provisionBody),
    })

    const responseText = await response.text()
    console.log(`Response Status: ${response.status}`)

    // MetaAPI returns 202 while broker auto-detection runs — do not treat as success with an id
    if (response.status === 202) {
      let msg = 'MetaAPI is still detecting broker settings. Please wait about one minute and try again.'
      try {
        const d = JSON.parse(responseText)
        if (d?.message) msg = String(d.message)
      } catch { /* noop */ }
      return new Response(JSON.stringify({
        success: false,
        pending: true,
        error: msg,
        code: 'PENDING',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    if (response.ok) {
      const data = JSON.parse(responseText)
      let metaapiAccountId: string | undefined = data._id || data.id

      // Validate the returned ID is a real MetaAPI UUID
      if (!metaapiAccountId || !UUID_RE.test(metaapiAccountId)) {
        console.error('Invalid (non-UUID) account ID returned:', metaapiAccountId)

        // Try to look up by login/server
        try {
          const lookupResp = await fetch(`${PROVISIONING_API_URL}/users/current/accounts?query=${loginDigits}`, {
            headers: { 'auth-token': token, 'Accept': 'application/json' },
          })
          if (lookupResp.ok) {
            const accounts = await lookupResp.json()
            const match = accounts.find((a: any) => String(a.login) === loginDigits && a.server === server)
            const matchedId = match?._id || match?.id
            if (match && matchedId && UUID_RE.test(matchedId)) {
              metaapiAccountId = matchedId
            }
          }
        } catch (e) {
          console.warn('Lookup fallback failed:', e)
        }
      }

      if (!metaapiAccountId || !UUID_RE.test(metaapiAccountId)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Trading Bridge did not return a valid account ID. Please retry, verify your credentials, or contact support.',
          code: 'INVALID_ACCOUNT_ID',
        }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }

      const state = data.state || 'CREATED'
      console.log(`Account provisioned: id=${metaapiAccountId}, state=${state}`)

      // Wait up to 15s for deployment
      if (state !== 'DEPLOYED') {
        for (let i = 0; i < 5; i++) {
          await sleep(3000)
          try {
            const checkResp = await fetch(`${PROVISIONING_API_URL}/users/current/accounts/${metaapiAccountId}`, {
              headers: { 'auth-token': token, 'Accept': 'application/json' },
            })
            if (checkResp.ok) {
              const checkData = await checkResp.json()
              if (checkData.state === 'DEPLOYED') {
                return new Response(JSON.stringify({
                  success: true,
                  metaapi_account_id: metaapiAccountId,
                  state: 'DEPLOYED',
                  name: data.name,
                  connectionStatus: checkData.connectionStatus,
                  region: checkData.region,
                }), {
                  status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders },
                })
              }
            }
          } catch (e) { /* continue polling */ }
        }
      }

      return new Response(JSON.stringify({
        success: true,
        metaapi_account_id: metaapiAccountId,
        state: state,
        name: data.name,
        connectionStatus: data.connectionStatus,
        region: data.region,
      }), {
        status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    } else {
      let errorData
      try { errorData = JSON.parse(responseText) } catch { errorData = { message: responseText, id: 'UNKNOWN_ERROR' } }

      const errorCode = errorData.id || errorData.code || 'UNKNOWN_ERROR'
      const detailStr = typeof errorData.details === 'string' ? errorData.details : ''
      const userMessage =
        ERROR_MESSAGES[detailStr] ||
        ERROR_MESSAGES[String(errorCode)] ||
        errorData.message ||
        'Failed to connect account. Please try again.'

      console.error(`Error: code=${errorCode}, message=${errorData.message}`)

      return new Response(JSON.stringify({
        success: false,
        error: userMessage,
        code: errorCode,
        details: errorData.message,
      }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }
  } catch (e) {
    console.error('Function error:', e)
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Unexpected error occurred. Please try again.',
      code: 'SERVER_ERROR',
      details: String(e)
    }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})

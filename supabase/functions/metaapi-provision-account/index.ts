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

    const transactionId = generateTransactionId()
    console.log(`Provisioning account: login=${login}, server=${server}, platform=${platform}`)

    const response = await fetch(`${PROVISIONING_API_URL}/users/current/accounts`, {
      method: 'POST',
      headers: {
        'auth-token': token,
        'transaction-id': transactionId,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        name: name || `HuMi-${login}`,
        type: 'cloud-g2',
        login: login,
        password: password,
        server: server,
        platform: platform.toLowerCase(),
        magic: 0,
        quoteStreamingIntervalInSeconds: 2.5,
        reliability: 'high',
      }),
    })

    const responseText = await response.text()
    console.log(`Response Status: ${response.status}`)

    if (response.ok) {
      const data = JSON.parse(responseText)
      const metaapiAccountId = data._id || data.id

      // Validate the returned ID looks like a UUID (MetaAPI format)
      if (!metaapiAccountId || typeof metaapiAccountId !== 'string' || metaapiAccountId.length < 10) {
        console.error('Invalid account ID returned:', metaapiAccountId)
        
        // Try to look up by login/server
        try {
          const lookupResp = await fetch(`${PROVISIONING_API_URL}/users/current/accounts?query=${login}`, {
            headers: { 'auth-token': token, 'Accept': 'application/json' },
          })
          if (lookupResp.ok) {
            const accounts = await lookupResp.json()
            const match = accounts.find((a: any) => a.login === String(login) && a.server === server)
            if (match) {
              return new Response(JSON.stringify({
                success: true,
                metaapi_account_id: match._id || match.id,
                state: match.state || 'CREATED',
                name: match.name,
                connectionStatus: match.connectionStatus,
                region: match.region,
              }), {
                status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders },
              })
            }
          }
        } catch (e) {
          console.warn('Lookup fallback failed:', e)
        }
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
      const userMessage = ERROR_MESSAGES[errorCode] || errorData.message || 'Failed to connect account. Please try again.'

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

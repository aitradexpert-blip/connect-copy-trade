// Supabase Edge Function: metaapi-provision-account
// Purpose: Automatically provision MT4/MT5 accounts via MetaAPI's Provisioning API
// Called when user submits broker credentials to create a MetaAPI connection

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// MetaAPI Provisioning API URL (official domain per MetaAPI docs)
const PROVISIONING_API_URL = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai'

// Map MetaAPI error codes to user-friendly messages
const ERROR_MESSAGES: Record<string, string> = {
  'E_AUTH': 'Invalid login credentials. Please check your login ID and password with your broker.',
  'E_SERVER_TIMEZONE': 'Broker server not reachable. Please verify the server name is correct.',
  'ERR_OTP_REQUIRED': 'Your MT terminal requires 2FA. Please disable two-factor authentication to connect.',
  'E_NO_SYMBOLS': 'No trading symbols enabled on this account. Please contact your broker.',
  'E_PASSWORD_CHANGE_REQUIRED': 'Your broker requires a password change. Please log into your MT terminal directly first.',
  'E_SERVER_NOT_FOUND': 'Server not found. Please check the server name matches your broker exactly.',
  'E_TIMEOUT': 'Connection timed out. The broker server may be temporarily unavailable.',
  'ValidationError': 'Invalid input. Please check all fields are filled correctly.',
}

function generateTransactionId(): string {
  // Must be exactly 32 characters as per MetaAPI requirements
  return crypto.randomUUID().replace(/-/g, '')
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const { login, password, server, platform, name } = await req.json()

    // Validate required fields
    if (!login || !password || !server || !platform) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: login, password, server, platform',
        code: 'ValidationError'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Validate platform
    if (!['mt4', 'mt5'].includes(platform.toLowerCase())) {
      return new Response(JSON.stringify({ 
        error: 'Platform must be "mt4" or "mt5"',
        code: 'ValidationError'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const token = Deno.env.get('METAAPI_TOKEN')
    if (!token) {
      console.error('METAAPI_TOKEN not configured')
      return new Response(JSON.stringify({ 
        error: 'Server misconfiguration: MetaAPI token not set',
        code: 'SERVER_ERROR'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const transactionId = generateTransactionId()
    console.log(`Provisioning MetaAPI account: login=${login}, server=${server}, platform=${platform}`)
    console.log(`Transaction ID: ${transactionId} (length: ${transactionId.length})`)

    // Call MetaAPI Provisioning API to create account
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
    console.log(`MetaAPI Response Status: ${response.status}`)
    console.log(`MetaAPI Response: ${responseText}`)

    if (response.ok) {
      // Success - parse response
      const data = JSON.parse(responseText)
      const metaapiAccountId = data._id || data.id
      const state = data.state || 'CREATED'

      console.log(`Account provisioned successfully: id=${metaapiAccountId}, state=${state}`)

      return new Response(JSON.stringify({
        success: true,
        metaapi_account_id: metaapiAccountId,
        state: state,
        name: data.name,
        connectionStatus: data.connectionStatus,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    } else {
      // Error - parse and return user-friendly message
      let errorData
      try {
        errorData = JSON.parse(responseText)
      } catch {
        errorData = { message: responseText, id: 'UNKNOWN_ERROR' }
      }

      const errorCode = errorData.id || errorData.code || 'UNKNOWN_ERROR'
      const userMessage = ERROR_MESSAGES[errorCode] || errorData.message || 'Failed to connect account. Please try again.'

      console.error(`MetaAPI Error: code=${errorCode}, message=${errorData.message}`)

      return new Response(JSON.stringify({
        success: false,
        error: userMessage,
        code: errorCode,
        details: errorData.message,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
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
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})

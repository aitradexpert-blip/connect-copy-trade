// Supabase Edge Function: metaapi-enable-copy-factory
// Purpose: Enable CopyFactory API roles (PROVIDER/FOLLOWER) on a MetaAPI account

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CLIENT_API_URL = 'https://mt-client-api-v1.london.agiliumtrade.ai'

interface EnableCopyFactoryRequest {
  copyFactoryRoles: Array<'PROVIDER' | 'FOLLOWER'>
  copyFactoryResourceSlots?: number
}

Deno.serve(async (req) => {
  // Handle CORS preflight
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

    const { accountId, copyFactoryRoles = ['PROVIDER'], copyFactoryResourceSlots = 1 } = await req.json()

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

    const payload: EnableCopyFactoryRequest = {
      copyFactoryRoles: copyFactoryRoles as EnableCopyFactoryRequest['copyFactoryRoles'],
      copyFactoryResourceSlots,
    }

    console.log(`Enabling CopyFactory for account ${accountId}:`, payload)

    const resp = await fetch(`${CLIENT_API_URL}/users/current/accounts/${accountId}/enable-copy-factory-api`, {
      method: 'POST',
      headers: {
        'auth-token': token,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!resp.ok) {
      const text = await resp.text()
      console.error('MetaAPI enable-copy-factory error', resp.status, text)
      return new Response(JSON.stringify({
        error: 'Failed to enable CopyFactory',
        status: resp.status,
        details: text,
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const result = await resp.json()
    console.log('CopyFactory enabled successfully:', result)

    return new Response(JSON.stringify({
      success: true,
      message: 'CopyFactory enabled successfully',
      details: result,
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

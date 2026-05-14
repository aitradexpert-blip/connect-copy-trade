// Supabase Edge Function: metaapi-enable-copy-factory
// Purpose: Enable CopyFactory API roles (PROVIDER/SUBSCRIBER) on a MetaAPI account
//
// MetaAPI Documentation: https://metaapi.cloud/docs/provisioning/api/account/enableCopyFactoryApi/
// Endpoint: POST /users/current/accounts/:accountId/enable-copy-factory-api
// Note: Uses the PROVISIONING API, not the Client API

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// MetaAPI Provisioning API (same domain as provision-account)
const PROVISIONING_API_URL = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai'

interface EnableCopyFactoryRequest {
  accountId: string
  copyFactoryRoles: Array<'PROVIDER' | 'SUBSCRIBER'>
  copyFactoryResourceSlots?: number
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

    const body: EnableCopyFactoryRequest = await req.json()
    const { accountId, copyFactoryRoles = ['PROVIDER'], copyFactoryResourceSlots = 1 } = body

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

    const payload = {
      copyFactoryRoles,
      copyFactoryResourceSlots,
    }

    console.log(`Enabling CopyFactory for account ${accountId}:`, payload)

    // Use the Provisioning API endpoint
    const resp = await fetch(`${PROVISIONING_API_URL}/users/current/accounts/${accountId}/enable-copy-factory-api`, {
      method: 'POST',
      headers: {
        'auth-token': token,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    // 204 No Content is the success response
    if (resp.status === 204 || resp.ok) {
      console.log('CopyFactory enabled successfully for account:', accountId)

      return new Response(JSON.stringify({
        success: true,
        message: `CopyFactory ${copyFactoryRoles.join(', ')} role(s) enabled successfully`,
        accountId,
        roles: copyFactoryRoles,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const text = await resp.text()
    console.error('MetaAPI enable-copy-factory error', resp.status, text)

    let errorData
    try {
      errorData = JSON.parse(text)
    } catch {
      errorData = { message: text }
    }

    // Provide user-friendly error messages
    let userMessage = 'Failed to enable CopyFactory'
    if (errorData.message?.includes('already has copyFactoryRoles')) {
      // This is actually a success case - roles already enabled
      return new Response(JSON.stringify({
        success: true,
        message: 'CopyFactory roles already enabled for this account',
        accountId,
        roles: copyFactoryRoles,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    } else if (errorData.message?.includes('not found')) {
      userMessage = 'Account not found in MetaAPI. Please verify the account is properly provisioned.'
    } else if (errorData.message?.includes('not deployed')) {
      userMessage = 'Account is not fully deployed. Please wait for the account to be ready.'
    }

    return new Response(JSON.stringify({
      success: false,
      error: userMessage,
      status: resp.status,
      details: errorData.message || text,
    }), {
      status: 400,
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
// Supabase Edge Function: metaapi-get-history
// Purpose: Get trading history/deals from MetaAPI trading accounts

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CLIENT_API_URL = 'https://mt-client-api-v1.london.agiliumtrade.ai'

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

    const { accountId, startTime, endTime, limit } = await req.json()
    
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

    // Build query params
    const params = new URLSearchParams()
    
    // Default to last 7 days if no startTime provided
    const defaultStartTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    params.append('startTime', startTime || defaultStartTime)
    
    if (endTime) {
      params.append('endTime', endTime)
    }
    
    if (limit) {
      params.append('limit', String(limit))
    }

    console.log(`[metaapi-get-history] Fetching history for account ${accountId}`)

    // Fetch deal history (closed trades)
    const dealsResp = await fetch(
      `${CLIENT_API_URL}/users/current/accounts/${accountId}/history-deals/time/${params.get('startTime')}/${endTime || new Date().toISOString()}`,
      {
        headers: {
          'auth-token': token,
          'Accept': 'application/json',
        },
      }
    )

    if (!dealsResp.ok) {
      const text = await dealsResp.text()
      console.error('MetaAPI history error', dealsResp.status, text)
      
      // Try alternative endpoint for history orders
      const ordersResp = await fetch(
        `${CLIENT_API_URL}/users/current/accounts/${accountId}/history-orders/time/${params.get('startTime')}/${endTime || new Date().toISOString()}`,
        {
          headers: {
            'auth-token': token,
            'Accept': 'application/json',
          },
        }
      )
      
      if (!ordersResp.ok) {
        return new Response(JSON.stringify({ 
          error: 'Failed to fetch trading history', 
          status: dealsResp.status, 
          details: text 
        }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }
      
      const orders = await ordersResp.json()
      return new Response(JSON.stringify({ 
        history: Array.isArray(orders) ? orders : [],
        count: Array.isArray(orders) ? orders.length : 0,
        source: 'orders'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const deals = await dealsResp.json()
    
    // Format the history for consistent response
    const formattedHistory = Array.isArray(deals) ? deals.map((deal: any) => ({
      id: deal.id,
      type: deal.type,
      symbol: deal.symbol,
      volume: deal.volume,
      price: deal.price,
      profit: deal.profit,
      commission: deal.commission,
      swap: deal.swap,
      time: deal.time,
      comment: deal.comment,
      magic: deal.magic,
      reason: deal.reason,
      entryType: deal.entryType,
      positionId: deal.positionId,
    })) : []

    console.log(`[metaapi-get-history] Retrieved ${formattedHistory.length} deals`)

    return new Response(JSON.stringify({ 
      history: formattedHistory,
      count: formattedHistory.length,
      source: 'deals'
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

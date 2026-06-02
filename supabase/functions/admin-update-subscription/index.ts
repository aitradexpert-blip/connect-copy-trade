import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const payload = JSON.parse(atob(token.split('.')[1]))
    const adminId = payload.sub
    if (!adminId) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const roleResp = await fetch(
      `${supabaseUrl}/rest/v1/user_roles?user_id=eq.${adminId}&role=eq.admin&select=id`,
      { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
    )
    const roles = await roleResp.json()
    if (!roles?.length) {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin only' }), {
        status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const { user_id, plan_name } = await req.json()
    if (!user_id || !plan_name) {
      return new Response(JSON.stringify({ error: 'user_id and plan_name required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    if (plan_name === 'free') {
      // Delete subscription for free
      await fetch(`${supabaseUrl}/rest/v1/user_subscriptions?user_id=eq.${user_id}`, {
        method: 'DELETE',
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      })
    } else {
      const expiresAt = new Date()
      expiresAt.setMonth(expiresAt.getMonth() + 1)

      // Check if exists
      const checkResp = await fetch(
        `${supabaseUrl}/rest/v1/user_subscriptions?user_id=eq.${user_id}&select=id`,
        { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
      )
      const existing = await checkResp.json()

      if (existing?.length) {
        await fetch(`${supabaseUrl}/rest/v1/user_subscriptions?user_id=eq.${user_id}`, {
          method: 'PATCH',
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            plan_name,
            status: 'active',
            expires_at: expiresAt.toISOString(),
          }),
        })
      } else {
        await fetch(`${supabaseUrl}/rest/v1/user_subscriptions`, {
          method: 'POST',
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            user_id,
            plan_name,
            status: 'active',
            started_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
          }),
        })
      }
    }

    return new Response(JSON.stringify({ success: true, plan_name }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (e) {
    console.error('Error:', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})

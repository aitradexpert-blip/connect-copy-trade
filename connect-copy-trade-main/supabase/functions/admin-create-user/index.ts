import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json(401, { error: 'Unauthorized' })

    const token = authHeader.replace('Bearer ', '')
    let adminId: string | null = null
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      adminId = payload.sub
    } catch {
      return json(401, { error: 'Invalid token' })
    }
    if (!adminId) return json(401, { error: 'Invalid token' })

    // Check admin role
    const roleResp = await fetch(
      `${supabaseUrl}/rest/v1/user_roles?user_id=eq.${adminId}&role=eq.admin&select=id`,
      { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
    )
    const roles = await roleResp.json()
    if (!Array.isArray(roles) || !roles.length) {
      return json(403, { error: 'Forbidden: Admin only' })
    }

    const body = await req.json().catch(() => ({}))
    const { email, password, plan_name, display_name } = body || {}
    if (!email || !password) return json(400, { error: 'email and password required' })
    if (String(password).length < 6) return json(400, { error: 'Password must be at least 6 characters' })

    // Create auth user
    const createResp = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: display_name || String(email).split('@')[0] },
      }),
    })

    const createText = await createResp.text()
    if (!createResp.ok) {
      console.error('admin-create-user: auth create failed', createResp.status, createText)
      let detail = createText
      try { detail = JSON.parse(createText)?.msg ?? JSON.parse(createText)?.error_description ?? createText } catch {}
      return json(400, { error: 'Failed to create user', details: detail })
    }

    let newUser: any = {}
    try { newUser = JSON.parse(createText) } catch {}
    const userId = newUser?.id
    if (!userId) return json(500, { error: 'User created but no id returned', details: createText })

    const headersJson = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    }

    // Defensive: ensure profile row exists (in case auth trigger didn't run)
    await fetch(`${supabaseUrl}/rest/v1/profiles?on_conflict=user_id`, {
      method: 'POST',
      headers: headersJson,
      body: JSON.stringify({
        user_id: userId,
        display_name: display_name || String(email).split('@')[0],
      }),
    }).catch((e) => console.warn('profile upsert failed', e))

    // Subscription
    if (plan_name && plan_name !== 'free') {
      const expiresAt = new Date()
      expiresAt.setMonth(expiresAt.getMonth() + 1)
      const subResp = await fetch(`${supabaseUrl}/rest/v1/user_subscriptions`, {
        method: 'POST',
        headers: { ...headersJson, Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_id: userId,
          plan_name,
          status: 'active',
          started_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        }),
      })
      if (!subResp.ok) {
        const t = await subResp.text()
        console.warn('subscription insert failed', subResp.status, t)
      }
    }

    return json(200, { success: true, user_id: userId, email })
  } catch (e) {
    console.error('admin-create-user error:', e)
    return json(500, { error: String(e?.message || e) })
  }
})

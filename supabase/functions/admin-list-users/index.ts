// Supabase Edge Function: admin-list-users
// Purpose: Return auth.users list (id + email) for admin panel

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify the caller is an admin by checking their JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Verify admin role via user_roles table
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Decode the JWT to get user ID
    const token = authHeader.replace('Bearer ', '');
    const payloadBase64 = token.split('.')[1];
    const payload = JSON.parse(atob(payloadBase64));
    const userId = payload.sub;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Check admin role using service role key
    const roleResp = await fetch(
      `${supabaseUrl}/rest/v1/user_roles?user_id=eq.${userId}&role=eq.admin&select=id`,
      {
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
      }
    );
    const roles = await roleResp.json();
    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin only' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Fetch all users from auth.users via Admin API
    const usersResp = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, {
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
    });

    if (!usersResp.ok) {
      const text = await usersResp.text();
      console.error('Failed to fetch auth users:', usersResp.status, text);
      return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const usersData = await usersResp.json();
    const users = (usersData.users || []).map((u: any) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
    }));

    return new Response(JSON.stringify({ users }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    console.error('Function error:', e);
    return new Response(JSON.stringify({ error: 'Unexpected error', message: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
})

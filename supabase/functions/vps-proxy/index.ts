import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Which VPS routes the browser is allowed to reach, and how each is called.
const ROUTES: Record<string, { method: 'GET' | 'POST'; ownerField?: string }> = {
  health: { method: 'GET' },
  connect: { method: 'POST', ownerField: 'account_id' },
  account: { method: 'GET', ownerField: 'account_id' },
  positions: { method: 'GET', ownerField: 'account_id' },
  history: { method: 'GET', ownerField: 'account_id' },
  order: { method: 'POST', ownerField: 'accountId' },
  'copy-trade': { method: 'POST', ownerField: 'master_account_id' },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1) Require a real, logged-in HuMi user — no VPS secret ever touches the browser.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2) Validate the requested VPS route.
    const { path, body } = await req.json();
    const route = ROUTES[path];
    if (!route) {
      return new Response(JSON.stringify({ error: `Unknown or disallowed path: ${path}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3) Ownership check — the account/master account being touched must
    // belong to the calling user, using the service role (bypasses RLS
    // deliberately, since this IS the authorization check).
    const accountId = route.ownerField ? body?.[route.ownerField] : undefined;
    if (accountId) {
      const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { data: acc } = await serviceClient
        .from('trading_accounts')
        .select('user_id')
        .eq('id', accountId)
        .maybeSingle();
      if (!acc || acc.user_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Account does not belong to this user' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 4) Forward to the VPS, attaching the real secret server-side only.
    const VPS_URL = (Deno.env.get('VPS_API_URL') || '').replace(/\/+$/, '');
    const VPS_SECRET = Deno.env.get('VPS_API_SECRET') || '';
    if (!VPS_URL || !VPS_SECRET) {
      return new Response(JSON.stringify({ error: 'VPS not configured on server' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let url = `${VPS_URL}/${path}`;
    if (route.method === 'GET') {
      const qs = new URLSearchParams();
      if (accountId) qs.set('id', accountId);
      if (path === 'history') {
        if (body?.from) qs.set('from', body.from);
        if (body?.to) qs.set('to', body.to);
      }
      url += qs.toString() ? `?${qs.toString()}` : '';
    }

    const vpsRes = await fetch(url, {
      method: route.method,
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'x-vps-secret': VPS_SECRET,
      },
      body: route.method === 'POST' ? JSON.stringify(body) : undefined,
    });

    const vpsData = await vpsRes.json().catch(() => null);
    return new Response(JSON.stringify(vpsData), {
      status: vpsRes.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

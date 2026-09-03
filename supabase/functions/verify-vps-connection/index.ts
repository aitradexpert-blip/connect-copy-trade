import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { account_id } = await req.json();
    const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: account, error: acctErr } = await serviceClient
      .from('trading_accounts')
      .select('id, user_id, login, server, mt5_password')
      .eq('id', account_id)
      .maybeSingle();

    if (acctErr || !account || account.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Account not found or not yours' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!account.mt5_password) {
      return new Response(JSON.stringify({ success: false, needsCredentials: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const VPS_URL = (Deno.env.get('VPS_API_URL') || '').replace(/\/+$/, '');
    const VPS_SECRET = Deno.env.get('VPS_API_SECRET') || '';

    const vpsRes = await fetch(`${VPS_URL}/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'x-vps-secret': VPS_SECRET,
      },
      body: JSON.stringify({
        login: parseInt(account.login, 10),
        password: account.mt5_password,
        server: account.server,
        account_id: account.id,
      }),
    });

    const vpsData = await vpsRes.json().catch(() => null);

    const INVALID_CREDS_RE =
      /invalid\s+(account|credentials|password|login)|authorization\s+failed|auth\s+failed|wrong\s+password|login\s+failed|account\s+disabled/i;

    if (vpsData?.success) {
      await serviceClient.from('trading_accounts').update({
        connection_status: 'connected',
        balance: vpsData.data?.balance ?? 0,
        equity: vpsData.data?.equity ?? 0,
      }).eq('id', account_id);
    } else if (INVALID_CREDS_RE.test(String(vpsData?.error || ''))) {
      // Park the account so a bad login can never re-bind (and poison) the
      // shared MetaTrader terminal during fan-out.
      await serviceClient.from('trading_accounts').update({
        connection_status: 'invalid_credentials',
        metaapi_last_error: String(vpsData?.error).slice(0, 500),
      }).eq('id', account_id);
    }

    return new Response(JSON.stringify(vpsData), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

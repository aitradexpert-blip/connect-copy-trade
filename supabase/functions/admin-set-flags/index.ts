// Admin override: toggle mentor role and master-flag on trading accounts.
// Uses service-role to bypass RLS, but verifies the caller is an admin first.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return json({ error: 'Missing bearer token' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes?.user) return json({ error: 'Invalid token' }, 401);
    const caller = userRes.user;

    const { data: isAdminRow } = await admin
      .from('user_roles')
      .select('id')
      .eq('user_id', caller.id)
      .eq('role', 'admin')
      .maybeSingle();
    if (!isAdminRow) return json({ error: 'Forbidden — admin only' }, 403);

    const body = await req.json().catch(() => ({}));
    const { action, target_user_id, target_account_id, value } = body || {};

    if (action === 'set_mentor') {
      if (!target_user_id) return json({ error: 'target_user_id required' }, 400);
      if (value === true) {
        const { data: u } = await admin.auth.admin.getUserById(target_user_id);
        const email = u?.user?.email || null;
        const { error } = await admin
          .from('user_roles')
          .upsert(
            { user_id: target_user_id, email, role: 'mentor' } as any,
            { onConflict: 'user_id,role', ignoreDuplicates: true } as any,
          );
        if (error) return json({ error: error.message }, 500);
      } else {
        const { error } = await admin
          .from('user_roles')
          .delete()
          .eq('user_id', target_user_id)
          .eq('role', 'mentor');
        if (error) return json({ error: error.message }, 500);
      }
      return json({ ok: true, action, target_user_id, value: !!value });
    }

    if (action === 'set_master') {
      if (!target_account_id) return json({ error: 'target_account_id required' }, 400);
      if (value === true) {
        const { data: account, error: accountError } = await admin
          .from('trading_accounts')
          .select('user_id')
          .eq('id', target_account_id)
          .maybeSingle();
        if (accountError) return json({ error: accountError.message }, 500);
        if (!account?.user_id) return json({ error: 'Target trading account not found' }, 404);

        const { data: mentorProfile, error: mentorError } = await admin
          .from('mentor_profiles')
          .select('id')
          .eq('user_id', account.user_id)
          .maybeSingle();
        if (mentorError) return json({ error: mentorError.message }, 500);
        if (!mentorProfile) return json({ error: 'Target account owner must have a mentor profile before enabling Master status' }, 400);
      }

      const { error } = await admin
        .from('trading_accounts')
        .update({ is_master: !!value })
        .eq('id', target_account_id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, action, target_account_id, value: !!value });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

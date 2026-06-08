
-- 1. app_settings: restrict reads to authenticated users
DROP POLICY IF EXISTS "Anyone can read app_settings" ON public.app_settings;
CREATE POLICY "Authenticated can read app_settings"
  ON public.app_settings FOR SELECT
  TO authenticated USING (true);

-- 2. mentor_profiles: hide admin_notes from client roles
REVOKE SELECT (admin_notes) ON public.mentor_profiles FROM anon, authenticated;

-- 3. trading_accounts: hide deriv_token from client roles (served only via edge functions / service role)
REVOKE SELECT (deriv_token) ON public.trading_accounts FROM anon, authenticated;
REVOKE UPDATE (deriv_token) ON public.trading_accounts FROM anon;

-- 4. pending_subscriptions: drop overly permissive USING(true)/WITH CHECK(true) ALL policy
DROP POLICY IF EXISTS "Service role full access" ON public.pending_subscriptions;
-- Service role bypasses RLS automatically; no policy needed for it.

-- 5. public_master_accounts view: recreate with security_invoker so RLS of caller applies
DROP VIEW IF EXISTS public.public_master_accounts;
CREATE VIEW public.public_master_accounts
  WITH (security_invoker = true) AS
  SELECT id, name, platform, provider, balance, is_master, created_at,
         login AS display_id, user_id, is_virtual
  FROM public.trading_accounts
  WHERE is_master = true;
GRANT SELECT ON public.public_master_accounts TO anon, authenticated;

-- 6. realtime.messages: enable RLS and require authentication to subscribe
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can use realtime" ON realtime.messages;
CREATE POLICY "Authenticated can use realtime"
  ON realtime.messages FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can publish realtime" ON realtime.messages;
CREATE POLICY "Authenticated can publish realtime"
  ON realtime.messages FOR INSERT
  TO authenticated WITH CHECK (true);

-- 7. Revoke EXECUTE on SECURITY DEFINER helpers from anon/authenticated where not needed for client calls.
-- Trigger-only functions never need a client EXECUTE privilege; triggers run as table owner.
REVOKE EXECUTE ON FUNCTION public.attach_default_mentor_to_signal()        FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_account_quota()                    FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_default_wallets()                 FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_master_user_id()                 FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                        FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.link_default_mentor()                    FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_account_connected()               FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_bot_assignment()                  FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_new_signal()                      FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_subscription_change()             FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_trade_executed()                  FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_mentor_role()                       FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_expired_pending_trades()          FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_monthly_limits()                   FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_subscription_quota(uuid, text, integer) FROM anon, authenticated, PUBLIC;

-- has_role and has_subscription_access ARE callable by clients and used inside policies — leave their grants alone.

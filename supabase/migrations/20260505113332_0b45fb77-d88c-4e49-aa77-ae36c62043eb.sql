
-- 1. trading_accounts: drop the over-permissive master policy
DROP POLICY IF EXISTS "Users can view master accounts for copy trading" ON public.trading_accounts;

-- Recreate the public_master_accounts view with only safe fields and grant access to authenticated users.
DROP VIEW IF EXISTS public.public_master_accounts;
CREATE VIEW public.public_master_accounts
WITH (security_invoker = false) AS
SELECT id, name, platform, provider, balance, is_master, created_at,
       login AS display_id, user_id, is_virtual
FROM public.trading_accounts
WHERE is_master = true;

GRANT SELECT ON public.public_master_accounts TO anon, authenticated;

-- 2. subscription_usage_events: restrict INSERT to service role only
DROP POLICY IF EXISTS "System can insert usage events" ON public.subscription_usage_events;
CREATE POLICY "Service role can insert usage events"
ON public.subscription_usage_events
FOR INSERT
TO service_role
WITH CHECK (true);

-- 3. pending_subscriptions: remove anonymous select
DROP POLICY IF EXISTS "Allow anonymous select by email" ON public.pending_subscriptions;

-- 4. mentor_profiles: hide admin_notes column from client roles
REVOKE SELECT ON public.mentor_profiles FROM anon, authenticated;
GRANT SELECT (
  id, user_id, brand_name, referral_slug, landing_page_slug,
  landing_page_media_type, landing_page_media_url, logo_url,
  feature_renames, ui_config, is_active, created_at, updated_at
) ON public.mentor_profiles TO anon, authenticated;

-- 5. mentor_clients: only authenticated user can insert their own link
DROP POLICY IF EXISTS "Anyone can insert mentor client record" ON public.mentor_clients;
CREATE POLICY "Users can link themselves to a mentor"
ON public.mentor_clients
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = client_user_id);

-- 6. enforce_metaapi_consistency: fixed search_path
CREATE OR REPLACE FUNCTION public.enforce_metaapi_consistency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.provider = 'metaapi'
     AND COALESCE(NEW.connection_status, '') NOT IN ('failed', 'disconnected', 'provisioning')
     AND (NEW.metaapi_account_id IS NULL OR NEW.metaapi_account_id = '') THEN
    RAISE EXCEPTION 'metaapi_account_id required for connected provider=metaapi';
  END IF;
  IF NEW.provider = 'metaapi' THEN
    NEW.connection_type := 'metaapi';
  END IF;
  RETURN NEW;
END;
$function$;

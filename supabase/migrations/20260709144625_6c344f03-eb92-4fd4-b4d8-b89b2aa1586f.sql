
-- 1) Fix mutable search_path on generate_referral_slug
ALTER FUNCTION public.generate_referral_slug() SET search_path = public;

-- 2) Lock down SECURITY DEFINER function EXECUTE grants
-- dispatch_push_notification is trigger-only; no API role needs EXECUTE
REVOKE ALL ON FUNCTION public.dispatch_push_notification() FROM PUBLIC, anon, authenticated;

-- has_role and has_subscription_access are called by RLS policies; keep authenticated,
-- revoke PUBLIC/anon so unauthenticated callers cannot execute them.
REVOKE ALL ON FUNCTION public.has_role(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_subscription_access(uuid, text) FROM PUBLIC, anon;

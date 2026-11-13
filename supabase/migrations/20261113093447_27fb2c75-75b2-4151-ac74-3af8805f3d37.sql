REVOKE EXECUTE ON FUNCTION public.protect_affiliate_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_affiliate_commission() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_payout_verification() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_mentor_subscriptions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_mentor_subscription(uuid) FROM PUBLIC, anon;
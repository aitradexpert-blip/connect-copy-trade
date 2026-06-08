
DROP POLICY IF EXISTS "Allow anonymous insert" ON public.pending_subscriptions;
CREATE POLICY "Anon can create pending subscription"
  ON public.pending_subscriptions FOR INSERT
  TO anon, authenticated
  WITH CHECK (email IS NOT NULL AND length(email) > 3);

DROP POLICY IF EXISTS "Service role can insert usage events" ON public.subscription_usage_events;
-- Service role bypasses RLS; no policy needed. Authenticated/anon should not insert directly.

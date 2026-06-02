-- Fix existing inconsistent rows
UPDATE trading_accounts SET connection_type = 'metaapi' WHERE provider = 'metaapi' AND connection_type != 'metaapi';

-- Enforce metaapi consistency trigger
CREATE OR REPLACE FUNCTION public.enforce_metaapi_consistency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.provider = 'metaapi' AND (NEW.metaapi_account_id IS NULL OR NEW.metaapi_account_id = '') THEN
    RAISE EXCEPTION 'metaapi_account_id required for provider=metaapi';
  END IF;
  IF NEW.provider = 'metaapi' THEN
    NEW.connection_type := 'metaapi';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_metaapi_consistency
BEFORE INSERT OR UPDATE ON trading_accounts
FOR EACH ROW EXECUTE FUNCTION public.enforce_metaapi_consistency();

-- Subscription usage events table
CREATE TABLE IF NOT EXISTS public.subscription_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  feature_key TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  cycle_start TIMESTAMPTZ NOT NULL,
  cycle_end TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.subscription_usage_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_usage_events_user_feature_cycle 
ON public.subscription_usage_events (user_id, feature_key, cycle_start);

CREATE POLICY "Users can view own usage events"
ON public.subscription_usage_events FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all usage events"
ON public.subscription_usage_events FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert usage events"
ON public.subscription_usage_events FOR INSERT
WITH CHECK (true);

-- Quota consumption function
CREATE OR REPLACE FUNCTION public.consume_subscription_quota(
  p_user_id UUID,
  p_feature_key TEXT,
  p_quantity INTEGER DEFAULT 1
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan_name TEXT;
  v_limit INTEGER;
  v_used INTEGER;
  v_cycle_start TIMESTAMPTZ;
  v_cycle_end TIMESTAMPTZ;
BEGIN
  SELECT us.plan_name INTO v_plan_name
  FROM user_subscriptions us
  WHERE us.user_id = p_user_id AND us.status = 'active'
  ORDER BY us.created_at DESC LIMIT 1;

  IF v_plan_name IS NULL THEN
    v_plan_name := 'Free';
  END IF;

  IF p_feature_key = 'trading_account_additions' THEN
    v_limit := CASE lower(v_plan_name)
      WHEN 'free' THEN 1
      WHEN 'basic' THEN 2
      WHEN 'professional' THEN 5
      WHEN 'enterprise' THEN 10
      WHEN 'mentor' THEN 10
      ELSE 1
    END;
  ELSIF p_feature_key = 'copy_connections' THEN
    v_limit := CASE lower(v_plan_name)
      WHEN 'free' THEN 0
      WHEN 'basic' THEN 1
      WHEN 'professional' THEN 5
      WHEN 'enterprise' THEN 10
      WHEN 'mentor' THEN 10
      ELSE 0
    END;
  ELSE
    v_limit := 999;
  END IF;

  v_cycle_start := date_trunc('month', now());
  v_cycle_end := date_trunc('month', now()) + interval '1 month';

  SELECT COALESCE(SUM(quantity), 0) INTO v_used
  FROM subscription_usage_events
  WHERE user_id = p_user_id AND feature_key = p_feature_key
    AND cycle_start = v_cycle_start;

  IF (v_used + p_quantity) > v_limit THEN
    RAISE EXCEPTION 'Quota exceeded for % (used: %, limit: % on % plan)', 
      p_feature_key, v_used, v_limit, v_plan_name;
  END IF;

  INSERT INTO subscription_usage_events (user_id, feature_key, quantity, cycle_start, cycle_end, source)
  VALUES (p_user_id, p_feature_key, p_quantity, v_cycle_start, v_cycle_end, 'trigger');
END;
$$;

-- Trigger to enforce account quota on insert
CREATE OR REPLACE FUNCTION public.check_account_quota()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.consume_subscription_quota(NEW.user_id, 'trading_account_additions', 1);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

CREATE TRIGGER enforce_account_quota
BEFORE INSERT ON trading_accounts
FOR EACH ROW EXECUTE FUNCTION public.check_account_quota();

-- Mentor profile additions
ALTER TABLE public.mentor_profiles ADD COLUMN IF NOT EXISTS landing_page_media_url TEXT;
ALTER TABLE public.mentor_profiles ADD COLUMN IF NOT EXISTS landing_page_media_type TEXT;
ALTER TABLE public.mentor_profiles ADD COLUMN IF NOT EXISTS landing_page_slug TEXT UNIQUE;
ALTER TABLE public.mentor_profiles ADD COLUMN IF NOT EXISTS ui_config JSONB DEFAULT '{}';
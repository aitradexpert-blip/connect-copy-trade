
-- Replace check_account_quota to count LIVE rows instead of cumulative events.
-- This fixes the bug where failed VPS/MetaAPI attempts permanently consumed quota
-- even after the ghost placeholder row was deleted.
CREATE OR REPLACE FUNCTION public.check_account_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan_name TEXT;
  v_limit INTEGER;
  v_current INTEGER;
  v_is_mentor BOOLEAN := false;
BEGIN
  -- Mentors always get unlimited account connections (grace-period aware).
  SELECT EXISTS (
    SELECT 1 FROM public.mentor_profiles mp
    WHERE mp.user_id = NEW.user_id AND mp.is_active = true
  ) INTO v_is_mentor;

  IF v_is_mentor OR public.has_role(NEW.user_id, 'admin') OR public.has_role(NEW.user_id, 'mentor') THEN
    RETURN NEW;
  END IF;

  SELECT plan_name INTO v_plan_name
  FROM public.user_subscriptions
  WHERE user_id = NEW.user_id AND status = 'active'
  ORDER BY created_at DESC LIMIT 1;

  IF v_plan_name IS NULL THEN v_plan_name := 'free'; END IF;

  v_limit := CASE lower(v_plan_name)
    WHEN 'free'         THEN 1
    WHEN 'basic'        THEN 2
    WHEN 'professional' THEN 5
    WHEN 'enterprise'   THEN 10
    WHEN 'mentor'       THEN 999
    ELSE 1
  END;

  SELECT COUNT(*) INTO v_current
  FROM public.trading_accounts
  WHERE user_id = NEW.user_id;

  IF v_current >= v_limit THEN
    RAISE EXCEPTION 'Quota exceeded for trading_account_additions (current: %, limit: % on % plan)',
      v_current, v_limit, v_plan_name;
  END IF;

  RETURN NEW;
END;
$$;

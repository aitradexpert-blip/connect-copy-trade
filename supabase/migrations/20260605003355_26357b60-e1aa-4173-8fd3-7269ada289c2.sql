-- 1) AI bot subscriptions: account-scoped, optional mentor filter
ALTER TABLE public.ai_bot_assignments
  ADD COLUMN IF NOT EXISTS subscription_mentor_id uuid REFERENCES public.mentor_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.ai_bot_assignments
  ALTER COLUMN signal_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aiba_subscription
  ON public.ai_bot_assignments (status, auto_execute, subscription_mentor_id)
  WHERE signal_id IS NULL;

-- 2) Backfill broken copy relationships where master_user_id was set to follower
UPDATE public.copy_trading_relationships r
   SET master_user_id = a.user_id
  FROM public.trading_accounts a
 WHERE r.master_account_id = a.id
   AND (r.master_user_id IS NULL OR r.master_user_id = r.follower_user_id)
   AND a.user_id IS NOT NULL
   AND a.user_id <> r.follower_user_id;

-- 3) Enforce master_user_id server-side on insert/update
CREATE OR REPLACE FUNCTION public.enforce_master_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_master_user uuid;
BEGIN
  IF NEW.master_account_id IS NOT NULL THEN
    SELECT user_id INTO v_master_user
      FROM public.trading_accounts
     WHERE id = NEW.master_account_id;
    IF v_master_user IS NOT NULL THEN
      NEW.master_user_id := v_master_user;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_master_user_id ON public.copy_trading_relationships;
CREATE TRIGGER trg_enforce_master_user_id
BEFORE INSERT OR UPDATE OF master_account_id ON public.copy_trading_relationships
FOR EACH ROW EXECUTE FUNCTION public.enforce_master_user_id();
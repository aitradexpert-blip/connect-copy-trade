
-- Relax the consistency trigger so failed accounts can have a null metaapi_account_id
CREATE OR REPLACE FUNCTION public.enforce_metaapi_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
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
$$;

-- Re-run the migration
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read app_settings" ON public.app_settings;
CREATE POLICY "Anyone can read app_settings"
  ON public.app_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage app_settings" ON public.app_settings;
CREATE POLICY "Admins can manage app_settings"
  ON public.app_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

INSERT INTO public.app_settings (key, value)
VALUES ('default_mentor_slug', 'apex-copy-trading-m9ef')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.trading_accounts
  ADD COLUMN IF NOT EXISTS copyfactory_strategy_id text,
  ADD COLUMN IF NOT EXISTS metaapi_health_status text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS metaapi_last_error text,
  ADD COLUMN IF NOT EXISTS metaapi_health_checked_at timestamptz;

ALTER TABLE public.copy_trading_relationships
  ADD COLUMN IF NOT EXISTS copyfactory_subscriber_id text;

UPDATE public.trading_accounts
SET 
  metaapi_account_id = NULL,
  connection_status = 'failed',
  metaapi_health_status = 'metaapi_deprovisioned',
  metaapi_last_error = 'Account was never properly provisioned (invalid MetaAPI ID). Please reconnect.'
WHERE metaapi_account_id IS NOT NULL
  AND metaapi_account_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

CREATE OR REPLACE FUNCTION public.link_default_mentor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default_slug text;
  v_mentor_id uuid;
  v_existing uuid;
BEGIN
  SELECT id INTO v_existing FROM mentor_clients WHERE client_user_id = NEW.user_id LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN NEW; END IF;

  SELECT value INTO v_default_slug FROM app_settings WHERE key = 'default_mentor_slug';
  IF v_default_slug IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_mentor_id FROM mentor_profiles
  WHERE referral_slug = v_default_slug AND is_active = true LIMIT 1;
  IF v_mentor_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO mentor_clients (mentor_id, client_user_id, referral_slug_used)
  VALUES (v_mentor_id, NEW.user_id, v_default_slug)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS link_default_mentor_on_profile_insert ON public.profiles;
CREATE TRIGGER link_default_mentor_on_profile_insert
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.link_default_mentor();

INSERT INTO public.mentor_clients (mentor_id, client_user_id, referral_slug_used)
SELECT mp.id, p.user_id, mp.referral_slug
FROM public.profiles p
CROSS JOIN LATERAL (
  SELECT id, referral_slug FROM public.mentor_profiles
  WHERE referral_slug = (SELECT value FROM public.app_settings WHERE key = 'default_mentor_slug')
    AND is_active = true LIMIT 1
) mp
WHERE NOT EXISTS (
  SELECT 1 FROM public.mentor_clients mc WHERE mc.client_user_id = p.user_id
);

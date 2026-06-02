
-- ============================================================
-- 1. Knowledge base for Khumo AI grounding
-- ============================================================
CREATE TABLE IF NOT EXISTS public.khumo_knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  content text NOT NULL,
  source text,
  difficulty text NOT NULL DEFAULT 'beginner',
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.khumo_knowledge_base ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read knowledge base" ON public.khumo_knowledge_base;
CREATE POLICY "Anyone can read knowledge base" ON public.khumo_knowledge_base FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage knowledge base" ON public.khumo_knowledge_base;
CREATE POLICY "Admins manage knowledge base" ON public.khumo_knowledge_base FOR ALL
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_khumo_kb_keywords ON public.khumo_knowledge_base USING GIN (keywords);

-- ============================================================
-- 2. OctaFx promo claims
-- ============================================================
CREATE TABLE IF NOT EXISTS public.octafx_promo_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  link_variant text NOT NULL,                -- 'new_user' or 'existing_user'
  account_login text,
  deposit_amount_usd numeric,
  status text NOT NULL DEFAULT 'pending',    -- pending | verified | rejected
  basic_plan_granted_at timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.octafx_promo_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users insert own promo claim" ON public.octafx_promo_claims;
CREATE POLICY "Users insert own promo claim" ON public.octafx_promo_claims
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users view own promo claim" ON public.octafx_promo_claims;
CREATE POLICY "Users view own promo claim" ON public.octafx_promo_claims
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own pending promo claim" ON public.octafx_promo_claims;
CREATE POLICY "Users update own pending promo claim" ON public.octafx_promo_claims
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');
DROP POLICY IF EXISTS "Admins manage promo claims" ON public.octafx_promo_claims;
CREATE POLICY "Admins manage promo claims" ON public.octafx_promo_claims FOR ALL
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_octafx_claims_updated
  BEFORE UPDATE ON public.octafx_promo_claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. Auto-stamp default mentor on admin-published signals
-- ============================================================
-- Make sure default_mentor_user_id is configured (best effort)
INSERT INTO public.app_settings (key, value)
SELECT 'default_mentor_user_id', mp.user_id::text
FROM public.mentor_profiles mp
JOIN public.app_settings s ON s.key = 'default_mentor_slug'
WHERE mp.referral_slug = s.value
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.attach_default_mentor_to_signal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default_user_id uuid;
  v_default_profile_id uuid;
  v_caller uuid;
BEGIN
  -- Only act when no mentor is attached yet
  IF NEW.mentor_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve default mentor user (cached in app_settings)
  SELECT value::uuid INTO v_default_user_id
  FROM public.app_settings WHERE key = 'default_mentor_user_id';

  IF v_default_user_id IS NULL THEN
    SELECT mp.user_id INTO v_default_user_id
    FROM public.mentor_profiles mp
    JOIN public.app_settings s ON s.key = 'default_mentor_slug'
    WHERE mp.referral_slug = s.value
    LIMIT 1;
  END IF;

  IF v_default_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only stamp when the signal author IS the default mentor (or an admin)
  IF v_caller = v_default_user_id OR has_role(v_caller, 'admin') THEN
    SELECT id INTO v_default_profile_id
    FROM public.mentor_profiles
    WHERE user_id = v_default_user_id AND is_active = true
    LIMIT 1;

    IF v_default_profile_id IS NOT NULL THEN
      NEW.mentor_id := v_default_profile_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attach_default_mentor_signal ON public.trading_signals;
CREATE TRIGGER attach_default_mentor_signal
  BEFORE INSERT ON public.trading_signals
  FOR EACH ROW EXECUTE FUNCTION public.attach_default_mentor_to_signal();

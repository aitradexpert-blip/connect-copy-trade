
-- ============ PHASE 7: Notice Board ============
CREATE TYPE public.announcement_audience AS ENUM ('all', 'mentor_hub', 'mentor_center', 'admins');

CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  audience public.announcement_audience NOT NULL DEFAULT 'all',
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active announcements"
  ON public.announcements FOR SELECT
  USING (
    is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at > now())
  );

CREATE POLICY "Admins can read all announcements"
  ON public.announcements FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert announcements"
  ON public.announcements FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update announcements"
  ON public.announcements FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete announcements"
  ON public.announcements FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_announcements_active ON public.announcements (is_active, starts_at, ends_at);

-- ============ PHASE 5: POPIA Consent ============
CREATE TABLE public.user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type text NOT NULL,           -- 'signup', 'copy_trading', 'ai_bot', 'trade_idea', 'payment'
  document_version text NOT NULL DEFAULT '2026-06-08',
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb
);

GRANT SELECT, INSERT ON public.user_consents TO authenticated;
GRANT ALL ON public.user_consents TO service_role;

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own consents"
  ON public.user_consents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can record their own consent"
  ON public.user_consents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all consents"
  ON public.user_consents FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_user_consents_user ON public.user_consents (user_id, consent_type, accepted_at DESC);

-- ============ PHASE 4: EFT proof extensions ============
ALTER TABLE public.payment_proofs
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS telegram_forwarded_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'eft';

-- ============ PHASE 6: Promote mphoforex5 to mentor ============
INSERT INTO public.user_roles (user_id, email, role)
SELECT id, email, 'mentor'
FROM auth.users
WHERE email = 'mphoforex5@gmail.com'
ON CONFLICT DO NOTHING;

-- Ensure an active mentor_profile exists for them
INSERT INTO public.mentor_profiles (user_id, brand_name, referral_slug, is_active)
SELECT
  u.id,
  COALESCE(p.display_name, 'HuMi Mentor'),
  'humi-mentor',
  true
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE u.email = 'mphoforex5@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM public.mentor_profiles mp WHERE mp.user_id = u.id);

-- Activate any existing mentor profile they have
UPDATE public.mentor_profiles
SET is_active = true
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'mphoforex5@gmail.com')
  AND is_active = false;

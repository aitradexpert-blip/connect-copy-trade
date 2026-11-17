CREATE TABLE public.academy_progress (
  user_id uuid PRIMARY KEY,
  lessons jsonb NOT NULL DEFAULT '{}'::jsonb,
  quizzes jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.academy_progress TO authenticated;
GRANT ALL ON public.academy_progress TO service_role;
ALTER TABLE public.academy_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own academy progress" ON public.academy_progress FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER academy_progress_updated BEFORE UPDATE ON public.academy_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.referral_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referred_user_id uuid NOT NULL UNIQUE,
  ref_code text NOT NULL,
  ref_type text NOT NULL,
  referrer_user_id uuid,
  idea_id uuid,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.referral_signups TO authenticated;
GRANT ALL ON public.referral_signups TO service_role;
ALTER TABLE public.referral_signups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "New user records own referral" ON public.referral_signups FOR INSERT TO authenticated WITH CHECK (auth.uid() = referred_user_id);
CREATE POLICY "Referrer, self and admins view" ON public.referral_signups FOR SELECT TO authenticated USING (auth.uid() = referred_user_id OR auth.uid() = referrer_user_id OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.set_referral_signup_referrer() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT user_id INTO NEW.referrer_user_id FROM mentor_profiles WHERE referral_slug = NEW.ref_code AND is_active = true LIMIT 1;
  IF NEW.referrer_user_id IS NOT NULL THEN NEW.ref_type := 'mentor';
  ELSE
    SELECT user_id INTO NEW.referrer_user_id FROM affiliates WHERE lower(referral_code) = lower(NEW.ref_code) AND status='active' LIMIT 1;
    NEW.ref_type := CASE WHEN NEW.referrer_user_id IS NULL THEN 'unknown' ELSE 'affiliate' END;
  END IF;
  IF NEW.referrer_user_id = NEW.referred_user_id THEN NEW.referrer_user_id := NULL; NEW.ref_type := 'self'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER referral_signups_referrer BEFORE INSERT ON public.referral_signups FOR EACH ROW EXECUTE FUNCTION public.set_referral_signup_referrer();

ALTER TABLE public.affiliate_commissions ADD COLUMN IF NOT EXISTS available_at timestamptz NOT NULL DEFAULT (now() + interval '1 day');
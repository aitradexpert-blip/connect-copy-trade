-- 1. Restore SELECT on mentor_profiles to authenticated/anon for safe (non-admin_notes) columns.
-- The previous tightening dropped table-level SELECT but the column grants only apply if SELECT is present.
GRANT SELECT (
  id, user_id, brand_name, referral_slug, landing_page_slug,
  landing_page_media_type, landing_page_media_url, logo_url,
  feature_renames, ui_config, is_active, created_at, updated_at
) ON public.mentor_profiles TO anon, authenticated;

GRANT INSERT, UPDATE ON public.mentor_profiles TO authenticated;

-- 2. Add unique constraint on user_id (one mentor profile per user) — guards upsert path.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mentor_profiles_user_id_key') THEN
    ALTER TABLE public.mentor_profiles ADD CONSTRAINT mentor_profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- 3. Harden handle_new_user — never break signup if profile already exists.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  BEGIN
    INSERT INTO public.profiles (user_id, display_name)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1))
    )
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

-- 4. Harden link_default_mentor — never break signup.
CREATE OR REPLACE FUNCTION public.link_default_mentor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_default_slug text;
  v_mentor_id uuid;
  v_existing uuid;
BEGIN
  BEGIN
    SELECT id INTO v_existing FROM public.mentor_clients WHERE client_user_id = NEW.id LIMIT 1;
    IF v_existing IS NOT NULL THEN RETURN NEW; END IF;

    SELECT value INTO v_default_slug FROM public.app_settings WHERE key = 'default_mentor_slug';
    IF v_default_slug IS NULL THEN RETURN NEW; END IF;

    SELECT id INTO v_mentor_id FROM public.mentor_profiles
    WHERE referral_slug = v_default_slug AND is_active = true LIMIT 1;
    IF v_mentor_id IS NULL THEN RETURN NEW; END IF;

    INSERT INTO public.mentor_clients (mentor_id, client_user_id, referral_slug_used)
    VALUES (v_mentor_id, NEW.id, v_default_slug)
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'link_default_mentor failed for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

-- 5. (Re)attach auth.users triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_created_link_default_mentor ON auth.users;
CREATE TRIGGER on_auth_user_created_link_default_mentor
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.link_default_mentor();

-- Also wallets trigger (referenced by create_default_wallets) so new users get default wallets
DROP TRIGGER IF EXISTS on_auth_user_created_wallets ON auth.users;
CREATE TRIGGER on_auth_user_created_wallets
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_default_wallets();

-- 6. Reassign the Khumo Copy AI mentor profile to the real main mentor account (mphoforex5@gmail.com).
-- Only do this if the target user has no mentor profile yet (avoids overwriting future profiles).
DO $$
DECLARE
  v_target_user uuid := '11a1db6b-5010-40d8-8f97-0ec6f8fea9e6'::uuid;
  v_khumo_profile uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.mentor_profiles WHERE user_id = v_target_user) THEN
    SELECT id INTO v_khumo_profile FROM public.mentor_profiles
      WHERE referral_slug = 'khumo-copy-ai-l99j' LIMIT 1;
    IF v_khumo_profile IS NOT NULL THEN
      UPDATE public.mentor_profiles
        SET user_id = v_target_user, is_active = true, updated_at = now()
        WHERE id = v_khumo_profile;
    END IF;
  END IF;
END $$;

-- 7. Point default_mentor_slug at the actual active Khumo mentor.
INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('default_mentor_slug', 'khumo-copy-ai-l99j', now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- 8. Backfill mentor_clients for existing direct HuMi users not yet linked.
INSERT INTO public.mentor_clients (mentor_id, client_user_id, referral_slug_used)
SELECT mp.id, p.user_id, mp.referral_slug
FROM public.profiles p
CROSS JOIN LATERAL (
  SELECT id, referral_slug FROM public.mentor_profiles
  WHERE referral_slug = (SELECT value FROM public.app_settings WHERE key='default_mentor_slug')
    AND is_active = true LIMIT 1
) mp
WHERE NOT EXISTS (SELECT 1 FROM public.mentor_clients mc WHERE mc.client_user_id = p.user_id)
  AND p.user_id <> '11a1db6b-5010-40d8-8f97-0ec6f8fea9e6'::uuid
ON CONFLICT DO NOTHING;
ALTER TABLE public.profiles
ADD COLUMN phone text;

CREATE OR REPLACE FUNCTION public.validate_profile_phone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := btrim(NEW.phone);
    IF NEW.phone !~ '^\+[1-9][0-9]{7,14}$' THEN
      RAISE EXCEPTION 'Phone number must be in international E.164 format';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_profile_phone_before_write
BEFORE INSERT OR UPDATE OF phone ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_profile_phone();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_phone text;
BEGIN
  profile_phone := NULLIF(btrim(NEW.raw_user_meta_data ->> 'phone'), '');

  BEGIN
    INSERT INTO public.profiles (user_id, display_name, phone)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
      profile_phone
    )
    ON CONFLICT (user_id) DO UPDATE
      SET phone = COALESCE(EXCLUDED.phone, public.profiles.phone);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
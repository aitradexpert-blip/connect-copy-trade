INSERT INTO public.user_roles (user_id, email, role)
SELECT mp.user_id, u.email, 'mentor'
FROM public.mentor_profiles mp
JOIN auth.users u ON u.id = mp.user_id
WHERE mp.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = mp.user_id AND ur.role = 'mentor'
  );

CREATE OR REPLACE FUNCTION public.sync_mentor_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF NEW.is_active = true AND NEW.user_id IS NOT NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;
    IF v_email IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, email, role)
      VALUES (NEW.user_id, v_email, 'mentor')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_mentor_role ON public.mentor_profiles;
CREATE TRIGGER trg_sync_mentor_role
AFTER INSERT OR UPDATE OF is_active, user_id ON public.mentor_profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_mentor_role();
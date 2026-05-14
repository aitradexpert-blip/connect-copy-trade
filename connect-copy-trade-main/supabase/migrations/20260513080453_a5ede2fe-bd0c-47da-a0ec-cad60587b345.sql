
-- ============= 1. Telegram leads table =============
CREATE TABLE IF NOT EXISTS public.telegram_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id bigint NOT NULL UNIQUE,
  telegram_username text,
  telegram_first_name text,
  octafx_account_id text,
  plan_choice text, -- 'free_octafx' | 'paid_basic' | 'undecided'
  conversation_state text NOT NULL DEFAULT 'start', -- 'start' | 'awaiting_octafx_id' | 'awaiting_payment' | 'verified'
  verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  verified_by uuid,
  last_interaction_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid, -- linked HuMi user once they sign up
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage telegram leads"
  ON public.telegram_leads FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access telegram leads"
  ON public.telegram_leads FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

CREATE INDEX IF NOT EXISTS idx_telegram_leads_chat ON public.telegram_leads(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_leads_verified ON public.telegram_leads(verified);

CREATE TRIGGER trg_telegram_leads_updated_at
  BEFORE UPDATE ON public.telegram_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= 2. Fix notify_new_signal — never broadcast =============
CREATE OR REPLACE FUNCTION public.notify_new_signal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_mentor_user_id uuid;
  v_brand text;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;

  -- Only notify if mentor_id is set — NEVER broadcast to all profiles.
  -- Admin/default-mentor signals get mentor_id stamped by attach_default_mentor_to_signal trigger.
  IF NEW.mentor_id IS NOT NULL THEN
    SELECT user_id, brand_name INTO v_mentor_user_id, v_brand
      FROM mentor_profiles WHERE id = NEW.mentor_id;

    INSERT INTO notifications (user_id, type, title, message, data)
    SELECT mc.client_user_id,
           'NEW_IDEA_PUBLISHED',
           COALESCE(v_brand, 'Mentor') || ' published a new idea',
           NEW.symbol || ' ' || upper(NEW.direction) || ' @ ' || COALESCE(NEW.lot_size::text, '0.01') || ' lots',
           jsonb_build_object('signal_id', NEW.id, 'symbol', NEW.symbol, 'direction', NEW.direction, 'link', '/ideas?signal=' || NEW.id)
      FROM mentor_clients mc
     WHERE mc.mentor_id = NEW.mentor_id;
  END IF;
  -- If no mentor_id, signal is visible via Trading Ideas page but no push notifications sent.

  RETURN NEW;
END;
$function$;

-- ============= 3. Re-attach triggers in correct order =============
DROP TRIGGER IF EXISTS attach_default_mentor_to_signal_trg ON public.trading_signals;
DROP TRIGGER IF EXISTS notify_new_signal_trg ON public.trading_signals;

CREATE TRIGGER attach_default_mentor_to_signal_trg
  BEFORE INSERT ON public.trading_signals
  FOR EACH ROW EXECUTE FUNCTION public.attach_default_mentor_to_signal();

CREATE TRIGGER notify_new_signal_trg
  AFTER INSERT ON public.trading_signals
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_signal();

-- ============= 4. Purge stale duplicate notifications =============
-- Delete NEW_IDEA_PUBLISHED notifications where the recipient is NOT actually
-- a mentor_client of the signal's mentor (i.e. wrong-routed broadcasts).
DELETE FROM public.notifications n
WHERE n.type = 'NEW_IDEA_PUBLISHED'
  AND NOT EXISTS (
    SELECT 1
    FROM public.trading_signals ts
    JOIN public.mentor_clients mc ON mc.mentor_id = ts.mentor_id
    WHERE ts.id::text = (n.data ->> 'signal_id')
      AND mc.client_user_id = n.user_id
  );

-- ============= 5. Storage bucket for APK =============
INSERT INTO storage.buckets (id, name, public)
VALUES ('mobile-apps', 'mobile-apps', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read mobile-apps"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'mobile-apps');

CREATE POLICY "Admins upload mobile-apps"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'mobile-apps' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update mobile-apps"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'mobile-apps' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete mobile-apps"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'mobile-apps' AND has_role(auth.uid(), 'admin'));

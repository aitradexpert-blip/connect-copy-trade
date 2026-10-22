CREATE OR REPLACE FUNCTION public.flag_duplicate_signal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.trading_signals s
    WHERE s.created_at > now() - interval '3 minutes'
      AND s.mentor_id IS NOT DISTINCT FROM NEW.mentor_id
      AND upper(regexp_replace(s.symbol, '[^A-Za-z0-9]', '', 'g')) = upper(regexp_replace(NEW.symbol, '[^A-Za-z0-9]', '', 'g'))
      AND upper(s.direction) = upper(NEW.direction)
      AND coalesce(round(s.stop_loss::numeric, 5), 0) = coalesce(round(NEW.stop_loss::numeric, 5), 0)
      AND coalesce(round(s.take_profit::numeric, 5), 0) = coalesce(round(NEW.take_profit::numeric, 5), 0)
      AND coalesce(s.status, '') <> 'duplicate'
  ) THEN
    NEW.status := 'duplicate';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.flag_duplicate_signal() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_flag_duplicate_signal BEFORE INSERT ON public.trading_signals
FOR EACH ROW EXECUTE FUNCTION public.flag_duplicate_signal();
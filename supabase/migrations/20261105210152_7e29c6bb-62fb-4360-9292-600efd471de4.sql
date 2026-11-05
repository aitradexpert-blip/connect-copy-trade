CREATE OR REPLACE FUNCTION public.close_linked_idea_on_master_position_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'closed'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.signal_id IS NOT NULL THEN
    UPDATE public.trading_signals
       SET status = 'closed'
     WHERE id = NEW.signal_id
       AND status IS DISTINCT FROM 'removed';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS close_linked_idea_on_master_position_close ON public.master_positions;
CREATE TRIGGER close_linked_idea_on_master_position_close
AFTER UPDATE OF status ON public.master_positions
FOR EACH ROW
EXECUTE FUNCTION public.close_linked_idea_on_master_position_close();
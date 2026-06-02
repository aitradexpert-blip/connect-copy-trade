-- Fix search_path for delete_expired_pending_trades function
CREATE OR REPLACE FUNCTION delete_expired_pending_trades()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM pending_trades WHERE expires_at < NOW();
END;
$$;
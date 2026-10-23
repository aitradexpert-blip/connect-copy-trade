-- Backfill master_ticket on open follower trade rows where exactly one
-- master position matches by account + normalized symbol + direction.
UPDATE public.trade_history th
SET master_ticket = matched.ticket
FROM (
  SELECT th2.id AS row_id, mp.ticket
  FROM public.trade_history th2
  JOIN public.master_positions mp
    ON mp.master_account_id = th2.master_account_id
   AND upper(regexp_replace(th2.symbol, '[^A-Za-z0-9]', '', 'g')) = upper(regexp_replace(mp.symbol, '[^A-Za-z0-9]', '', 'g'))
   AND upper(th2.direction) = upper(mp.direction)
  WHERE th2.status = 'open'
    AND th2.master_ticket IS NULL
    AND th2.master_account_id IS NOT NULL
    AND mp.ticket IS NOT NULL
) AS matched
WHERE th.id = matched.row_id
  AND (
    SELECT count(DISTINCT m2.ticket)
    FROM public.master_positions m2
    WHERE m2.master_account_id = th.master_account_id
      AND upper(regexp_replace(m2.symbol, '[^A-Za-z0-9]', '', 'g')) = upper(regexp_replace(th.symbol, '[^A-Za-z0-9]', '', 'g'))
      AND upper(m2.direction) = upper(th.direction)
      AND m2.ticket IS NOT NULL
  ) = 1;
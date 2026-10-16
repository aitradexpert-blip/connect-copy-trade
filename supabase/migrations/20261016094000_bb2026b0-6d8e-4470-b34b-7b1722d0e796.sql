ALTER TABLE public.trade_history
  ADD COLUMN IF NOT EXISTS broker_ticket text,
  ADD COLUMN IF NOT EXISTS broker_symbol text,
  ADD COLUMN IF NOT EXISTS master_account_id uuid,
  ADD COLUMN IF NOT EXISTS master_ticket text,
  ADD COLUMN IF NOT EXISTS execution_via text,
  ADD COLUMN IF NOT EXISTS close_reason text;
CREATE INDEX IF NOT EXISTS idx_trade_history_master_open ON public.trade_history(master_account_id, status);

CREATE TABLE IF NOT EXISTS public.master_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_account_id uuid NOT NULL REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
  master_user_id uuid NOT NULL,
  ticket text NOT NULL,
  symbol text NOT NULL,
  direction text NOT NULL,
  volume numeric,
  open_price numeric,
  current_profit numeric,
  signal_id uuid,
  origin text NOT NULL DEFAULT 'terminal',
  status text NOT NULL DEFAULT 'open',
  opened_at timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  close_source text,
  followers_closed integer DEFAULT 0,
  followers_failed integer DEFAULT 0,
  UNIQUE (master_account_id, ticket)
);
GRANT SELECT ON public.master_positions TO authenticated;
GRANT ALL ON public.master_positions TO service_role;
ALTER TABLE public.master_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Masters view their own positions" ON public.master_positions
  FOR SELECT TO authenticated USING (auth.uid() = master_user_id);

CREATE TABLE IF NOT EXISTS public.master_sync_state (
  master_account_id uuid PRIMARY KEY REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
  baselined_at timestamptz NOT NULL DEFAULT now(),
  last_sync_at timestamptz,
  last_error text
);
GRANT ALL ON public.master_sync_state TO service_role;
ALTER TABLE public.master_sync_state ENABLE ROW LEVEL SECURITY;
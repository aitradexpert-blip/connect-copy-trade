-- ============================================
-- FIX: UPDATE EXISTING ROWS FIRST
-- ============================================
-- Drop the old constraint
ALTER TABLE public.ai_bots DROP CONSTRAINT IF EXISTS ai_bots_status_check;

-- Update any invalid statuses to 'active' first
UPDATE public.ai_bots 
SET status = 'active' 
WHERE status NOT IN ('active', 'inactive', 'paused');

-- Now add the correct constraint
ALTER TABLE public.ai_bots 
ADD CONSTRAINT ai_bots_status_check CHECK (status IN ('active', 'inactive', 'paused'));

-- ============================================
-- PHASE 1: CREATE TRADE HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.trade_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trading_account_id UUID NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES trading_signals(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('BUY', 'SELL')),
  volume NUMERIC NOT NULL,
  entry_price NUMERIC,
  exit_price NUMERIC,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  profit_loss NUMERIC,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.trade_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trade_history
CREATE POLICY "Users can view own trade history" 
ON public.trade_history
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trades" 
ON public.trade_history
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all trades" 
ON public.trade_history
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::text));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trade_history_user_id ON public.trade_history(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_history_account_id ON public.trade_history(trading_account_id);
CREATE INDEX IF NOT EXISTS idx_trade_history_executed_at ON public.trade_history(executed_at DESC);

-- ============================================
-- PHASE 2: ADD FICA FIELDS TO KYC
-- ============================================
ALTER TABLE public.kyc_documents 
ADD COLUMN IF NOT EXISTS id_number TEXT,
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS physical_address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS province TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT,
ADD COLUMN IF NOT EXISTS proof_of_residence_url TEXT,
ADD COLUMN IF NOT EXISTS bank_statement_url TEXT,
ADD COLUMN IF NOT EXISTS verification_notes TEXT,
ADD COLUMN IF NOT EXISTS fica_compliant BOOLEAN DEFAULT FALSE;

-- ============================================
-- PHASE 3: UPDATE AI BOTS (KEEP 1 ACTIVE)
-- ============================================
UPDATE public.ai_bots 
SET status = 'active' 
WHERE bot_name = 'Swing Trader';

UPDATE public.ai_bots 
SET status = 'inactive' 
WHERE bot_name != 'Swing Trader';

-- ============================================
-- PHASE 4: ADD AUTO_EXECUTE TO BOT ASSIGNMENTS
-- ============================================
ALTER TABLE public.ai_bot_assignments 
ADD COLUMN IF NOT EXISTS auto_execute BOOLEAN DEFAULT FALSE;

-- ============================================
-- PHASE 5: ENABLE REALTIME ON TRADING SIGNALS
-- ============================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.trading_signals;
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- Table already in publication, ignore
END $$;

-- ============================================
-- PHASE 6: ADD UNIQUE CONSTRAINT TO USER_ROLES
-- ============================================
-- Add unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_roles_user_id_role_key'
  ) THEN
    ALTER TABLE public.user_roles 
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
  END IF;
END $$;

-- ============================================
-- PHASE 7: ENSURE ADMIN USERS ARE SEEDED
-- ============================================
-- Insert admin roles for specified emails
INSERT INTO public.user_roles (user_id, role, email)
SELECT 
  id, 
  'admin'::text,
  email
FROM auth.users 
WHERE email IN ('mpho.shephard@gmail.com', 'mphoforex5@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;
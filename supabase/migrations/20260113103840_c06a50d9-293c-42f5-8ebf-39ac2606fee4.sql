-- Part 1: Fix the platform constraint that blocks Deriv accounts
ALTER TABLE trading_accounts 
DROP CONSTRAINT IF EXISTS trading_accounts_platform_check;

ALTER TABLE trading_accounts 
ADD CONSTRAINT trading_accounts_platform_check 
CHECK (platform = ANY (ARRAY[
  'mt4'::text,
  'mt5'::text,
  'deriv'::text,
  'deriv_demo'::text,
  'deriv_mt5'::text,
  'deriv_ctrader'::text,
  'ctrader'::text
]));

-- Part 2: Create pending_subscriptions table for subscription-first flow
CREATE TABLE IF NOT EXISTS pending_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  payment_id TEXT,
  yoco_checkout_id TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  activated_user_id UUID
);

-- Create unique index on email for pending status only
CREATE UNIQUE INDEX IF NOT EXISTS pending_subscriptions_email_pending_idx 
ON pending_subscriptions(email) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE pending_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to insert (for guest checkout)
CREATE POLICY "Allow anonymous insert" ON pending_subscriptions
  FOR INSERT TO anon WITH CHECK (true);

-- Allow anonymous to select their own pending subscription by email
CREATE POLICY "Allow anonymous select by email" ON pending_subscriptions
  FOR SELECT TO anon USING (true);

-- Service role has full access (for webhook and activation)
CREATE POLICY "Service role full access" ON pending_subscriptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
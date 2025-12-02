-- Fund Transfer System Tables

-- Bankii wallet integration
CREATE TABLE IF NOT EXISTS bankii_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  bankii_user_id TEXT,
  deposit_address TEXT,
  balance NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'USDT',
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE bankii_wallets ENABLE ROW LEVEL SECURITY;

-- RLS policies for bankii_wallets
CREATE POLICY "Users can view own bankii wallet" 
  ON bankii_wallets FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bankii wallet" 
  ON bankii_wallets FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bankii wallet" 
  ON bankii_wallets FOR UPDATE 
  USING (auth.uid() = user_id);

-- Fund transfers table for tracking all transfer operations
CREATE TABLE IF NOT EXISTS fund_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  transfer_type TEXT NOT NULL, -- 'deposit_to_broker', 'withdraw_to_wallet', 'internal', 'cross_broker'
  source_type TEXT NOT NULL, -- 'bankii_wallet', 'broker_account'
  source_id TEXT,
  source_name TEXT,
  dest_type TEXT NOT NULL,
  dest_id TEXT,
  dest_name TEXT,
  amount NUMERIC NOT NULL,
  fee NUMERIC DEFAULT 0,
  net_amount NUMERIC,
  currency TEXT DEFAULT 'USDT',
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'step1_complete', 'step2_processing', 'completed', 'failed', 'cancelled'
  current_step INTEGER DEFAULT 1,
  total_steps INTEGER DEFAULT 1,
  step_details JSONB DEFAULT '{}',
  deposit_address TEXT,
  transaction_hash TEXT,
  error_message TEXT,
  estimated_completion_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE fund_transfers ENABLE ROW LEVEL SECURITY;

-- RLS policies for fund_transfers
CREATE POLICY "Users can view own transfers" 
  ON fund_transfers FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own transfers" 
  ON fund_transfers FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transfers" 
  ON fund_transfers FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all transfers" 
  ON fund_transfers FOR SELECT 
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all transfers" 
  ON fund_transfers FOR UPDATE 
  USING (has_role(auth.uid(), 'admin'));

-- Broker deposit addresses cache (24 hour expiry)
CREATE TABLE IF NOT EXISTS broker_deposit_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trading_account_id UUID REFERENCES trading_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  broker_name TEXT,
  currency TEXT DEFAULT 'USDT',
  address TEXT NOT NULL,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '24 hours')
);

-- Enable RLS
ALTER TABLE broker_deposit_addresses ENABLE ROW LEVEL SECURITY;

-- RLS policies for broker_deposit_addresses
CREATE POLICY "Users can view own broker addresses" 
  ON broker_deposit_addresses FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own broker addresses" 
  ON broker_deposit_addresses FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own broker addresses" 
  ON broker_deposit_addresses FOR UPDATE 
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_fund_transfers_user_id ON fund_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_fund_transfers_status ON fund_transfers(status);
CREATE INDEX IF NOT EXISTS idx_fund_transfers_created_at ON fund_transfers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broker_addresses_account_id ON broker_deposit_addresses(trading_account_id);
CREATE INDEX IF NOT EXISTS idx_broker_addresses_expires ON broker_deposit_addresses(expires_at);

-- Trigger to update updated_at
CREATE TRIGGER update_fund_transfers_updated_at
  BEFORE UPDATE ON fund_transfers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bankii_wallets_updated_at
  BEFORE UPDATE ON bankii_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
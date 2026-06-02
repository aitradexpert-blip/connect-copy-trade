-- Subscription plans with limits
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  price_zar DECIMAL(10,2) NOT NULL,
  price_usd DECIMAL(10,2) NOT NULL,
  auto_trades_limit INTEGER,
  trading_accounts_limit INTEGER,
  copy_accounts_limit INTEGER,
  ai_bots_enabled BOOLEAN DEFAULT false,
  priority_support BOOLEAN DEFAULT false,
  custom_risk_enabled BOOLEAN DEFAULT false,
  features JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User subscriptions
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan_name TEXT REFERENCES subscription_plans(name),
  status TEXT CHECK (status IN ('active', 'inactive', 'cancelled', 'expired')) DEFAULT 'inactive',
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  auto_trades_used INTEGER DEFAULT 0,
  last_reset_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit usage tracking
CREATE TABLE IF NOT EXISTS credit_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  service TEXT NOT NULL,
  credits_used INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crypto wallets
CREATE TABLE IF NOT EXISTS crypto_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL,
  balance DECIMAL(20, 8) DEFAULT 0,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, currency)
);

-- Crypto transactions
CREATE TABLE IF NOT EXISTS crypto_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type TEXT CHECK (transaction_type IN ('deposit', 'withdrawal', 'transfer', 'exchange')),
  from_currency TEXT,
  to_currency TEXT,
  from_amount DECIMAL(20, 8),
  to_amount DECIMAL(20, 8),
  fee DECIMAL(20, 8),
  status TEXT CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')) DEFAULT 'pending',
  from_address TEXT,
  to_address TEXT,
  broker_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_credit_usage_user_created ON credit_usage(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_crypto_wallets_user ON crypto_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_crypto_transactions_user ON crypto_transactions(user_id, created_at);

-- RLS policies
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view plans" ON subscription_plans FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view own subscription" ON user_subscriptions FOR SELECT 
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view own credit usage" ON credit_usage FOR SELECT 
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view own wallets" ON crypto_wallets FOR SELECT 
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view own transactions" ON crypto_transactions FOR SELECT 
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON crypto_transactions FOR INSERT 
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Function to reset monthly limits
CREATE OR REPLACE FUNCTION reset_monthly_limits()
RETURNS void AS $$
BEGIN
  UPDATE user_subscriptions
  SET auto_trades_used = 0, last_reset_at = NOW()
  WHERE last_reset_at < NOW() - INTERVAL '1 month';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check subscription access
CREATE OR REPLACE FUNCTION has_subscription_access(
  _user_id UUID,
  _feature TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  _plan_name TEXT;
  _plan subscription_plans%ROWTYPE;
BEGIN
  SELECT plan_name INTO _plan_name
  FROM user_subscriptions
  WHERE user_id = _user_id AND status = 'active';
  
  IF _plan_name IS NULL THEN
    RETURN false;
  END IF;
  
  SELECT * INTO _plan
  FROM subscription_plans
  WHERE name = _plan_name;
  
  CASE _feature
    WHEN 'ai_bots' THEN RETURN _plan.ai_bots_enabled;
    WHEN 'priority_support' THEN RETURN _plan.priority_support;
    WHEN 'custom_risk' THEN RETURN _plan.custom_risk_enabled;
    ELSE RETURN true;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create default wallets trigger
CREATE OR REPLACE FUNCTION create_default_wallets()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO crypto_wallets (user_id, currency, balance, address) VALUES
    (NEW.id, 'BTC', 0, 'bc1q' || substr(md5(NEW.id::text), 1, 38)),
    (NEW.id, 'ETH', 0, '0x' || substr(md5(NEW.id::text || 'eth'), 1, 40)),
    (NEW.id, 'USDT', 0, '0x' || substr(md5(NEW.id::text || 'usdt'), 1, 40)),
    (NEW.id, 'USDC', 0, '0x' || substr(md5(NEW.id::text || 'usdc'), 1, 40)),
    (NEW.id, 'LTC', 0, 'ltc1q' || substr(md5(NEW.id::text || 'ltc'), 1, 38)),
    (NEW.id, 'XRP', 0, 'r' || substr(md5(NEW.id::text || 'xrp'), 1, 33)),
    (NEW.id, 'USD', 0, NULL);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_created_create_wallets ON auth.users;
CREATE TRIGGER on_user_created_create_wallets
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_default_wallets();

-- Seed subscription plans
INSERT INTO subscription_plans (name, price_zar, price_usd, auto_trades_limit, trading_accounts_limit, copy_accounts_limit, ai_bots_enabled, priority_support, features) VALUES
('basic', 9.90, 0.54, 10, 2, 1, false, false, 
  '["10 Auto-Trades per month", "Add up to 2 Trading Accounts", "Up to 1 Copy Account", "Premium Trading Signals", "Email support"]'::jsonb),
('professional', 29.90, 1.64, 30, 5, 3, true, true,
  '["Up to 30 Auto-Trades", "Add up to 5 Trading Accounts", "Up to 3 Copy Accounts", "Premium Trading Ideas", "Priority email support", "Advanced AI bots", "Priority Ideas"]'::jsonb),
('enterprise', 39.99, 2.19, -1, 10, 5, true, true,
  '["Unlimited Auto-Trades", "Add up to 10 Trading Accounts", "Up to 5 Copy Accounts", "VIP market signals", "24/7 phone & email support", "Advanced AI bots", "Priority signals", "Custom risk management"]'::jsonb)
ON CONFLICT (name) DO NOTHING;
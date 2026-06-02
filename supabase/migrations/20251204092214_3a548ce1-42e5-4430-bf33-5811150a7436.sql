-- Make trading_accounts provider-agnostic
ALTER TABLE trading_accounts
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'metaapi',
  ADD COLUMN IF NOT EXISTS provider_account_id TEXT,
  ADD COLUMN IF NOT EXISTS deriv_token TEXT,
  ADD COLUMN IF NOT EXISTS deriv_currency TEXT,
  ADD COLUMN IF NOT EXISTS is_virtual BOOLEAN DEFAULT false;

-- Make metaapi_account_id nullable for non-MetaAPI providers
ALTER TABLE trading_accounts
  ALTER COLUMN metaapi_account_id DROP NOT NULL;

-- Add index for provider lookups
CREATE INDEX IF NOT EXISTS idx_trading_accounts_provider ON trading_accounts(provider);

-- Add comment for clarity
COMMENT ON COLUMN trading_accounts.provider IS 'Broker provider: deriv, metaapi, etc.';
COMMENT ON COLUMN trading_accounts.provider_account_id IS 'Provider-specific account ID (e.g., Deriv loginid CRW1157)';
COMMENT ON COLUMN trading_accounts.deriv_token IS 'Encrypted Deriv API token for this account';
COMMENT ON COLUMN trading_accounts.deriv_currency IS 'Account currency for Deriv accounts';
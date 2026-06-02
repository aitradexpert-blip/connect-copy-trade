-- Add unique constraint for safe upserts (prevents duplicate accounts)
-- This enables ON CONFLICT for Deriv account upserts

ALTER TABLE trading_accounts
  DROP CONSTRAINT IF EXISTS unique_provider_account;

ALTER TABLE trading_accounts
  ADD CONSTRAINT unique_provider_account 
  UNIQUE (user_id, provider, provider_account_id);
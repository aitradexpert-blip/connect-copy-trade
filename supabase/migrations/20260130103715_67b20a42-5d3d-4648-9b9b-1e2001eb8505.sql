-- Add connection_type and broker_name columns to trading_accounts
-- connection_type determines which API to use for trading operations
-- broker_name stores the human-readable broker name

-- Add connection_type column with default 'deriv_api' for existing Deriv accounts
ALTER TABLE trading_accounts
ADD COLUMN IF NOT EXISTS connection_type TEXT NOT NULL DEFAULT 'deriv_api' 
CHECK (connection_type IN ('deriv_api', 'metaapi'));

-- Add broker_name column for identifying the broker
ALTER TABLE trading_accounts
ADD COLUMN IF NOT EXISTS broker_name TEXT;

-- Update existing MetaAPI accounts to use 'metaapi' connection_type
UPDATE trading_accounts 
SET connection_type = 'metaapi' 
WHERE provider = 'metaapi' 
   OR provider = 'mt4' 
   OR provider = 'mt5'
   OR metaapi_account_id IS NOT NULL;

-- Update broker_name for Deriv accounts
UPDATE trading_accounts 
SET broker_name = 'Deriv' 
WHERE provider = 'deriv' AND broker_name IS NULL;

-- Update platform to include MT5 variations for proper routing
-- Accounts with 'deriv_mt5' platform should use metaapi connection
UPDATE trading_accounts 
SET connection_type = 'metaapi' 
WHERE platform IN ('deriv_mt5', 'deriv_mt5_demo', 'mt4', 'mt5');
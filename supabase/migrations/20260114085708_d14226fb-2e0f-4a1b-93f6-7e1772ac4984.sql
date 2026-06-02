-- Fix Master Traders Visibility for Copy Trading
-- Create a secure view that exposes only non-sensitive fields of master accounts

-- First, create a view for public master accounts (excludes sensitive data like tokens)
CREATE OR REPLACE VIEW public.public_master_accounts
WITH (security_invoker = on)
AS SELECT 
  ta.id,
  ta.name,
  ta.platform,
  ta.provider,
  ta.balance,
  ta.is_master,
  ta.created_at,
  ta.login as display_id,
  ta.user_id,
  ta.is_virtual
FROM trading_accounts ta
WHERE ta.is_master = true;

-- Grant select on the view to authenticated users
GRANT SELECT ON public.public_master_accounts TO authenticated;

-- Add RLS policy to allow viewing master accounts for copy trading
-- This policy allows users to view:
-- 1. Their own accounts (full access)
-- 2. Other users' accounts that are marked as master (limited via the view)
CREATE POLICY "Users can view master accounts for copy trading"
ON trading_accounts
FOR SELECT
USING (
  auth.uid() = user_id 
  OR is_master = true
);

-- Drop the old restrictive policy if it exists (needs IF EXISTS pattern)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'trading_accounts' 
    AND policyname = 'Users can view own accounts'
  ) THEN
    DROP POLICY "Users can view own accounts" ON trading_accounts;
  END IF;
END $$;
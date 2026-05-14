-- Fix RLS policy for trading_accounts to allow INSERT operations
-- The current policy is missing WITH CHECK clause which causes silent INSERT failures

DROP POLICY IF EXISTS "Users can manage their own accounts" ON trading_accounts;

CREATE POLICY "Users can manage their own accounts"
  ON trading_accounts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
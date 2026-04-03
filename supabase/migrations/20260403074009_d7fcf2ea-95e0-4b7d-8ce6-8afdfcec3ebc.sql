-- Allow followers to update their own copy trading relationships
CREATE POLICY "Users can update own copy relationships"
ON public.copy_trading_relationships FOR UPDATE
USING (auth.uid() = follower_user_id)
WITH CHECK (auth.uid() = follower_user_id);

-- Allow followers to delete their own copy trading relationships
CREATE POLICY "Users can delete own copy relationships"
ON public.copy_trading_relationships FOR DELETE
USING (auth.uid() = follower_user_id);
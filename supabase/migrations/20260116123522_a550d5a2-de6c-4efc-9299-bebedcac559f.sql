-- Fix RLS for user_subscriptions to allow admin operations
-- First, create policies for admins to manage subscriptions

-- Allow admins to insert subscriptions for any user
CREATE POLICY "Admins can insert subscriptions"
ON public.user_subscriptions
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
);

-- Allow admins to update subscriptions for any user
CREATE POLICY "Admins can update subscriptions"
ON public.user_subscriptions
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin')
);

-- Allow admins to view all subscriptions
CREATE POLICY "Admins can view all subscriptions"
ON public.user_subscriptions
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin')
);

-- Allow admins to delete subscriptions
CREATE POLICY "Admins can delete subscriptions"
ON public.user_subscriptions
FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin')
);
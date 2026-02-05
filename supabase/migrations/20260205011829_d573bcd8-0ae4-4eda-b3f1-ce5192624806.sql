-- Fix the overly permissive INSERT policy on notifications table
-- Drop the permissive policy and create a proper one
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;

-- Allow service role to insert notifications (for edge functions using service role key)
-- This is secure because only server-side code with SUPABASE_SERVICE_ROLE_KEY can use this
CREATE POLICY "Service role can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (
  (auth.jwt() ->> 'role'::text) = 'service_role'
);
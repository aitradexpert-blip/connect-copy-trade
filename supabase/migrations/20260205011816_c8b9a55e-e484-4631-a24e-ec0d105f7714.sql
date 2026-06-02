-- Phase 1: Add INSERT policy for credit_usage
CREATE POLICY "Users can insert own credit usage"
ON public.credit_usage FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Phase 2: Update subscription_plans pricing to intended ZAR values
UPDATE subscription_plans SET price_zar = 99, price_usd = 5.50 WHERE LOWER(name) = 'basic';
UPDATE subscription_plans SET price_zar = 299, price_usd = 16.61 WHERE LOWER(name) = 'professional';
UPDATE subscription_plans SET price_zar = 399, price_usd = 22.17 WHERE LOWER(name) = 'enterprise';

-- Phase 3: Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

-- Service role can insert notifications (for edge functions)
CREATE POLICY "Service role can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- Index for fast queries
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read, created_at DESC);
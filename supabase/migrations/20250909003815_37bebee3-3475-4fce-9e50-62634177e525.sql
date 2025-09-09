-- Create user_roles table for admin permissions
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own role" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all roles" ON public.user_roles
FOR ALL USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Insert admin users
INSERT INTO public.user_roles (email, role) VALUES 
('mphoforex5@gmail.com', 'admin'),
('mpho.shephard@gmail.com', 'admin');

-- Create payment_proofs table for Yoco payment screenshots
CREATE TABLE public.payment_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  plan TEXT NOT NULL,
  amount INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on payment_proofs
ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;

-- Create policies for payment_proofs
CREATE POLICY "Users can view their own payment proofs" ON public.payment_proofs
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payment proofs" ON public.payment_proofs
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all payment proofs" ON public.payment_proofs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create copy_trading_relationships table
CREATE TABLE public.copy_trading_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  follower_account_id UUID REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
  master_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  master_account_id UUID REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.copy_trading_relationships ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their relationships" ON public.copy_trading_relationships
FOR SELECT USING (auth.uid() = follower_user_id OR auth.uid() = master_user_id);

CREATE POLICY "Users can create relationships as followers" ON public.copy_trading_relationships
FOR INSERT WITH CHECK (auth.uid() = follower_user_id);

-- Add is_master column to trading_accounts
ALTER TABLE public.trading_accounts ADD COLUMN is_master BOOLEAN DEFAULT false;

-- Create user_settings table
CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email_notifications JSONB DEFAULT '{"trading_signals": true, "trade_execution": true, "weekly_reports": true}'::jsonb,
  push_notifications JSONB DEFAULT '{"trading_signals": true, "trade_updates": true}'::jsonb,
  appearance_theme TEXT DEFAULT 'system',
  language TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own settings" ON public.user_settings
FOR ALL USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
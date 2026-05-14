-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  subscription_plan TEXT DEFAULT 'basic',
  subscription_status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create trading accounts table
CREATE TABLE public.trading_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metaapi_account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  login TEXT NOT NULL,
  server TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('mt4', 'mt5')),
  connection_status TEXT DEFAULT 'disconnected',
  balance DECIMAL(15,2) DEFAULT 0,
  equity DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trading_accounts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own accounts" 
ON public.trading_accounts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own accounts" 
ON public.trading_accounts 
FOR ALL 
USING (auth.uid() = user_id);

-- Create trading signals table
CREATE TABLE public.trading_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('BUY', 'SELL')),
  lot_size DECIMAL(10,4) NOT NULL,
  stop_loss DECIMAL(10,5),
  take_profit DECIMAL(10,5),
  comment TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'executed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  scheduled_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '24 hours')
);

-- Enable RLS
ALTER TABLE public.trading_signals ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Everyone can view active signals" 
ON public.trading_signals 
FOR SELECT 
USING (status = 'active' AND (expires_at IS NULL OR expires_at > now()));

-- Only admins can create/update signals (we'll handle this in the app)
CREATE POLICY "Service role can manage signals" 
ON public.trading_signals 
FOR ALL 
USING (auth.jwt() ->> 'role' = 'service_role');

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trading_accounts_updated_at
BEFORE UPDATE ON public.trading_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to auto-create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
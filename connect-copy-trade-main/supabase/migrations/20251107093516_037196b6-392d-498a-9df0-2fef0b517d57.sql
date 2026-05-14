-- Fix signup error: Make display_name nullable and update trigger
ALTER TABLE profiles ALTER COLUMN display_name DROP NOT NULL;

-- Update handle_new_user trigger to handle NULL display_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Add pending_approval status for trading accounts
ALTER TABLE trading_accounts ADD COLUMN IF NOT EXISTS connection_status TEXT DEFAULT 'pending_approval';
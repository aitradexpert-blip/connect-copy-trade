-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update all profiles
CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all trading accounts
CREATE POLICY "Admins can view all trading accounts"
ON public.trading_accounts FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));
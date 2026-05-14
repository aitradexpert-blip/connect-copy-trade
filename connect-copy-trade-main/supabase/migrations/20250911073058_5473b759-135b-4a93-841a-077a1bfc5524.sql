-- Grant admin role to the specified super user by email (idempotent)
INSERT INTO public.user_roles (user_id, email, role)
SELECT au.id, au.email, 'admin'
FROM auth.users au
WHERE LOWER(au.email) = 'mphoforex5@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = au.id AND ur.role = 'admin'
  );

-- Create admin policy for payment proofs if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'payment_proofs' 
    AND policyname = 'Admins can manage payment proofs'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can manage payment proofs" 
             ON public.payment_proofs 
             FOR ALL 
             USING (has_role(auth.uid(), ''admin'')) 
             WITH CHECK (has_role(auth.uid(), ''admin''))';
  END IF;
END$$;

-- Create email-based admin policy for trading signals as fallback
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'trading_signals' 
    AND policyname = 'Email admin can manage signals'
  ) THEN
    EXECUTE 'CREATE POLICY "Email admin can manage signals" 
             ON public.trading_signals 
             FOR ALL 
             USING ((auth.jwt() ->> ''email'') = ''mphoforex5@gmail.com'') 
             WITH CHECK ((auth.jwt() ->> ''email'') = ''mphoforex5@gmail.com'')';
  END IF;
END$$;
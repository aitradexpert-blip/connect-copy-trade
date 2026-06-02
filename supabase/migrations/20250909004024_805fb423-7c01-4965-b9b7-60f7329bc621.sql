-- Allow admins to manage trading_signals via RLS
CREATE POLICY "Admins can manage signals" ON public.trading_signals
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.role = 'admin'
      AND (ur.user_id = auth.uid() OR ur.email = (auth.jwt() ->> 'email'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.role = 'admin'
      AND (ur.user_id = auth.uid() OR ur.email = (auth.jwt() ->> 'email'))
  )
);

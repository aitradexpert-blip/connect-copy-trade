-- Grant admin role to the specified super user by email (idempotent)
insert into public.user_roles (user_id, email, role)
select au.id, au.email, 'admin'
from auth.users au
where lower(au.email) in ('mphoforex5@gmail.com')
  and not exists (
    select 1 from public.user_roles ur
    where ur.user_id = au.id and ur.role = 'admin'
  );

-- Ensure admins can fully manage payment proofs (approve/reject)
create policy if not exists "Admins can manage payment proofs"
on public.payment_proofs
for all
using (has_role(auth.uid(), 'admin'))
with check (has_role(auth.uid(), 'admin'));

-- Optional: ensure admins can manage trading signals (already present), but add a backup email-based policy to avoid blocks if roles missing
create policy if not exists "Email admin can manage signals"
on public.trading_signals
for all
using ((auth.jwt() ->> 'email') = 'mphoforex5@gmail.com')
with check ((auth.jwt() ->> 'email') = 'mphoforex5@gmail.com');
-- Fix admin role checks and relationships; add KYC support

-- 1) Security definer function for role checks
create or replace function public.has_role(_user_id uuid, _role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

-- 2) Update trading_signals policies to use has_role
do $$ begin
  if exists (
    select 1 from pg_policies where schemaname='public' and tablename='trading_signals' and policyname='Admins can manage signals'
  ) then
    drop policy "Admins can manage signals" on public.trading_signals;
  end if;
end $$;

create policy "Admins can manage signals"
on public.trading_signals
for all
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- keep existing policies for viewing active signals and service role as-is (not recreating)

-- 3) Ensure the requesting user is admin (by email) with proper user_id linkage
insert into public.user_roles (email, user_id, role)
select 'mphoforex5@gmail.com', au.id, 'admin'
from auth.users au
where au.email = 'mphoforex5@gmail.com'
  and not exists (
    select 1 from public.user_roles ur
    where ur.role = 'admin' and (ur.user_id = au.id or ur.email = 'mphoforex5@gmail.com')
  );

-- 4) Ensure profiles.user_id is unique and relate trading_accounts -> profiles
-- Create unique constraint on profiles.user_id if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'profiles_user_id_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
  END IF;
END$$;

-- Create any missing profiles for existing trading accounts
insert into public.profiles (user_id)
select distinct ta.user_id
from public.trading_accounts ta
left join public.profiles p on p.user_id = ta.user_id
where p.user_id is null;

-- Add foreign key from trading_accounts.user_id to profiles.user_id if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trading_accounts_user_id_fkey'
  ) THEN
    ALTER TABLE public.trading_accounts
      ADD CONSTRAINT trading_accounts_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
  END IF;
END$$;

-- 5) KYC documents table and policies
create table if not exists public.kyc_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  document_type text not null,
  image_url text not null,
  status text default 'pending',
  submitted_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid
);

alter table public.kyc_documents enable row level security;

-- Policies for KYC
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='kyc_documents' AND policyname='Users can insert their own kyc'
  ) THEN
    CREATE POLICY "Users can insert their own kyc"
    ON public.kyc_documents
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='kyc_documents' AND policyname='Users can view their own kyc'
  ) THEN
    CREATE POLICY "Users can view their own kyc"
    ON public.kyc_documents
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='kyc_documents' AND policyname='Admins can manage kyc'
  ) THEN
    CREATE POLICY "Admins can manage kyc"
    ON public.kyc_documents
    FOR ALL
    USING (public.has_role(auth.uid(),'admin'))
    WITH CHECK (public.has_role(auth.uid(),'admin'));
  END IF;
END $$;

-- 6) Storage bucket and policies for KYC docs
insert into storage.buckets (id, name, public)
values ('kyc-docs', 'kyc-docs', false)
on conflict (id) do nothing;

-- Policies on storage.objects specific to kyc-docs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can upload own KYC'
  ) THEN
    CREATE POLICY "Users can upload own KYC"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
      bucket_id = 'kyc-docs' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can view own KYC'
  ) THEN
    CREATE POLICY "Users can view own KYC"
    ON storage.objects
    FOR SELECT
    USING (
      bucket_id = 'kyc-docs' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admins can view all KYC'
  ) THEN
    CREATE POLICY "Admins can view all KYC"
    ON storage.objects
    FOR SELECT
    USING (
      bucket_id = 'kyc-docs' AND public.has_role(auth.uid(),'admin')
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admins can update/delete KYC'
  ) THEN
    CREATE POLICY "Admins can update/delete KYC"
    ON storage.objects
    FOR ALL
    USING (
      bucket_id = 'kyc-docs' AND public.has_role(auth.uid(),'admin')
    );
  END IF;
END $$;
CREATE TABLE public.copy_execution_claims (
  claim_key text PRIMARY KEY,
  follower_account_id uuid NOT NULL,
  signal_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.copy_execution_claims TO service_role;
ALTER TABLE public.copy_execution_claims ENABLE ROW LEVEL SECURITY;
CREATE INDEX copy_execution_claims_created_idx ON public.copy_execution_claims(created_at);
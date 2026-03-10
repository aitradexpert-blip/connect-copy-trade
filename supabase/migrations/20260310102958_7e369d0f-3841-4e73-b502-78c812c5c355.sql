ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS khumo_queries_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS khumo_queries_reset_at timestamptz NOT NULL DEFAULT now();
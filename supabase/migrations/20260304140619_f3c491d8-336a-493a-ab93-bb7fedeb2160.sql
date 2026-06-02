
-- Batch 1: Add voice_preference to user_settings
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS voice_preference jsonb DEFAULT '{"voiceId": "EXAVITQu4vr4xnSDxMaL", "gender": "female"}'::jsonb;

-- Batch 2: Mentor profiles
CREATE TABLE IF NOT EXISTS public.mentor_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  brand_name text NOT NULL UNIQUE,
  referral_slug text NOT NULL UNIQUE,
  feature_renames jsonb DEFAULT '{"ai_bot_name": "AI Trading Bot", "copy_trading_name": "Copy Trading", "trading_ideas_name": "Trading Ideas"}'::jsonb,
  logo_url text,
  is_active boolean DEFAULT true,
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.mentor_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mentors can view own profile" ON public.mentor_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Mentors can update own profile" ON public.mentor_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Mentors can insert own profile" ON public.mentor_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all mentor profiles" ON public.mentor_profiles FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can view active mentor profiles by slug" ON public.mentor_profiles FOR SELECT USING (is_active = true);

-- Batch 2: Mentor clients
CREATE TABLE IF NOT EXISTS public.mentor_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES public.mentor_profiles(id) ON DELETE CASCADE,
  client_user_id uuid NOT NULL,
  registered_at timestamptz DEFAULT now(),
  referral_slug_used text,
  UNIQUE(mentor_id, client_user_id)
);

ALTER TABLE public.mentor_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mentors can view own clients" ON public.mentor_clients FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.mentor_profiles WHERE id = mentor_id AND user_id = auth.uid())
);
CREATE POLICY "Anyone can insert mentor client record" ON public.mentor_clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Clients can view own mentor link" ON public.mentor_clients FOR SELECT USING (auth.uid() = client_user_id);
CREATE POLICY "Admins can view all mentor clients" ON public.mentor_clients FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Batch 3: Chat history
CREATE TABLE IF NOT EXISTS public.chat_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own chat history" ON public.chat_history FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Batch 3: Trade analysis
CREATE TABLE IF NOT EXISTS public.trade_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  trade_id uuid REFERENCES public.trade_history(id) ON DELETE CASCADE,
  ai_analysis text,
  strategy_detected text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.trade_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trade analysis" ON public.trade_analysis FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trade analysis" ON public.trade_analysis FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Batch 4: Training content
CREATE TABLE IF NOT EXISTS public.training_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'lesson',
  url text,
  content_text text,
  difficulty text NOT NULL DEFAULT 'beginner',
  tags text[] DEFAULT '{}',
  category text,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.training_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view training content" ON public.training_content FOR SELECT USING (true);
CREATE POLICY "Admins can manage training content" ON public.training_content FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Batch 4: User training progress
CREATE TABLE IF NOT EXISTS public.user_training_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content_id uuid REFERENCES public.training_content(id) ON DELETE CASCADE,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, content_id)
);

ALTER TABLE public.user_training_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own progress" ON public.user_training_progress FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

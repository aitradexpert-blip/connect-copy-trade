
-- 1. Add mentor_id to trading_signals
ALTER TABLE public.trading_signals ADD COLUMN IF NOT EXISTS mentor_id UUID;

-- RLS: Mentors can insert their own signals
CREATE POLICY "Mentors can insert own signals"
ON public.trading_signals
FOR INSERT
TO authenticated
WITH CHECK (
  mentor_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM mentor_profiles
    WHERE mentor_profiles.user_id = auth.uid()
    AND mentor_profiles.id = trading_signals.mentor_id
    AND mentor_profiles.is_active = true
  )
);

-- RLS: Mentors can update their own signals
CREATE POLICY "Mentors can update own signals"
ON public.trading_signals
FOR UPDATE
TO authenticated
USING (
  mentor_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM mentor_profiles
    WHERE mentor_profiles.user_id = auth.uid()
    AND mentor_profiles.id = trading_signals.mentor_id
  )
);

-- 2. Add referred_by to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by TEXT;

-- 3. Create mentor-assets storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('mentor-assets', 'mentor-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for mentor-assets
CREATE POLICY "Anyone can view mentor assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'mentor-assets');

CREATE POLICY "Mentors can upload own assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'mentor-assets' AND
  EXISTS (
    SELECT 1 FROM mentor_profiles
    WHERE mentor_profiles.user_id = auth.uid()
    AND (storage.foldername(name))[1] = mentor_profiles.id::text
  )
);

CREATE POLICY "Mentors can update own assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'mentor-assets' AND
  EXISTS (
    SELECT 1 FROM mentor_profiles
    WHERE mentor_profiles.user_id = auth.uid()
    AND (storage.foldername(name))[1] = mentor_profiles.id::text
  )
);

CREATE POLICY "Mentors can delete own assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'mentor-assets' AND
  EXISTS (
    SELECT 1 FROM mentor_profiles
    WHERE mentor_profiles.user_id = auth.uid()
    AND (storage.foldername(name))[1] = mentor_profiles.id::text
  )
);

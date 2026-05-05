-- Add selected_subjects for onboarding payload persistence
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS selected_subjects JSONB DEFAULT '[]'::jsonb;
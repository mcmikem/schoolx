-- Add missing student columns
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS blood_type TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS religion TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS medical_conditions TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS allergies TEXT;
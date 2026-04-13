-- Add AOI (Activities of Integration) for NCDC curriculum
-- Run in Supabase SQL Editor

-- 1. Add columns to subjects table
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS competency_focus TEXT DEFAULT 'demonstrates';
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS uses_aoi BOOLEAN DEFAULT false;

-- 2. Add competency_notes to grades table  
ALTER TABLE grades ADD COLUMN IF NOT EXISTS competency_notes TEXT;

-- 3. Add AOI to assessment_type (run as separate if error)
-- ALTER TYPE assessment_type ADD VALUE 'aoi';

-- 4. Create suggestions table
CREATE TABLE IF NOT EXISTS suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'feedback',
  status TEXT DEFAULT 'pending',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- 5. Enable RLS
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policy for viewing
DROP POLICY IF EXISTS "suggestions_select_policy" ON suggestions;
CREATE POLICY "suggestions_select_policy" ON suggestions
  FOR SELECT USING (school_id IN (SELECT school_id FROM auth.users WHERE id = auth.uid()));

-- 7. Create RLS policy for inserting
DROP POLICY IF EXISTS "suggestions_insert_policy" ON suggestions;
CREATE POLICY "suggestions_insert_policy" ON suggestions
  FOR INSERT WITH CHECK (school_id IN (SELECT school_id FROM auth.users WHERE id = auth.uid()));

-- 8. Create index
CREATE INDEX IF NOT EXISTS idx_suggestions_school_status ON suggestions(school_id, status);
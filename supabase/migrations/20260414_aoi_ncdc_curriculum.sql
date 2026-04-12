-- Add AOI (Activities of Integration) for NCDC curriculum
-- Activities of Integration (AOI) contribute 20% to final grade under new curriculum

ALTER TYPE assessment_type ADD VALUE 'aoi';

-- Add competency tracking for new curriculum subjects
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS competency_focus TEXT DEFAULT 'demonstrates';
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS uses_aoi BOOLEAN DEFAULT false;

-- Add competency_level tracking to grades for new curriculum reporting
ALTER TABLE grades ADD COLUMN IF NOT EXISTS competency_notes TEXT;

-- Suggestions table for feedback system
CREATE TABLE IF NOT EXISTS suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('feedback', 'feature', 'bug', 'general')) DEFAULT 'feedback',
  status TEXT CHECK (status IN ('pending', 'reviewed', 'planned', 'completed')) DEFAULT 'pending',
  created_by UUID REFERENCES/users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions FORCE ROW LEVEL SECURITY;

-- Policies for suggestions
DROP POLICY IF EXISTS "Users can view suggestions in their school" ON suggestions;
CREATE POLICY "Users can view suggestions in their school" ON suggestions
  FOR SELECT USING (school_id IN (SELECT school_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert suggestions" ON suggestions;
CREATE POLICY "Users can insert suggestions" ON suggestions
  FOR INSERT WITH CHECK (school_id IN (SELECT school_id FROM users WHERE id = auth.uid()));

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_suggestions_school_status ON suggestions(school_id, status);
CREATE INDEX IF NOT EXISTS idx_grades_aoi ON grades(assessment_type) WHERE assessment_type = 'aoi';

-- Update comment
COMMENT ON COLUMN grades.assessment_type IS 'Assessment type: ca1, ca2, ca3, ca4, project, aoi (Activities of Integration for NCDC new curriculum), exam';
COMMENT ON COLUMN subjects.uses_aoi IS 'Whether subject uses Activities of Integration (AOI) for assessment under NCDC new curriculum';
COMMENT ON COLUMN subjects.competency_focus IS 'Primary competency focus: developing, demonstrates, extends, mastered';
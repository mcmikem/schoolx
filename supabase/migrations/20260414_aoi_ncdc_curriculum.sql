-- Add AOI (Activities of Integration) for NCDC curriculum
-- Activities of Integration (AOI) contribute 20% to final grade under new curriculum

-- Add competency tracking for subjects
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS competency_focus TEXT DEFAULT 'demonstrates';
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS uses_aoi BOOLEAN DEFAULT false;

-- Add competency_notes to grades for new curriculum reporting
ALTER TABLE grades ADD COLUMN IF NOT EXISTS competency_notes TEXT;

-- Add AOI to assessment_type enum (run separately if error)
DO $$
BEGIN
  PERFORM 1 FROM pg_enum WHERE enumlabel = 'aoi' AND enumtypid = 'assessment_type'::regtype;
  IF NOT FOUND THEN
    ALTER TYPE assessment_type ADD VALUE 'aoi';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Suggestions table for feedback system
CREATE TABLE IF NOT EXISTS suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('feedback', 'feature', 'bug', 'general')) DEFAULT 'feedback',
  status TEXT CHECK (status IN ('pending', 'reviewed', 'planned', 'completed')) DEFAULT 'pending',
  created_by UUID REFERENCES "users"(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions FORCE ROW LEVEL SECURITY;

-- RLS Policies for suggestions
DROP POLICY IF EXISTS "suggestions_view_own_school" ON suggestions;
CREATE POLICY "suggestions_view_own_school" ON suggestions
  FOR SELECT USING (school_id IN (SELECT school_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "suggestions_insert_own_school" ON suggestions;
CREATE POLICY "suggestions_insert_own_school" ON suggestions
  FOR INSERT WITH CHECK (school_id IN (SELECT school_id FROM users WHERE id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_suggestions_school_status ON suggestions(school_id, status);

-- Column comments
COMMENT ON COLUMN grades.assessment_type IS 'Assessment type: ca1, ca2, ca3, ca4, project, aoi, exam';
COMMENT ON COLUMN subjects.uses_aoi IS 'Whether subject uses Activities of Integration (AOI)';
COMMENT ON COLUMN subjects.competency_focus IS 'Primary competency focus: developing, demonstrates, extends, mastered';
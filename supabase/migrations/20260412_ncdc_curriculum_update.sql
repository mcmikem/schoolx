-- NCDC Curriculum 2025 Updates
-- Adds stream tracking and cross-cutting themes for CBC compliance

-- 1. Add stream column to classes table for S1-S4 stream tracking
ALTER TABLE classes ADD COLUMN IF NOT EXISTS stream TEXT 
  CHECK (stream IN ('Science', 'Arts', 'Commercial', NULL));

-- 2. Add is_thematic column to subjects table  
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS is_thematic BOOLEAN DEFAULT false;

-- 3. Add cross_cutting_theme column to syllabus table for NCDC themes
ALTER TABLE syllabus ADD COLUMN IF NOT EXISTS cross_cutting_theme TEXT[];

-- 4. Add competency_level column to grades for CBC assessment
ALTER TABLE grades ADD COLUMN IF NOT EXISTS competency_level TEXT 
  CHECK (competency_level IN ('not_started', 'developing', 'demonstrates', 'mastered', 'extended', NULL));

-- 5. Add assessment_type column to indicate numerical vs competency
ALTER TABLE grades ADD COLUMN IF NOT EXISTS assessment_type TEXT DEFAULT 'numerical' 
  CHECK (assessment_type IN ('numerical', 'competency', 'both'));

-- 6. Add school_type for thematic curriculum tracking
ALTER TABLE schools ADD COLUMN IF NOT EXISTS school_type TEXT DEFAULT 'primary'
  CHECK (school_type IN ('primary', 'secondary', 'combined'));

-- 7. Create index for stream-based class queries
CREATE INDEX IF NOT EXISTS idx_classes_stream ON classes(stream) WHERE stream IS NOT NULL;

-- 8. Create index for cross-cutting theme queries
CREATE INDEX IF NOT EXISTS idx_syllabus_themes ON syllabus((cross_cutting_theme[])) 
  WHERE cross_cutting_theme IS NOT NULL;

-- Enable RLS
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE syllabus ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

-- Classes policies
CREATE POLICY "Users can view classes" ON classes FOR SELECT USING (true);
CREATE POLICY "Admins can manage classes" ON classes FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('headmaster', 'school_admin', 'super_admin'))
);

-- Syllabus policies  
CREATE POLICY "Users can view syllabus" ON syllabus FOR SELECT USING (true);
CREATE POLICY "Teachers can manage syllabus" ON syllabus FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('headmaster', 'teacher', 'dean_of_studies'))
);

-- Grades policies
CREATE POLICY "Users can view grades" ON grades FOR SELECT USING (true);
CREATE POLICY "Teachers can manage grades" ON grades FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('headmaster', 'teacher', 'dean_of_studies', 'bursar'))
);

COMMENT ON COLUMN classes.stream IS 'Academic stream for S1-S4: Science, Arts, or Commercial';
COMMENT ON COLUMN subjects.is_thematic IS 'True for P1-P3 thematic curriculum subjects';
COMMENT ON COLUMN syllabus.cross_cutting_theme IS 'NCDC cross-cutting themes: climate, ict, entrepreneurship, gender, health, peace, community';
COMMENT ON COLUMN grades.competency_level IS 'CBC competency levels: not_started, developing, demonstrates, mastered, extended';
COMMENT ON COLUMN grades.assessment_type IS 'Assessment format: numerical (0-100) or competency-based';
COMMENT ON COLUMN schools.school_type IS 'School level: primary, secondary, or combined';
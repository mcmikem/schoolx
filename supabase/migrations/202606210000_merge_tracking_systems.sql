-- Merge syllabus_timeline columns into topic_coverage
-- The syllabus_timeline and topic_performance tables are kept as legacy
-- but all new development should use topic_coverage which now has the extra columns.

-- Add syllabus_timeline columns to topic_coverage
ALTER TABLE topic_coverage
  ADD COLUMN IF NOT EXISTS completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  ADD COLUMN IF NOT EXISTS lessons_planned INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lessons_completed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS student_comprehension_rating INTEGER CHECK (student_comprehension_rating >= 1 AND student_comprehension_rating <= 5),
  ADD COLUMN IF NOT EXISTS teacher_notes TEXT,
  ADD COLUMN IF NOT EXISTS challenges TEXT,
  ADD COLUMN IF NOT EXISTS adaptations_made TEXT,
  ADD COLUMN IF NOT EXISTS week_number INTEGER,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add index on topic_coverage for faster lookups
CREATE INDEX IF NOT EXISTS idx_topic_coverage_syllabus_status ON topic_coverage(syllabus_id, status);
CREATE INDEX IF NOT EXISTS idx_topic_coverage_class_status ON topic_coverage(class_id, status);

-- Academics stability patch
-- Aligns lesson planning, syllabus coverage, and course management tables

CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'core',
    is_active BOOLEAN DEFAULT true,
    is_elective BOOLEAN DEFAULT false,
    is_laboratory BOOLEAN DEFAULT false,
    credit_hours INTEGER DEFAULT 0,
    max_score INTEGER DEFAULT 100,
    passing_score INTEGER DEFAULT 50,
    color TEXT DEFAULT '#3b82f6',
    icon TEXT DEFAULT 'menu_book',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, code)
);

ALTER TABLE lesson_plans ADD COLUMN IF NOT EXISTS week_number INTEGER;
ALTER TABLE lesson_plans ADD COLUMN IF NOT EXISTS lesson_number INTEGER;
ALTER TABLE lesson_plans ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE lesson_plans ADD COLUMN IF NOT EXISTS lesson_title TEXT;
ALTER TABLE lesson_plans ADD COLUMN IF NOT EXISTS subtopics TEXT;
ALTER TABLE lesson_plans ADD COLUMN IF NOT EXISTS materials_needed TEXT;
ALTER TABLE lesson_plans ADD COLUMN IF NOT EXISTS assessment TEXT;
ALTER TABLE lesson_plans ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE lesson_plans ADD COLUMN IF NOT EXISTS lesson_date DATE;
ALTER TABLE lesson_plans ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';

ALTER TABLE topic_coverage ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL;
ALTER TABLE topic_coverage ADD COLUMN IF NOT EXISTS topic_name TEXT;
ALTER TABLE topic_coverage ADD COLUMN IF NOT EXISTS term INTEGER;
ALTER TABLE topic_coverage ADD COLUMN IF NOT EXISTS academic_year TEXT;

CREATE INDEX IF NOT EXISTS idx_topic_coverage_lookup
  ON topic_coverage(class_id, subject_id, term, academic_year);

CREATE INDEX IF NOT EXISTS idx_lesson_plans_teacher_term
  ON lesson_plans(teacher_id, term, academic_year);

CREATE INDEX IF NOT EXISTS idx_courses_school_name
  ON courses(school_id, name);

-- CBC/NCDC Report Card Support
-- Adds assessment types and topic tracking for the Ugandan Competency-Based Curriculum

-- Extend grades.assessment_type to support u1, u2, eot
ALTER TABLE grades DROP CONSTRAINT IF EXISTS grades_assessment_type_check;
ALTER TABLE grades ADD CONSTRAINT grades_assessment_type_check
  CHECK (assessment_type IN ('ca1', 'ca2', 'ca3', 'ca4', 'project', 'exam', 'competency', 'u1', 'u2', 'eot'));

-- Add topic_name column for learning outcome identification per grade row
ALTER TABLE grades ADD COLUMN IF NOT EXISTS topic_name TEXT;

-- Add teacher_remark column for per-subject teacher remarks
ALTER TABLE grades ADD COLUMN IF NOT EXISTS teacher_remark TEXT;

-- Add identifier_score column for CBC identifier scores (1.0-3.0 scale)
-- This is distinct from the raw score which stores the out-of-max score
ALTER TABLE grades ADD COLUMN IF NOT EXISTS identifier_score NUMERIC(3,1);

-- Extend report_cards to store CBC-specific data
ALTER TABLE report_cards ADD COLUMN IF NOT EXISTS report_format TEXT DEFAULT 'numerical'
  CHECK (report_format IN ('numerical', 'competency', 'cbc'));
ALTER TABLE report_cards ADD COLUMN IF NOT EXISTS identifier_total NUMERIC;
ALTER TABLE report_cards ADD COLUMN IF NOT EXISTS formative_total NUMERIC;
ALTER TABLE report_cards ADD COLUMN IF NOT EXISTS summative_total NUMERIC;
ALTER TABLE report_cards ADD COLUMN IF NOT EXISTS grading_scheme JSONB;
ALTER TABLE report_cards ADD COLUMN IF NOT EXISTS date_of_issue DATE;
ALTER TABLE report_cards ADD COLUMN IF NOT EXISTS next_term_opens DATE;
ALTER TABLE report_cards ADD COLUMN IF NOT EXISTS class_teacher_name TEXT;
ALTER TABLE report_cards ADD COLUMN IF NOT EXISTS head_teacher_name TEXT;

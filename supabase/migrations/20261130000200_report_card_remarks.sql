-- ============================================================================
-- Persist report-card remarks.
-- ---------------------------------------------------------------------------
-- The class-teacher and head-teacher remarks were React state only: every
-- visit to the report-cards page regenerated the cards from `grades`, started
-- from a blank map and threw away whatever the teacher had written. A remark
-- was lost on navigation and could not be shared.
--
-- The remarks live on the report_cards row, which already holds exactly one
-- card per pupil per term (UNIQUE(student_id, academic_year, term)), so no
-- new table is needed and the existing teacher class scope keeps working:
--
--   "School users report_cards all"  (202611030001_teacher_class_scope.sql)
--     USING (school_id = my_school_id() AND is_staff_role()
--            AND in_teachers_scope(class_id, student_id))
--
-- A teacher may write remarks for pupils in the classes they teach, other
-- staff of the school may write any, and parents keep read access.
--
-- This migration adds columns only. It calls no helper function, so it does
-- not depend on any migration being applied before it.
-- ============================================================================

ALTER TABLE public.report_cards
  ADD COLUMN IF NOT EXISTS class_teacher_remark TEXT,
  ADD COLUMN IF NOT EXISTS head_teacher_remark TEXT,
  ADD COLUMN IF NOT EXISTS remark_updated_at TIMESTAMPTZ;

-- The page reads a whole class's remarks in one query when the class is
-- picked.
CREATE INDEX IF NOT EXISTS idx_report_cards_class_term
  ON public.report_cards (class_id, academic_year, term);

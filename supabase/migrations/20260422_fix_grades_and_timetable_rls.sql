-- Migration: Fix grades RLS for upsert + ensure timetable_slots INSERT policy
-- Ensures grade saving works for school admins, headmasters, teachers and bursars.

-- ─── Ensure grades table has required columns ─────────────────────────────────
ALTER TABLE grades
  ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('draft', 'submitted', 'approved', 'published')) DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ─── Ensure the unique constraint exists for upsert onConflict ───────────────
-- The upsert uses onConflict: "student_id,subject_id,assessment_type,term,academic_year"
-- If it already exists, this is a no-op.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'grades_student_id_subject_id_assessment_type_term_academic_year_key'
      AND conrelid = 'grades'::regclass
  ) THEN
    ALTER TABLE grades
      ADD CONSTRAINT grades_student_id_subject_id_assessment_type_term_academic_year_key
      UNIQUE (student_id, subject_id, assessment_type, term, academic_year);
  END IF;
END $$;

-- ─── Clean up conflicting grades RLS policies ────────────────────────────────
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School data access" ON grades;
DROP POLICY IF EXISTS "grades_all" ON grades;
DROP POLICY IF EXISTS "super_admin all grades" ON grades;
DROP POLICY IF EXISTS "users access own school grades" ON grades;
DROP POLICY IF EXISTS "School users grades select" ON grades;
DROP POLICY IF EXISTS "School users grades write" ON grades;
DROP POLICY IF EXISTS "School users access own school grades" ON grades;
DROP POLICY IF EXISTS "Users can view grades" ON grades;
DROP POLICY IF EXISTS "Teachers can manage grades" ON grades;
DROP POLICY IF EXISTS "grades_select" ON grades;
DROP POLICY IF EXISTS "grades_insert" ON grades;
DROP POLICY IF EXISTS "grades_update" ON grades;

-- Single clean policy using my_school_id()
CREATE POLICY grades_school_all ON grades
  FOR ALL
  USING  (class_id IN (SELECT id FROM classes WHERE school_id = my_school_id()))
  WITH CHECK (class_id IN (SELECT id FROM classes WHERE school_id = my_school_id()));

-- ─── timetable_slots: ensure INSERT WITH CHECK is explicit ────────────────────
-- The existing policy from phase2_operations.sql only covers SELECT for non-admins.
-- Admins already have FOR ALL. We just ensure it's idempotent.
DROP POLICY IF EXISTS "Admins can manage timetable slots" ON timetable_slots;
DROP POLICY IF EXISTS "School users can view timetable slots" ON timetable_slots;

ALTER TABLE timetable_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY timetable_slots_school ON timetable_slots
  FOR ALL
  USING  (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());

-- ─── teacher_timetable: add explicit WITH CHECK for INSERT ────────────────────
DROP POLICY IF EXISTS teacher_timetable_school ON teacher_timetable;

ALTER TABLE teacher_timetable ENABLE ROW LEVEL SECURITY;

-- For INSERT: the teacher being assigned must belong to the caller's school.
-- For SELECT/UPDATE/DELETE: same rule applies.
CREATE POLICY teacher_timetable_school ON teacher_timetable
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = teacher_timetable.teacher_id
      AND u.school_id = my_school_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = teacher_timetable.teacher_id
      AND u.school_id = my_school_id()
  ));

-- ─── staff_reviews: ensure school-level access ────────────────────────────────
ALTER TABLE staff_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage staff reviews" ON staff_reviews;
DROP POLICY IF EXISTS "Staff can view their own reviews" ON staff_reviews;
DROP POLICY IF EXISTS staff_reviews_school ON staff_reviews;

CREATE POLICY staff_reviews_school ON staff_reviews
  FOR ALL
  USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());

-- ─── leave_requests: ensure school-level access ───────────────────────────────
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leave_requests_school ON leave_requests;

CREATE POLICY leave_requests_school ON leave_requests
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = leave_requests.staff_id
      AND u.school_id = my_school_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = leave_requests.staff_id
      AND u.school_id = my_school_id()
  ));

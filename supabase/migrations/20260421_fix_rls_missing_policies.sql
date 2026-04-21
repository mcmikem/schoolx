-- Fix missing RLS policies for tables that were causing {} errors
-- Apply this in Supabase SQL Editor: https://supabase.com/dashboard/project/gucxpmgwvnbqykevucbi/sql

-- ─── behavior_logs ───────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.behavior_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "behavior_logs_select" ON public.behavior_logs;
CREATE POLICY "behavior_logs_select" ON public.behavior_logs
  FOR SELECT USING (school_id = my_school_id());

DROP POLICY IF EXISTS "behavior_logs_insert" ON public.behavior_logs;
CREATE POLICY "behavior_logs_insert" ON public.behavior_logs
  FOR INSERT WITH CHECK (school_id = my_school_id());

DROP POLICY IF EXISTS "behavior_logs_update" ON public.behavior_logs;
CREATE POLICY "behavior_logs_update" ON public.behavior_logs
  FOR UPDATE USING (school_id = my_school_id());

DROP POLICY IF EXISTS "behavior_logs_delete" ON public.behavior_logs;
CREATE POLICY "behavior_logs_delete" ON public.behavior_logs
  FOR DELETE USING (school_id = my_school_id());

-- ─── timetable_slots ─────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.timetable_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "timetable_slots_select" ON public.timetable_slots;
CREATE POLICY "timetable_slots_select" ON public.timetable_slots
  FOR SELECT USING (school_id = my_school_id());

DROP POLICY IF EXISTS "timetable_slots_insert" ON public.timetable_slots;
CREATE POLICY "timetable_slots_insert" ON public.timetable_slots
  FOR INSERT WITH CHECK (school_id = my_school_id());

DROP POLICY IF EXISTS "timetable_slots_update" ON public.timetable_slots;
CREATE POLICY "timetable_slots_update" ON public.timetable_slots
  FOR UPDATE USING (school_id = my_school_id());

DROP POLICY IF EXISTS "timetable_slots_delete" ON public.timetable_slots;
CREATE POLICY "timetable_slots_delete" ON public.timetable_slots
  FOR DELETE USING (school_id = my_school_id());

-- ─── timetable_constraints ───────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.timetable_constraints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "timetable_constraints_select" ON public.timetable_constraints;
CREATE POLICY "timetable_constraints_select" ON public.timetable_constraints
  FOR SELECT USING (school_id = my_school_id());

DROP POLICY IF EXISTS "timetable_constraints_insert" ON public.timetable_constraints;
CREATE POLICY "timetable_constraints_insert" ON public.timetable_constraints
  FOR INSERT WITH CHECK (school_id = my_school_id());

-- ─── teacher_timetable ───────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.teacher_timetable ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teacher_timetable_select" ON public.teacher_timetable;
CREATE POLICY "teacher_timetable_select" ON public.teacher_timetable
  FOR SELECT USING (
    class_id IN (SELECT id FROM public.classes WHERE school_id = my_school_id())
  );

DROP POLICY IF EXISTS "teacher_timetable_insert" ON public.teacher_timetable;
CREATE POLICY "teacher_timetable_insert" ON public.teacher_timetable
  FOR INSERT WITH CHECK (
    class_id IN (SELECT id FROM public.classes WHERE school_id = my_school_id())
  );

DROP POLICY IF EXISTS "teacher_timetable_delete" ON public.teacher_timetable;
CREATE POLICY "teacher_timetable_delete" ON public.teacher_timetable
  FOR DELETE USING (
    class_id IN (SELECT id FROM public.classes WHERE school_id = my_school_id())
  );

-- ─── leave_requests ──────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leave_requests_select" ON public.leave_requests;
CREATE POLICY "leave_requests_select" ON public.leave_requests
  FOR SELECT USING (school_id = my_school_id());

DROP POLICY IF EXISTS "leave_requests_insert" ON public.leave_requests;
CREATE POLICY "leave_requests_insert" ON public.leave_requests
  FOR INSERT WITH CHECK (school_id = my_school_id());

DROP POLICY IF EXISTS "leave_requests_update" ON public.leave_requests;
CREATE POLICY "leave_requests_update" ON public.leave_requests
  FOR UPDATE USING (school_id = my_school_id());

-- ─── leave_approvals ─────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.leave_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leave_approvals_select" ON public.leave_approvals;
CREATE POLICY "leave_approvals_select" ON public.leave_approvals
  FOR SELECT USING (
    leave_request_id IN (
      SELECT id FROM public.leave_requests WHERE school_id = my_school_id()
    )
  );

DROP POLICY IF EXISTS "leave_approvals_insert" ON public.leave_approvals;
CREATE POLICY "leave_approvals_insert" ON public.leave_approvals
  FOR INSERT WITH CHECK (
    leave_request_id IN (
      SELECT id FROM public.leave_requests WHERE school_id = my_school_id()
    )
  );

-- ─── staff_reviews ───────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.staff_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_reviews_select" ON public.staff_reviews;
CREATE POLICY "staff_reviews_select" ON public.staff_reviews
  FOR SELECT USING (school_id = my_school_id());

DROP POLICY IF EXISTS "staff_reviews_insert" ON public.staff_reviews;
CREATE POLICY "staff_reviews_insert" ON public.staff_reviews
  FOR INSERT WITH CHECK (school_id = my_school_id());

-- ─── student_enrollments ─────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.student_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_enrollments_select" ON public.student_enrollments;
CREATE POLICY "student_enrollments_select" ON public.student_enrollments
  FOR SELECT USING (school_id = my_school_id());

DROP POLICY IF EXISTS "student_enrollments_insert" ON public.student_enrollments;
CREATE POLICY "student_enrollments_insert" ON public.student_enrollments
  FOR INSERT WITH CHECK (school_id = my_school_id());

DROP POLICY IF EXISTS "student_enrollments_update" ON public.student_enrollments;
CREATE POLICY "student_enrollments_update" ON public.student_enrollments
  FOR UPDATE USING (school_id = my_school_id());

DROP POLICY IF EXISTS "student_enrollments_delete" ON public.student_enrollments;
CREATE POLICY "student_enrollments_delete" ON public.student_enrollments
  FOR DELETE USING (school_id = my_school_id());

-- ─── grades ──────────────────────────────────────────────────────────────────
-- Ensure grades has a unique constraint for upsert to work
-- (only adds if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'grades_student_subject_assessment_term_year_unique'
  ) THEN
    ALTER TABLE public.grades
      ADD CONSTRAINT grades_student_subject_assessment_term_year_unique
      UNIQUE (student_id, subject_id, assessment_type, term, academic_year);
  END IF;
EXCEPTION WHEN others THEN
  -- Ignore if table or constraint has issues
  NULL;
END $$;

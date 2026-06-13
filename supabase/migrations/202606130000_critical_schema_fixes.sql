-- ============================================================================
-- Critical Schema Fixes — June 2026
--
-- 1. is_school_admin() zero-arg overload (compat for meal_service_rules RLS)
-- 2. is_school_staff() SECURITY DEFINER helper (used by migration policies)
-- 3. Fix lesson_plans RLS — was missing school_id scope (security bug)
-- 4. Add missing indexes on foreign keys for performance
-- ============================================================================

-- ============================================================================
-- 1. is_school_admin() zero-argument overload
-- ============================================================================
-- Used by RLS policies that call is_school_admin() without explicit school_id.
-- Delegates to the parameterized version using my_school_id().
CREATE OR REPLACE FUNCTION is_school_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT is_school_admin(my_school_id())
$$;

-- ============================================================================
-- 2. is_school_staff() helper
-- ============================================================================
-- Returns true if the authenticated user is staff (teacher, admin, etc.) at the
-- given school. Used by RLS policies for teacher-scoped tables.
CREATE OR REPLACE FUNCTION is_school_staff(p_school_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
      AND school_id = p_school_id
      AND role IN ('school_admin', 'headmaster', 'admin', 'super_admin', 'teacher', 'class_teacher', 'deputy_head')
  )
$$;

-- ============================================================================
-- 3. Fix lesson_plans RLS — was missing school_id scope
-- ============================================================================
-- The previous policy allowed ANY school's staff to see ALL lesson_plans.
DROP POLICY IF EXISTS "School staff lesson_plans all" ON lesson_plans;
CREATE POLICY "School staff lesson_plans all"
ON lesson_plans
FOR ALL
TO authenticated
USING (school_id = my_school_id() AND is_school_staff(my_school_id()))
WITH CHECK (school_id = my_school_id() AND is_school_staff(my_school_id()));

-- ============================================================================
-- 4. Missing indexes on foreign keys
-- ============================================================================
-- These cover the most critical unindexed FKs identified in the audit

-- student_fees (core financial table)
CREATE INDEX IF NOT EXISTS idx_student_fees_student ON student_fees(student_id);

-- student_grades
CREATE INDEX IF NOT EXISTS idx_student_grades_student ON student_grades(student_id);
CREATE INDEX IF NOT EXISTS idx_student_grades_subject ON student_grades(subject_id);

-- syllabus
CREATE INDEX IF NOT EXISTS idx_syllabus_school ON syllabus(school_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_subject ON syllabus(subject_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_class ON syllabus(class_id);

-- exams
CREATE INDEX IF NOT EXISTS idx_exams_school ON exams(school_id);
CREATE INDEX IF NOT EXISTS idx_exams_class ON exams(class_id);
CREATE INDEX IF NOT EXISTS idx_exams_subject ON exams(subject_id);

-- exam_scores
CREATE INDEX IF NOT EXISTS idx_exam_scores_student ON exam_scores(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_scores_exam ON exam_scores(exam_id);

-- homework
CREATE INDEX IF NOT EXISTS idx_homework_school ON homework(school_id);
CREATE INDEX IF NOT EXISTS idx_homework_class ON homework(class_id);

-- homework_submissions
CREATE INDEX IF NOT EXISTS idx_homework_submissions_homework ON homework_submissions(homework_id);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_student ON homework_submissions(student_id);

-- dorm_attendance
CREATE INDEX IF NOT EXISTS idx_dorm_attendance_dorm ON dorm_attendance(dorm_id);
CREATE INDEX IF NOT EXISTS idx_dorm_attendance_student ON dorm_attendance(student_id);

-- student_promotions
CREATE INDEX IF NOT EXISTS idx_student_promotions_student ON student_promotions(student_id);

-- lesson_plans
CREATE INDEX IF NOT EXISTS idx_lesson_plans_school ON lesson_plans(school_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_teacher ON lesson_plans(teacher_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_class ON lesson_plans(class_id);

-- expenses
CREATE INDEX IF NOT EXISTS idx_expenses_school ON expenses(school_id);
CREATE INDEX IF NOT EXISTS idx_expenses_budget ON expenses(budget_id);

-- behavior_logs
CREATE INDEX IF NOT EXISTS idx_behavior_logs_student ON behavior_logs(student_id);

-- health_records
CREATE INDEX IF NOT EXISTS idx_health_records_student ON health_records(student_id);

-- health_visits
CREATE INDEX IF NOT EXISTS idx_health_visits_student ON health_visits(student_id);

-- assets
CREATE INDEX IF NOT EXISTS idx_assets_school ON assets(school_id);

-- transport_routes
CREATE INDEX IF NOT EXISTS idx_transport_routes_school ON transport_routes(school_id);

-- budgets
CREATE INDEX IF NOT EXISTS idx_budgets_school ON budgets(school_id);

-- leave_requests
CREATE INDEX IF NOT EXISTS idx_leave_requests_school ON leave_requests(school_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_staff ON leave_requests(staff_id);

-- payment_plans
CREATE INDEX IF NOT EXISTS idx_payment_plans_school ON payment_plans(school_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_student ON payment_plans(student_id);

-- payment_plan_installments
CREATE INDEX IF NOT EXISTS idx_payment_plan_installments_plan ON payment_plan_installments(plan_id);

-- uneb_candidates
CREATE INDEX IF NOT EXISTS idx_uneb_candidates_school ON uneb_candidates(school_id);
CREATE INDEX IF NOT EXISTS idx_uneb_candidates_student ON uneb_candidates(student_id);

-- dorms
CREATE INDEX IF NOT EXISTS idx_dorms_school ON dorms(school_id);

-- teacher_timetable
CREATE INDEX IF NOT EXISTS idx_teacher_timetable_teacher ON teacher_timetable(teacher_id);

-- Fix: 27 tables had RLS enabled but zero policies → completely blocked.
-- Strategy: school-scoped access via my_school_id() for tables with school_id;
--           join through users/students/assets for tables without direct school_id.
-- Applied 2026-04-21.

-- ─── Tables with direct school_id ────────────────────────────────────────────

-- academic_years
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS academic_years_school ON academic_years;
CREATE POLICY academic_years_school ON academic_years
  USING (school_id = my_school_id());

-- assets
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS assets_school ON assets;
CREATE POLICY assets_school ON assets
  USING (school_id = my_school_id());

-- audit_log (read-only by school members; insert allowed from service role)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_log_school_select ON audit_log;
CREATE POLICY audit_log_school_select ON audit_log FOR SELECT
  USING (school_id = my_school_id());
DROP POLICY IF EXISTS audit_log_school_insert ON audit_log;
CREATE POLICY audit_log_school_insert ON audit_log FOR INSERT
  WITH CHECK (school_id = my_school_id());

-- budgets
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS budgets_school ON budgets;
CREATE POLICY budgets_school ON budgets
  USING (school_id = my_school_id());

-- dorm_attendance
ALTER TABLE dorm_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dorm_attendance_school ON dorm_attendance;
CREATE POLICY dorm_attendance_school ON dorm_attendance
  USING (school_id = my_school_id());

-- exams
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS exams_school ON exams;
CREATE POLICY exams_school ON exams
  USING (school_id = my_school_id());

-- expense_approvals
ALTER TABLE expense_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS expense_approvals_school ON expense_approvals;
CREATE POLICY expense_approvals_school ON expense_approvals
  USING (school_id = my_school_id());

-- expenses
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS expenses_school ON expenses;
CREATE POLICY expenses_school ON expenses
  USING (school_id = my_school_id());

-- leave_approvals
ALTER TABLE leave_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leave_approvals_school ON leave_approvals;
CREATE POLICY leave_approvals_school ON leave_approvals
  USING (school_id = my_school_id());

-- library_books
ALTER TABLE library_books ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS library_books_school ON library_books;
CREATE POLICY library_books_school ON library_books
  USING (school_id = my_school_id());

-- parent_profiles
ALTER TABLE parent_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS parent_profiles_school ON parent_profiles;
CREATE POLICY parent_profiles_school ON parent_profiles
  USING (school_id = my_school_id());

-- payment_plans
ALTER TABLE payment_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_plans_school ON payment_plans;
CREATE POLICY payment_plans_school ON payment_plans
  USING (school_id = my_school_id());

-- scheme_of_work
ALTER TABLE scheme_of_work ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scheme_of_work_school ON scheme_of_work;
CREATE POLICY scheme_of_work_school ON scheme_of_work
  USING (school_id = my_school_id());

-- student_promotions
ALTER TABLE student_promotions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS student_promotions_school ON student_promotions;
CREATE POLICY student_promotions_school ON student_promotions
  USING (school_id = my_school_id());

-- terms
ALTER TABLE terms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS terms_school ON terms;
CREATE POLICY terms_school ON terms
  USING (school_id = my_school_id());

-- ─── Tables joined through students ──────────────────────────────────────────

-- behavior_logs (student_id → students.school_id)
ALTER TABLE behavior_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS behavior_logs_school ON behavior_logs;
CREATE POLICY behavior_logs_school ON behavior_logs
  USING (EXISTS (
    SELECT 1 FROM students s WHERE s.id = behavior_logs.student_id AND s.school_id = my_school_id()
  ));

-- exam_scores (student_id → students.school_id)
ALTER TABLE exam_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS exam_scores_school ON exam_scores;
CREATE POLICY exam_scores_school ON exam_scores
  USING (EXISTS (
    SELECT 1 FROM students s WHERE s.id = exam_scores.student_id AND s.school_id = my_school_id()
  ));

-- health_records (student_id → students.school_id)
ALTER TABLE health_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS health_records_school ON health_records;
CREATE POLICY health_records_school ON health_records
  USING (EXISTS (
    SELECT 1 FROM students s WHERE s.id = health_records.student_id AND s.school_id = my_school_id()
  ));

-- health_visits (student_id → students.school_id)
ALTER TABLE health_visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS health_visits_school ON health_visits;
CREATE POLICY health_visits_school ON health_visits
  USING (EXISTS (
    SELECT 1 FROM students s WHERE s.id = health_visits.student_id AND s.school_id = my_school_id()
  ));

-- library_checkouts (student_id → students.school_id)
ALTER TABLE library_checkouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS library_checkouts_school ON library_checkouts;
CREATE POLICY library_checkouts_school ON library_checkouts
  USING (EXISTS (
    SELECT 1 FROM students s WHERE s.id = library_checkouts.student_id AND s.school_id = my_school_id()
  ));

-- ─── Tables joined through teachers/users ────────────────────────────────────

-- leave_requests (staff_id → users.school_id)
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leave_requests_school ON leave_requests;
CREATE POLICY leave_requests_school ON leave_requests
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = leave_requests.staff_id AND u.school_id = my_school_id()
  ));

-- subject_allocations (teacher_id → users.school_id)
ALTER TABLE subject_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subject_allocations_school ON subject_allocations;
CREATE POLICY subject_allocations_school ON subject_allocations
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = subject_allocations.teacher_id AND u.school_id = my_school_id()
  ));

-- teacher_subjects (teacher_id → users.school_id)
ALTER TABLE teacher_subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS teacher_subjects_school ON teacher_subjects;
CREATE POLICY teacher_subjects_school ON teacher_subjects
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = teacher_subjects.teacher_id AND u.school_id = my_school_id()
  ));

-- teacher_timetable (teacher_id → users.school_id)
ALTER TABLE teacher_timetable ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS teacher_timetable_school ON teacher_timetable;
CREATE POLICY teacher_timetable_school ON teacher_timetable
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = teacher_timetable.teacher_id AND u.school_id = my_school_id()
  ));

-- ─── Tables joined through payment_plans ─────────────────────────────────────

-- payment_plan_installments (plan_id → payment_plans.school_id)
ALTER TABLE payment_plan_installments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_plan_installments_school ON payment_plan_installments;
CREATE POLICY payment_plan_installments_school ON payment_plan_installments
  USING (EXISTS (
    SELECT 1 FROM payment_plans pp WHERE pp.id = payment_plan_installments.plan_id AND pp.school_id = my_school_id()
  ));

-- ─── Tables joined through assets ────────────────────────────────────────────

-- asset_assignments (asset_id → assets.school_id)
ALTER TABLE asset_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS asset_assignments_school ON asset_assignments;
CREATE POLICY asset_assignments_school ON asset_assignments
  USING (EXISTS (
    SELECT 1 FROM assets a WHERE a.id = asset_assignments.asset_id AND a.school_id = my_school_id()
  ));

-- ─── User-scoped tables ───────────────────────────────────────────────────────

-- push_subscriptions (user_id → users.auth_id = auth.uid())
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_subscriptions_own ON push_subscriptions;
CREATE POLICY push_subscriptions_own ON push_subscriptions
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = push_subscriptions.user_id AND u.auth_id = auth.uid()
  ));
DROP POLICY IF EXISTS push_subscriptions_insert ON push_subscriptions;
CREATE POLICY push_subscriptions_insert ON push_subscriptions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM users u WHERE u.id = push_subscriptions.user_id AND u.auth_id = auth.uid()
  ));

-- ─── Transport and UNEB tables ───────────────────────────────────────────────

-- transport_routes (school_id direct)
ALTER TABLE transport_routes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transport_routes_school ON transport_routes;
CREATE POLICY transport_routes_school ON transport_routes
  USING (school_id = my_school_id());

-- transport_students (student_id → students.school_id, route_id → transport_routes.school_id)
ALTER TABLE transport_students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transport_students_school ON transport_students;
CREATE POLICY transport_students_school ON transport_students
  USING (EXISTS (
    SELECT 1 FROM students s WHERE s.id = transport_students.student_id AND s.school_id = my_school_id()
  ));

-- uneb_candidates (school_id direct)
ALTER TABLE uneb_candidates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS uneb_candidates_school ON uneb_candidates;
CREATE POLICY uneb_candidates_school ON uneb_candidates
  USING (school_id = my_school_id());

-- =============================================================================
-- ELIMINATE ALL RECURSIVE RLS PATTERNS ACROSS EVERY TABLE
-- =============================================================================
-- Root problem: every policy that does
--   SELECT users.school_id FROM users WHERE users.auth_id = auth.uid()
-- causes PostgreSQL to re-evaluate the users table's own RLS policies,
-- which (if those policies also query users) causes infinite recursion (42P17).
--
-- Solution: replace every such subquery with my_school_id() which is
-- SECURITY DEFINER — it runs as postgres, bypasses RLS entirely, and returns
-- the same value with zero recursion risk.
--
-- Also fixed: school_workflows policies used users.id = auth.uid() which is
-- WRONG (public.users.id ≠ auth.uid()); corrected to my_school_id().
-- Also fixed: duplicate super_admin schools policies consolidated.
-- =============================================================================

-- ─── attendance ───────────────────────────────────────────────────────────────
-- Old: class_id IN (SELECT classes.id FROM classes WHERE classes.school_id IN
--        (SELECT users.school_id FROM users WHERE users.auth_id = auth.uid()))
-- New: class_id IN (SELECT id FROM classes WHERE school_id = my_school_id())
DROP POLICY IF EXISTS "School users access own school attendance" ON public.attendance;
CREATE POLICY "School users access own school attendance" ON public.attendance
  FOR ALL
  USING (class_id IN (SELECT id FROM classes WHERE school_id = my_school_id()));

-- ─── classes ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "School users access own school classes" ON public.classes;
CREATE POLICY "School users access own school classes" ON public.classes
  FOR ALL
  USING (school_id = my_school_id());

-- ─── fee_payments ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "fee_payments_select" ON public.fee_payments;
CREATE POLICY "fee_payments_select" ON public.fee_payments
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR student_fee_term_id IN (
      SELECT sft.id
      FROM student_fee_terms sft
      JOIN fee_terms ft ON ft.id = sft.fee_term_id
      WHERE ft.school_id = my_school_id()
    )
  );

DROP POLICY IF EXISTS "fee_payments_update" ON public.fee_payments;
CREATE POLICY "fee_payments_update" ON public.fee_payments
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR student_fee_term_id IN (
      SELECT sft.id
      FROM student_fee_terms sft
      JOIN fee_terms ft ON ft.id = sft.fee_term_id
      WHERE ft.school_id = my_school_id()
    )
  );

-- ─── fee_term_lines ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "fee_term_lines_select" ON public.fee_term_lines;
CREATE POLICY "fee_term_lines_select" ON public.fee_term_lines
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR term_id IN (SELECT id FROM fee_terms WHERE school_id = my_school_id())
  );

DROP POLICY IF EXISTS "fee_term_lines_update" ON public.fee_term_lines;
CREATE POLICY "fee_term_lines_update" ON public.fee_term_lines
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR term_id IN (SELECT id FROM fee_terms WHERE school_id = my_school_id())
  );

-- ─── fee_terms ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "fee_terms_select" ON public.fee_terms;
CREATE POLICY "fee_terms_select" ON public.fee_terms
  FOR SELECT
  USING (auth.role() = 'service_role' OR school_id = my_school_id());

DROP POLICY IF EXISTS "fee_terms_update" ON public.fee_terms;
CREATE POLICY "fee_terms_update" ON public.fee_terms
  FOR UPDATE
  USING (auth.role() = 'service_role' OR school_id = my_school_id());

-- ─── grades ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "School users access own school grades" ON public.grades;
CREATE POLICY "School users access own school grades" ON public.grades
  FOR ALL
  USING (class_id IN (SELECT id FROM classes WHERE school_id = my_school_id()));

-- ─── notices ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "School users notices all" ON public.notices;
CREATE POLICY "School users notices all" ON public.notices
  FOR ALL
  USING (school_id = my_school_id());

-- ─── school_settings ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "School users view school settings" ON public.school_settings;
CREATE POLICY "School users view school settings" ON public.school_settings
  FOR SELECT
  USING (school_id = my_school_id());

DROP POLICY IF EXISTS "School users manage school settings" ON public.school_settings;
CREATE POLICY "School users manage school settings" ON public.school_settings
  FOR ALL
  USING (school_id = my_school_id());

-- ─── school_workflows ─────────────────────────────────────────────────────────
-- Old policies also had a bug: users.id = auth.uid() compares the wrong column
-- (public.users.id vs auth.uid() which matches public.users.auth_id).
-- This meant no user could ever match — effectively blocking all access.
DROP POLICY IF EXISTS "school_workflows_select" ON public.school_workflows;
CREATE POLICY "school_workflows_select" ON public.school_workflows
  FOR SELECT
  USING (school_id = my_school_id());

DROP POLICY IF EXISTS "school_workflows_update" ON public.school_workflows;
CREATE POLICY "school_workflows_update" ON public.school_workflows
  FOR UPDATE
  USING (school_id = my_school_id() AND is_school_admin(my_school_id()));

DROP POLICY IF EXISTS "school_workflows_delete" ON public.school_workflows;
CREATE POLICY "school_workflows_delete" ON public.school_workflows
  FOR DELETE
  USING (school_id = my_school_id() AND is_school_admin(my_school_id()));

-- ─── schools ──────────────────────────────────────────────────────────────────
-- Two duplicate super_admin ALL policies both used raw subquery on users.
-- Consolidated into one using is_super_admin() SECURITY DEFINER function.
DROP POLICY IF EXISTS "Super admin schools write" ON public.schools;
DROP POLICY IF EXISTS "Super admin full access" ON public.schools;
CREATE POLICY "Super admin full access" ON public.schools
  FOR ALL
  USING (is_super_admin());

-- ─── setup_checklist ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "School admins manage checklist" ON public.setup_checklist;
CREATE POLICY "School admins manage checklist" ON public.setup_checklist
  FOR ALL
  USING (school_id = my_school_id() AND is_school_admin(my_school_id()));

-- ─── staff_attendance ─────────────────────────────────────────────────────────
-- Old: EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid()
--        AND school_id IN (SELECT users_1.school_id FROM users users_1
--          WHERE users_1.id = staff_attendance.staff_id))
-- New: staff member's school_id = my_school_id()
DROP POLICY IF EXISTS "School users staff_attendance all" ON public.staff_attendance;
CREATE POLICY "School users staff_attendance all" ON public.staff_attendance
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = staff_attendance.staff_id
        AND u.school_id = my_school_id()
    )
  );

-- ─── student_fee_terms ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "student_fee_terms_select" ON public.student_fee_terms;
CREATE POLICY "student_fee_terms_select" ON public.student_fee_terms
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR fee_term_id IN (SELECT id FROM fee_terms WHERE school_id = my_school_id())
  );

DROP POLICY IF EXISTS "student_fee_terms_update" ON public.student_fee_terms;
CREATE POLICY "student_fee_terms_update" ON public.student_fee_terms
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR fee_term_id IN (SELECT id FROM fee_terms WHERE school_id = my_school_id())
  );

-- ─── students ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "School users access own school" ON public.students;
CREATE POLICY "School users access own school" ON public.students
  FOR ALL
  USING (school_id = my_school_id());

-- ─── syllabus ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "syllabus_select" ON public.syllabus;
CREATE POLICY "syllabus_select" ON public.syllabus
  FOR SELECT
  USING (school_id = my_school_id());

DROP POLICY IF EXISTS "syllabus_update" ON public.syllabus;
CREATE POLICY "syllabus_update" ON public.syllabus
  FOR UPDATE
  USING (school_id = my_school_id());

DROP POLICY IF EXISTS "syllabus_delete" ON public.syllabus;
CREATE POLICY "syllabus_delete" ON public.syllabus
  FOR DELETE
  USING (school_id = my_school_id());

-- ─── topic_coverage ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "topic_coverage_select" ON public.topic_coverage;
CREATE POLICY "topic_coverage_select" ON public.topic_coverage
  FOR SELECT
  USING (class_id IN (SELECT id FROM classes WHERE school_id = my_school_id()));

DROP POLICY IF EXISTS "topic_coverage_update" ON public.topic_coverage;
CREATE POLICY "topic_coverage_update" ON public.topic_coverage
  FOR UPDATE
  USING (class_id IN (SELECT id FROM classes WHERE school_id = my_school_id()));

DROP POLICY IF EXISTS "topic_coverage_delete" ON public.topic_coverage;
CREATE POLICY "topic_coverage_delete" ON public.topic_coverage
  FOR DELETE
  USING (class_id IN (SELECT id FROM classes WHERE school_id = my_school_id()));

-- =============================================================================
-- VERIFICATION: After this migration, zero policies should query the users
-- table directly without going through a SECURITY DEFINER function.
-- Run this to confirm:
--   SELECT tablename, policyname FROM pg_policies
--   WHERE schemaname='public'
--     AND qual LIKE '%FROM users%'
--     AND qual NOT LIKE '%my_school_id%'
--     AND qual NOT LIKE '%current_user_school_id%'
--     AND qual NOT LIKE '%is_super_admin%'
--     AND qual NOT LIKE '%is_school_admin%'
--   ORDER BY tablename;
-- Expected result: only parent_students and push_subscriptions (both safe —
-- they query users.id not users.school_id, and users table RLS is recursion-free).
-- =============================================================================

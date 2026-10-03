-- Close the write escalation on the high-value school tables.
--
-- A parent account could create students, mark attendance, record grades, and
-- inject expenses and canteen sales for their own school. Proven on 2026-10-03
-- against production with valid payloads: notices, students, attendance,
-- canteen_sales and expenses all returned HTTP 201 for a `parent` session,
-- while grades and academic_terms passed RLS and were only stopped by a NOT NULL
-- constraint.
--
-- Cause: permissive policies are OR'd together, so a broad `FOR ALL` policy was
-- satisfied alongside -- and therefore defeated -- the narrow role-gated ones
-- that already existed beside it:
--
--     FOR ALL    (school_id = my_school_id())                      -- any member
--     FOR INSERT (school_id = my_school_id() AND is_staff_role())  -- never evaluated
--
-- Several of the broad policies were also granted TO public, which covers anon.
-- They happened to be harmless because my_school_id() yields NULL without an
-- authenticated user, but granting writes to anon is not a defence.
--
-- Scope is deliberate: only tables where the app writes exclusively from staff
-- surfaces or service-role API routes. Verified before writing this --
-- parent-portal and student-portal only ever SELECT from notices, and
-- canteen_sales is written only from the staff POS.
--
-- is_staff_role() is true for every role except parent and student, which
-- matches how students, grades and attendance were already gated.
--
-- NOT touched here: fee_payments and the rest of the 79 tables still carrying a
-- school-only write policy. Those need a per-table intent pass, and a parent
-- legitimately writes some of them.

-- ─── Tables that already have a correctly gated policy ──────────────────────
-- Dropping the broad policy is sufficient; the gated one becomes effective.
-- Nothing has to be created, so there is no window with no write access.

DROP POLICY IF EXISTS "School users access own school" ON public.students;
DROP POLICY IF EXISTS "grades_school_all" ON public.grades;
DROP POLICY IF EXISTS "School users access own school attendance" ON public.attendance;

-- ─── Tables with no gated policy at all ─────────────────────────────────────
-- The open policies go, and a role-gated replacement goes in the same
-- transaction, so these tables are never left unwritable.

DROP POLICY IF EXISTS "exam_scores_all" ON public.exam_scores;
DROP POLICY IF EXISTS "exam_scores_school" ON public.exam_scores;
CREATE POLICY "exam_scores_staff_write" ON public.exam_scores
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = exam_scores.student_id AND s.school_id = my_school_id()
    ) AND is_staff_role()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = exam_scores.student_id AND s.school_id = my_school_id()
    ) AND is_staff_role()
  );

DROP POLICY IF EXISTS "School users expenses all" ON public.expenses;
DROP POLICY IF EXISTS "expenses_all" ON public.expenses;
DROP POLICY IF EXISTS "expenses_school" ON public.expenses;
CREATE POLICY "expenses_staff_write" ON public.expenses
  FOR ALL TO authenticated
  USING (school_id = my_school_id() AND is_staff_role())
  WITH CHECK (school_id = my_school_id() AND is_staff_role());

DROP POLICY IF EXISTS "budgets_all" ON public.budgets;
DROP POLICY IF EXISTS "budgets_school" ON public.budgets;
CREATE POLICY "budgets_staff_write" ON public.budgets
  FOR ALL TO authenticated
  USING (school_id = my_school_id() AND is_staff_role())
  WITH CHECK (school_id = my_school_id() AND is_staff_role());

DROP POLICY IF EXISTS "School users canteen_sales all" ON public.canteen_sales;
CREATE POLICY "canteen_sales_staff_write" ON public.canteen_sales
  FOR ALL TO authenticated
  USING (school_id = my_school_id() AND is_staff_role())
  WITH CHECK (school_id = my_school_id() AND is_staff_role());

-- Salaries are visible to staff but changeable only by an admin: a bursar or a
-- DOS should not be able to alter what the school pays. USING governs what a row
-- may be selected/updated, WITH CHECK what a new or updated row may contain.
DROP POLICY IF EXISTS "staff_salaries_school" ON public.staff_salaries;
CREATE POLICY "staff_salaries_staff_read_admin_write" ON public.staff_salaries
  FOR ALL TO authenticated
  USING (school_id = my_school_id() AND is_staff_role())
  WITH CHECK (school_id = my_school_id() AND is_school_admin(my_school_id()));

DROP POLICY IF EXISTS "School users notices all" ON public.notices;
CREATE POLICY "notices_staff_write" ON public.notices
  FOR ALL TO authenticated
  USING (school_id = my_school_id() AND is_staff_role())
  WITH CHECK (school_id = my_school_id() AND is_staff_role());

DROP POLICY IF EXISTS "health_records_school" ON public.health_records;
CREATE POLICY "health_records_staff_write" ON public.health_records
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = health_records.student_id AND s.school_id = my_school_id()
    ) AND is_staff_role()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = health_records.student_id AND s.school_id = my_school_id()
    ) AND is_staff_role()
  );

-- academic_terms keeps its service_role policies untouched; only the policy that
-- let any authenticated user insert or update terms is replaced. Creating or
-- amending an academic term restructures every report in the school, so this is
-- admin-only rather than any-staff.
DROP POLICY IF EXISTS "School users academic_terms all" ON public.academic_terms;
DROP POLICY IF EXISTS "academic_terms_insert" ON public.academic_terms;
DROP POLICY IF EXISTS "academic_terms_update" ON public.academic_terms;
CREATE POLICY "academic_terms_admin_write" ON public.academic_terms
  FOR ALL TO authenticated
  USING (school_id = my_school_id() AND is_school_admin(my_school_id()))
  WITH CHECK (school_id = my_school_id() AND is_school_admin(my_school_id()));
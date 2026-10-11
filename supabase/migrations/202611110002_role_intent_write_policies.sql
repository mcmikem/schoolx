-- Write-policy intent pass: close the remaining school-scoped write policies
-- that any authenticated school user (students and parents included) could
-- exercise, and freeze privilege columns against self-service escalation.
--
-- What was already tight (left untouched): classes, students, attendance,
-- grades, exams, exam_scores, report_cards, homework, period_attendance,
-- subject_allocations, teacher_subjects (teacher_class_scope pass); events,
-- subjects, school_settings, fee_structure, schools (admin-gated earlier).
--
-- What this migration changes:
--   users                self-update must not be able to change role /
--                        school_id / auth_id / is_active (trigger), and the
--                        duplicate self-update policies collapse to one.
--   parent_students      link/unlink was open to every school user incl.
--                        students and parents — staff only now. Parent
--                        linking runs through the server (service role).
--   academic_years/terms open to every school user — admin only.
--   grading_schemes/houses open to every school user — admin only.
--   messages             open to every school user — staff only.
--   fee_payments         legacy public-role policies let any school member
--                        insert or update payments (forge/zero-out); the
--                        loose staff ALL policy also allowed any staff to
--                        delete any payment. Keep the specific staff-insert
--                        and admin-update/delete policies only.
--   student_wallets / wallet_transactions
--                        the "all" policies let a student write their own
--                        wallet (my_student_ids includes self) — self-credit.
--                        Parent portal only reads these client-side; all
--                        money movement is server-side. Reads stay for staff
--                        and linked parents; writes are staff only.
--   academic_terms       the select policy was USING (true) for public —
--                        cross-tenant term dates. School-scoped now.

-- ─── users: privilege columns frozen on self-update ──────────────────────────

DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "users_update" ON users;

CREATE POLICY "Users update own profile"
ON users
FOR UPDATE
TO authenticated
USING (auth_id = auth.uid())
WITH CHECK (auth_id = auth.uid());

-- Creating users is management work. The old check only verified the new
-- row landed in the caller's own school, so any staff account (students
-- included) could mint themselves extra users. All app creation paths run
-- service-role server-side and are unaffected.
DROP POLICY IF EXISTS "users_insert" ON users;

CREATE POLICY "School admins insert users"
ON users
FOR INSERT
TO authenticated
WITH CHECK (
  school_id = my_school_id()
  AND (is_school_admin(my_school_id()) OR is_super_admin())
);

-- A user may edit their own row (name, phone, avatar, clearing their own
-- password_reset_required) but must never rewrite their own role, school,
-- auth link or active flag: that is a self-service privilege escalation
-- through the self-update RLS policy. Service-role writes (auth.uid() is
-- null) and admins editing other rows are unaffected.
CREATE OR REPLACE FUNCTION public.users_guard_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.auth_id THEN
    NEW.role := OLD.role;
    NEW.school_id := OLD.school_id;
    NEW.auth_id := OLD.auth_id;
    NEW.is_active := OLD.is_active;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_guard_self_update_trg ON users;
CREATE TRIGGER users_guard_self_update_trg
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION public.users_guard_self_update();

-- ─── parent_students: staff-only writes ──────────────────────────────────────

DROP POLICY IF EXISTS "School users parent_students write" ON parent_students;

CREATE POLICY "School staff parent_students write"
ON parent_students
FOR ALL
TO authenticated
USING (
  student_id IN (SELECT id FROM students WHERE school_id = my_school_id())
  AND is_staff_role()
  AND NOT is_class_scoped_role()
)
WITH CHECK (
  student_id IN (SELECT id FROM students WHERE school_id = my_school_id())
  AND is_staff_role()
  AND NOT is_class_scoped_role()
);

-- ─── academic_years / terms: admin-only writes ───────────────────────────────

DROP POLICY IF EXISTS "academic_years_school" ON academic_years;

CREATE POLICY "academic_years admin write"
ON academic_years
FOR ALL
TO authenticated
USING (school_id = my_school_id() AND is_school_admin(my_school_id()))
WITH CHECK (school_id = my_school_id() AND is_school_admin(my_school_id()));

DROP POLICY IF EXISTS "terms_school" ON terms;

CREATE POLICY "terms admin write"
ON terms
FOR ALL
TO authenticated
USING (school_id = my_school_id() AND is_school_admin(my_school_id()))
WITH CHECK (school_id = my_school_id() AND is_school_admin(my_school_id()));

-- ─── grading_schemes / houses: admin-only writes ─────────────────────────────

DROP POLICY IF EXISTS "School users grading_schemes write" ON grading_schemes;

CREATE POLICY "School admin grading_schemes write"
ON grading_schemes
FOR ALL
TO authenticated
USING (school_id = my_school_id() AND is_school_admin(my_school_id()))
WITH CHECK (school_id = my_school_id() AND is_school_admin(my_school_id()));

DROP POLICY IF EXISTS "School users houses write" ON houses;

CREATE POLICY "School admin houses write"
ON houses
FOR ALL
TO authenticated
USING (school_id = my_school_id() AND is_school_admin(my_school_id()))
WITH CHECK (school_id = my_school_id() AND is_school_admin(my_school_id()));

-- ─── messages: staff-only writes ─────────────────────────────────────────────

DROP POLICY IF EXISTS "School users messages write" ON messages;

CREATE POLICY "School staff messages write"
ON messages
FOR ALL
TO authenticated
USING (school_id = my_school_id() AND is_school_staff(my_school_id()))
WITH CHECK (school_id = my_school_id() AND is_school_staff(my_school_id()));

-- ─── fee_payments: drop the legacy school-wide and loose staff policies ──────
-- Permissive policies OR together, so the specific staff-insert and
-- admin-update/delete policies below (kept) only mean something once the
-- wide ones are gone.

DROP POLICY IF EXISTS "School users fee_payments write" ON fee_payments;
DROP POLICY IF EXISTS "fee_payments_insert" ON fee_payments;
DROP POLICY IF EXISTS "fee_payments_update" ON fee_payments;
DROP POLICY IF EXISTS "fee_payments_select" ON fee_payments;

-- ─── student_wallets: reads for staff + linked parents, writes staff-only ────

DROP POLICY IF EXISTS "School users student_wallets all" ON student_wallets;
DROP POLICY IF EXISTS "parent_linked_wallets_insert" ON student_wallets;
DROP POLICY IF EXISTS "parent_linked_wallets_update" ON student_wallets;

CREATE POLICY "Staff and linked parents read student_wallets"
ON student_wallets
FOR SELECT
TO authenticated
USING (
  ((school_id = my_school_id()) AND is_staff_role())
  OR student_id IN (SELECT my_student_ids())
);

CREATE POLICY "School staff write student_wallets"
ON student_wallets
FOR ALL
TO authenticated
USING (school_id = my_school_id() AND is_staff_role() AND NOT is_class_scoped_role())
WITH CHECK (school_id = my_school_id() AND is_staff_role() AND NOT is_class_scoped_role());

-- ─── wallet_transactions: same shape as student_wallets ─────────────────────

DROP POLICY IF EXISTS "School users wallet_transactions all" ON wallet_transactions;
DROP POLICY IF EXISTS "parent_linked_wallet_transactions_insert" ON wallet_transactions;

CREATE POLICY "Staff and linked parents read wallet_transactions"
ON wallet_transactions
FOR SELECT
TO authenticated
USING (
  ((school_id = my_school_id()) AND is_staff_role())
  OR student_id IN (SELECT my_student_ids())
);

CREATE POLICY "School staff write wallet_transactions"
ON wallet_transactions
FOR ALL
TO authenticated
USING (school_id = my_school_id() AND is_staff_role() AND NOT is_class_scoped_role())
WITH CHECK (school_id = my_school_id() AND is_staff_role() AND NOT is_class_scoped_role());

-- ─── academic_terms: school-scoped read instead of USING (true) ──────────────

DROP POLICY IF EXISTS "academic_terms_select" ON academic_terms;

CREATE POLICY "School users academic_terms select"
ON academic_terms
FOR SELECT
TO authenticated
USING (school_id = my_school_id());

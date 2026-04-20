-- ============================================================
-- Migration: Role-based RLS policies on core tables
-- Date: 2026-04-20
--
-- Problem: core tables allowed ANY authenticated user in the
-- same school to INSERT/UPDATE/DELETE (teachers could delete
-- students, parents could modify fee records).
--
-- Fix: restrict write/delete operations by role.
--   SELECT  → any same-school user (unchanged)
--   INSERT  → admin roles only (students: also teachers)
--   UPDATE  → admin roles only (attendance/grades: also teachers)
--   DELETE  → admin roles only
--
-- Admin roles: school_admin, headmaster, admin, bursar (fees)
-- ============================================================

-- Helper: check caller is an admin-level user in a given school
CREATE OR REPLACE FUNCTION is_school_admin(p_school_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
      AND school_id = p_school_id
      AND role IN ('school_admin', 'headmaster', 'admin', 'super_admin')
  )
$$;

-- Helper: check caller is a teacher or admin in a given school
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
      AND role IN ('school_admin', 'headmaster', 'admin', 'super_admin', 'teacher', 'dean_of_studies', 'bursar')
  )
$$;

-- Helper: get caller's school_id
CREATE OR REPLACE FUNCTION my_school_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT school_id FROM users WHERE auth_id = auth.uid() LIMIT 1
$$;

-- =====================
-- STUDENTS
-- =====================

-- SELECT: any same-school user (unchanged)
DROP POLICY IF EXISTS "School users students select" ON students;
CREATE POLICY "School users students select"
ON students FOR SELECT TO authenticated
USING (school_id = my_school_id());

-- INSERT: admin roles only (admissions desk)
DROP POLICY IF EXISTS "School users students insert" ON students;
CREATE POLICY "School users students insert"
ON students FOR INSERT TO authenticated
WITH CHECK (is_school_admin(school_id));

-- UPDATE: admin roles only
DROP POLICY IF EXISTS "School users students update" ON students;
CREATE POLICY "School users students update"
ON students FOR UPDATE TO authenticated
USING (is_school_admin(school_id))
WITH CHECK (is_school_admin(school_id));

-- DELETE: admin roles only
DROP POLICY IF EXISTS "School users students delete" ON students;
CREATE POLICY "School users students delete"
ON students FOR DELETE TO authenticated
USING (is_school_admin(school_id));

-- =====================
-- CLASSES
-- =====================

-- SELECT: any same-school user
DROP POLICY IF EXISTS "School users classes select" ON classes;
CREATE POLICY "School users classes select"
ON classes FOR SELECT TO authenticated
USING (school_id = my_school_id());

-- WRITE: admin only
DROP POLICY IF EXISTS "School users classes write" ON classes;
CREATE POLICY "School users classes write"
ON classes FOR ALL TO authenticated
USING (is_school_admin(school_id))
WITH CHECK (is_school_admin(school_id));

-- =====================
-- ATTENDANCE
-- =====================

-- SELECT: any same-school user
DROP POLICY IF EXISTS "School users attendance select" ON attendance;
CREATE POLICY "School users attendance select"
ON attendance FOR SELECT TO authenticated
USING (
  class_id IN (
    SELECT id FROM classes WHERE school_id = my_school_id()
  )
);

-- WRITE: teachers and admins (teachers mark attendance)
DROP POLICY IF EXISTS "School users attendance write" ON attendance;
CREATE POLICY "School users attendance write"
ON attendance FOR ALL TO authenticated
USING (
  class_id IN (
    SELECT id FROM classes WHERE school_id = my_school_id()
      AND is_school_staff(my_school_id())
  )
)
WITH CHECK (
  class_id IN (
    SELECT id FROM classes WHERE school_id = my_school_id()
      AND is_school_staff(my_school_id())
  )
);

-- =====================
-- GRADES
-- =====================

-- SELECT: any same-school user
DROP POLICY IF EXISTS "School users grades select" ON grades;
CREATE POLICY "School users grades select"
ON grades FOR SELECT TO authenticated
USING (
  class_id IN (
    SELECT id FROM classes WHERE school_id = my_school_id()
  )
);

-- WRITE: teachers and admins (teachers enter marks)
DROP POLICY IF EXISTS "School users grades write" ON grades;
CREATE POLICY "School users grades write"
ON grades FOR ALL TO authenticated
USING (
  class_id IN (
    SELECT id FROM classes WHERE school_id = my_school_id()
      AND is_school_staff(my_school_id())
  )
)
WITH CHECK (
  class_id IN (
    SELECT id FROM classes WHERE school_id = my_school_id()
      AND is_school_staff(my_school_id())
  )
);

-- =====================
-- FEE PAYMENTS
-- =====================

-- Check fee_payments table exists before applying
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fee_payments') THEN

    ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "School users fee_payments select" ON fee_payments;
    CREATE POLICY "School users fee_payments select"
    ON fee_payments FOR SELECT TO authenticated
    USING (school_id = my_school_id());

    DROP POLICY IF EXISTS "School users fee_payments insert" ON fee_payments;
    CREATE POLICY "School users fee_payments insert"
    ON fee_payments FOR INSERT TO authenticated
    WITH CHECK (
      school_id = my_school_id()
      AND is_school_staff(school_id)
    );

    -- Only admins/bursars can update or delete payment records
    DROP POLICY IF EXISTS "School users fee_payments update" ON fee_payments;
    CREATE POLICY "School users fee_payments update"
    ON fee_payments FOR UPDATE TO authenticated
    USING (is_school_admin(school_id))
    WITH CHECK (is_school_admin(school_id));

    DROP POLICY IF EXISTS "School users fee_payments delete" ON fee_payments;
    CREATE POLICY "School users fee_payments delete"
    ON fee_payments FOR DELETE TO authenticated
    USING (is_school_admin(school_id));

  END IF;
END $$;

-- =====================
-- FEE STRUCTURE
-- =====================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fee_structure') THEN

    ALTER TABLE fee_structure ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "School users fee_structure select" ON fee_structure;
    CREATE POLICY "School users fee_structure select"
    ON fee_structure FOR SELECT TO authenticated
    USING (school_id = my_school_id());

    DROP POLICY IF EXISTS "School users fee_structure write" ON fee_structure;
    CREATE POLICY "School users fee_structure write"
    ON fee_structure FOR ALL TO authenticated
    USING (is_school_admin(school_id))
    WITH CHECK (is_school_admin(school_id));

  END IF;
END $$;

-- =====================
-- SUBJECTS (global rows with school_id = NULL)
-- =====================
-- Make global subjects readable by any authenticated user
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subjects') THEN

    ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Global subjects readable" ON subjects;
    CREATE POLICY "Global subjects readable"
    ON subjects FOR SELECT TO authenticated
    USING (school_id IS NULL OR school_id = my_school_id());

    DROP POLICY IF EXISTS "School subjects write" ON subjects;
    CREATE POLICY "School subjects write"
    ON subjects FOR ALL TO authenticated
    USING (school_id IS NOT NULL AND is_school_admin(school_id))
    WITH CHECK (school_id IS NOT NULL AND is_school_admin(school_id));

  END IF;
END $$;

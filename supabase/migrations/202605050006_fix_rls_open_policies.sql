-- Fix overly permissive RLS policies that use USING (true)
-- These allow any authenticated user to read/modify data from ALL schools.
-- Scope each policy to the current user's school using my_school_id().

-- ============================================================
-- fee_terms: has school_id directly
-- ============================================================
DROP POLICY IF EXISTS fee_terms_select ON fee_terms;
CREATE POLICY fee_terms_select ON fee_terms
  FOR SELECT USING (school_id = my_school_id());

DROP POLICY IF EXISTS fee_terms_insert ON fee_terms;
CREATE POLICY fee_terms_insert ON fee_terms
  FOR INSERT WITH CHECK (school_id = my_school_id() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS fee_terms_update ON fee_terms;
CREATE POLICY fee_terms_update ON fee_terms
  FOR UPDATE USING (school_id = my_school_id() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS fee_terms_delete ON fee_terms;
CREATE POLICY fee_terms_delete ON fee_terms
  FOR DELETE USING (school_id = my_school_id() OR auth.role() = 'service_role');

-- ============================================================
-- fee_term_lines: no school_id; scoped via fee_terms
-- ============================================================
DROP POLICY IF EXISTS fee_term_lines_select ON fee_term_lines;
CREATE POLICY fee_term_lines_select ON fee_term_lines
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM fee_terms ft
      WHERE ft.id = fee_term_lines.term_id
        AND ft.school_id = my_school_id()
    )
  );

DROP POLICY IF EXISTS fee_term_lines_insert ON fee_term_lines;
CREATE POLICY fee_term_lines_insert ON fee_term_lines
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM fee_terms ft
      WHERE ft.id = fee_term_lines.term_id
        AND (ft.school_id = my_school_id() OR auth.role() = 'service_role')
    )
  );

DROP POLICY IF EXISTS fee_term_lines_update ON fee_term_lines;
CREATE POLICY fee_term_lines_update ON fee_term_lines
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM fee_terms ft
      WHERE ft.id = fee_term_lines.term_id
        AND (ft.school_id = my_school_id() OR auth.role() = 'service_role')
    )
  );

-- ============================================================
-- student_fee_terms: scoped via fee_terms
-- ============================================================
DROP POLICY IF EXISTS student_fee_terms_select ON student_fee_terms;
CREATE POLICY student_fee_terms_select ON student_fee_terms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM fee_terms ft
      WHERE ft.id = student_fee_terms.fee_term_id
        AND ft.school_id = my_school_id()
    )
  );

DROP POLICY IF EXISTS student_fee_terms_insert ON student_fee_terms;
CREATE POLICY student_fee_terms_insert ON student_fee_terms
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM fee_terms ft
      WHERE ft.id = student_fee_terms.fee_term_id
        AND (ft.school_id = my_school_id() OR auth.role() = 'service_role')
    )
  );

DROP POLICY IF EXISTS student_fee_terms_update ON student_fee_terms;
CREATE POLICY student_fee_terms_update ON student_fee_terms
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM fee_terms ft
      WHERE ft.id = student_fee_terms.fee_term_id
        AND (ft.school_id = my_school_id() OR auth.role() = 'service_role')
    )
  );

-- ============================================================
-- fee_payments (fee-terms model): scoped via student_fee_terms → fee_terms
-- ============================================================
DROP POLICY IF EXISTS fee_payments_select ON fee_payments;
CREATE POLICY fee_payments_select ON fee_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM student_fee_terms sft
      JOIN fee_terms ft ON ft.id = sft.fee_term_id
      WHERE sft.id = fee_payments.student_fee_term_id
        AND ft.school_id = my_school_id()
    )
  );

DROP POLICY IF EXISTS fee_payments_insert ON fee_payments;
CREATE POLICY fee_payments_insert ON fee_payments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM student_fee_terms sft
      JOIN fee_terms ft ON ft.id = sft.fee_term_id
      WHERE sft.id = fee_payments.student_fee_term_id
        AND (ft.school_id = my_school_id() OR auth.role() = 'service_role')
    )
  );

DROP POLICY IF EXISTS fee_payments_update ON fee_payments;
CREATE POLICY fee_payments_update ON fee_payments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM student_fee_terms sft
      JOIN fee_terms ft ON ft.id = sft.fee_term_id
      WHERE sft.id = fee_payments.student_fee_term_id
        AND (ft.school_id = my_school_id() OR auth.role() = 'service_role')
    )
  );

-- ============================================================
-- student_enrollments: no school_id; scoped via students table
-- ============================================================
DROP POLICY IF EXISTS student_enrollments_select ON student_enrollments;
CREATE POLICY student_enrollments_select ON student_enrollments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = student_enrollments.student_id
        AND s.school_id = my_school_id()
    )
    OR auth.role() = 'service_role'
  );

-- ============================================================
-- courses / course_classes: restrict UPDATE and DELETE
-- Courses are curriculum content scoped to a school.
-- SELECT USING (true) is kept intentional for shared lookup.
-- But UPDATE/DELETE must be restricted to school admins.
-- ============================================================
DROP POLICY IF EXISTS courses_update ON courses;
CREATE POLICY courses_update ON courses
  FOR UPDATE USING (
    school_id = my_school_id() OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS courses_delete ON courses;
CREATE POLICY courses_delete ON courses
  FOR DELETE USING (
    school_id = my_school_id() OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS course_classes_update ON course_classes;
CREATE POLICY course_classes_update ON course_classes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = course_classes.course_id
        AND (c.school_id = my_school_id() OR auth.role() = 'service_role')
    )
  );

DROP POLICY IF EXISTS course_classes_delete ON course_classes;
CREATE POLICY course_classes_delete ON course_classes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = course_classes.course_id
        AND (c.school_id = my_school_id() OR auth.role() = 'service_role')
    )
  );

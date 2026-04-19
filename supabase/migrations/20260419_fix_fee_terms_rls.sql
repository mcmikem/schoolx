-- Fix fee terms RLS: replace USING (true) with school-scoped policies
-- Addresses cross-school financial data leakage identified in security audit.
-- Original migration (20260414_fee_terms.sql) used simplified policies
-- that allowed any authenticated user to read/write any school's fee data.

-- ============================================================
-- 1. fee_terms (has school_id directly)
-- ============================================================

DROP POLICY IF EXISTS fee_terms_select ON fee_terms;
DROP POLICY IF EXISTS fee_terms_insert ON fee_terms;
DROP POLICY IF EXISTS fee_terms_update ON fee_terms;
DROP POLICY IF EXISTS fee_terms_delete ON fee_terms;

CREATE POLICY fee_terms_select ON fee_terms
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR school_id IN (
      SELECT school_id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY fee_terms_insert ON fee_terms
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
    OR school_id IN (
      SELECT school_id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY fee_terms_update ON fee_terms
  FOR UPDATE USING (
    auth.role() = 'service_role'
    OR school_id IN (
      SELECT school_id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY fee_terms_delete ON fee_terms
  FOR DELETE USING (auth.role() = 'service_role');

-- ============================================================
-- 2. fee_term_lines (no school_id — scoped through fee_terms)
-- ============================================================

DROP POLICY IF EXISTS fee_term_lines_select ON fee_term_lines;
DROP POLICY IF EXISTS fee_term_lines_insert ON fee_term_lines;
DROP POLICY IF EXISTS fee_term_lines_update ON fee_term_lines;

CREATE POLICY fee_term_lines_select ON fee_term_lines
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR term_id IN (
      SELECT id FROM fee_terms
      WHERE school_id IN (
        SELECT school_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY fee_term_lines_insert ON fee_term_lines
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
    OR term_id IN (
      SELECT id FROM fee_terms
      WHERE school_id IN (
        SELECT school_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY fee_term_lines_update ON fee_term_lines
  FOR UPDATE USING (
    auth.role() = 'service_role'
    OR term_id IN (
      SELECT id FROM fee_terms
      WHERE school_id IN (
        SELECT school_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

-- ============================================================
-- 3. student_fee_terms (scoped through fee_terms)
-- ============================================================

DROP POLICY IF EXISTS student_fee_terms_select ON student_fee_terms;
DROP POLICY IF EXISTS student_fee_terms_insert ON student_fee_terms;
DROP POLICY IF EXISTS student_fee_terms_update ON student_fee_terms;

CREATE POLICY student_fee_terms_select ON student_fee_terms
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR fee_term_id IN (
      SELECT id FROM fee_terms
      WHERE school_id IN (
        SELECT school_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY student_fee_terms_insert ON student_fee_terms
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
    OR fee_term_id IN (
      SELECT id FROM fee_terms
      WHERE school_id IN (
        SELECT school_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY student_fee_terms_update ON student_fee_terms
  FOR UPDATE USING (
    auth.role() = 'service_role'
    OR fee_term_id IN (
      SELECT id FROM fee_terms
      WHERE school_id IN (
        SELECT school_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

-- ============================================================
-- 4. fee_payments (scoped through student_fee_terms → fee_terms)
-- ============================================================

DROP POLICY IF EXISTS fee_payments_select ON fee_payments;
DROP POLICY IF EXISTS fee_payments_insert ON fee_payments;
DROP POLICY IF EXISTS fee_payments_update ON fee_payments;

CREATE POLICY fee_payments_select ON fee_payments
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR student_fee_term_id IN (
      SELECT sft.id
      FROM student_fee_terms sft
      JOIN fee_terms ft ON ft.id = sft.fee_term_id
      WHERE ft.school_id IN (
        SELECT school_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY fee_payments_insert ON fee_payments
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
    OR student_fee_term_id IN (
      SELECT sft.id
      FROM student_fee_terms sft
      JOIN fee_terms ft ON ft.id = sft.fee_term_id
      WHERE ft.school_id IN (
        SELECT school_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY fee_payments_update ON fee_payments
  FOR UPDATE USING (
    auth.role() = 'service_role'
    OR student_fee_term_id IN (
      SELECT sft.id
      FROM student_fee_terms sft
      JOIN fee_terms ft ON ft.id = sft.fee_term_id
      WHERE ft.school_id IN (
        SELECT school_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

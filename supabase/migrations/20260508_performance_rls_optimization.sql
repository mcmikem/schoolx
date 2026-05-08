-- ============================================
-- OMUTO SCHOOL MANAGEMENT SYSTEM - Performance Migration
-- Adding school_id to transactional tables for RLS optimization
-- ============================================

-- 1. ATTENDANCE
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);
UPDATE attendance a SET school_id = c.school_id FROM classes c WHERE a.class_id = c.id;
ALTER TABLE attendance ALTER COLUMN school_id SET NOT NULL;

-- 2. GRADES
ALTER TABLE grades ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);
UPDATE grades g SET school_id = c.school_id FROM classes c WHERE g.class_id = c.id;
ALTER TABLE grades ALTER COLUMN school_id SET NOT NULL;

-- 3. EXAM_SCORES
ALTER TABLE exam_scores ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);
UPDATE exam_scores es SET school_id = c.school_id FROM classes c WHERE es.class_id = c.id;
ALTER TABLE exam_scores ALTER COLUMN school_id SET NOT NULL;

-- 4. FEE_PAYMENTS
ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);
UPDATE fee_payments fp SET school_id = s.school_id FROM students s WHERE fp.student_id = s.id;
ALTER TABLE fee_payments ALTER COLUMN school_id SET NOT NULL;

-- 5. FEE_ADJUSTMENTS
ALTER TABLE fee_adjustments ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);
UPDATE fee_adjustments fa SET school_id = s.school_id FROM students s WHERE fa.student_id = s.id;
ALTER TABLE fee_adjustments ALTER COLUMN school_id SET NOT NULL;

-- ============================================
-- Update RLS Policies for optimized access
-- ============================================

-- ATTENDANCE
DROP POLICY IF EXISTS "attendance_select" ON attendance;
CREATE POLICY "attendance_select" ON attendance FOR SELECT
  USING (public.is_super_admin() OR school_id = public.current_user_school_id());

DROP POLICY IF EXISTS "attendance_insert" ON attendance;
CREATE POLICY "attendance_insert" ON attendance FOR INSERT
  WITH CHECK (public.is_super_admin() OR school_id = public.current_user_school_id());

DROP POLICY IF EXISTS "attendance_update" ON attendance;
CREATE POLICY "attendance_update" ON attendance FOR UPDATE
  USING (public.is_super_admin() OR school_id = public.current_user_school_id());

-- GRADES
DROP POLICY IF EXISTS "grades_select" ON grades;
CREATE POLICY "grades_select" ON grades FOR SELECT
  USING (public.is_super_admin() OR school_id = public.current_user_school_id());

DROP POLICY IF EXISTS "grades_insert" ON grades;
CREATE POLICY "grades_insert" ON grades FOR INSERT
  WITH CHECK (public.is_super_admin() OR school_id = public.current_user_school_id());

DROP POLICY IF EXISTS "grades_update" ON grades;
CREATE POLICY "grades_update" ON grades FOR UPDATE
  USING (public.is_super_admin() OR school_id = public.current_user_school_id());

-- EXAM_SCORES
DROP POLICY IF EXISTS "exam_scores_select" ON exam_scores;
CREATE POLICY "exam_scores_select" ON exam_scores FOR SELECT
  USING (public.is_super_admin() OR school_id = public.current_user_school_id());

-- FEE_PAYMENTS
DROP POLICY IF EXISTS "fee_payments_select" ON fee_payments;
CREATE POLICY "fee_payments_select" ON fee_payments FOR SELECT
  USING (public.is_super_admin() OR school_id = public.current_user_school_id());

DROP POLICY IF EXISTS "fee_payments_insert" ON fee_payments;
CREATE POLICY "fee_payments_insert" ON fee_payments FOR INSERT
  WITH CHECK (public.is_super_admin() OR school_id = public.current_user_school_id());

DROP POLICY IF EXISTS "fee_payments_update" ON fee_payments;
CREATE POLICY "fee_payments_update" ON fee_payments FOR UPDATE
  USING (public.is_super_admin() OR school_id = public.current_user_school_id());

-- INDEXES for even more speed
CREATE INDEX IF NOT EXISTS idx_attendance_school_id ON attendance(school_id);
CREATE INDEX IF NOT EXISTS idx_grades_school_id ON grades(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_school_id ON fee_payments(school_id);
CREATE INDEX IF NOT EXISTS idx_exam_scores_school_id ON exam_scores(school_id);

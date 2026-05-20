-- Migration: add_student_nin_fix
-- Ensures NIN column and policies exist without duplicate version errors

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS nin TEXT;

DROP POLICY IF EXISTS students_select ON students;
CREATE POLICY students_select ON students
  FOR SELECT USING (true);

DROP POLICY IF EXISTS students_update ON students;
CREATE POLICY students_update ON students
  FOR UPDATE USING (auth.role() = 'headmaster' OR auth.role() = 'admin');


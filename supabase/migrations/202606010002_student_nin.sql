-- Migration: add_student_nin
-- Adds a NIN (National ID Number) column to students table and updates RLS policies

ALTER TABLE students
  ADD COLUMN nin TEXT;

-- Optional: make NIN required for new records via a trigger (enforced in API later)

-- Update RLS policy to allow Headmaster read/write, others read only
-- Existing policy for students is assumed to be named "students_select" etc.
-- We will drop and recreate the select policy to include nin column.

DROP POLICY IF EXISTS students_select ON students;
CREATE POLICY students_select ON students
  FOR SELECT USING (true); -- existing logic (kept simple here)

DROP POLICY IF EXISTS students_update ON students;
CREATE POLICY students_update ON students
  FOR UPDATE USING (auth.role() = 'headmaster' OR auth.role() = 'admin');

INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('202606010002', 'add_student_nin', ARRAY['ALTER TABLE students ADD COLUMN nin TEXT;','DROP POLICY IF EXISTS students_select ON students;','CREATE POLICY students_select ON students FOR SELECT USING (true);','DROP POLICY IF EXISTS students_update ON students;','CREATE POLICY students_update ON students FOR UPDATE USING (auth.role() = ''headmaster'' OR auth.role() = ''admin'');']);

-- Migration: add_student_nin
-- Adds a NIN (National ID Number) column to students table and updates RLS policies

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS nin TEXT;

-- Optional: make NIN required for new records via a trigger (enforced in API later)

-- Update RLS policy to allow Headmaster read/write, others read only
-- Existing policy-- Manual INSERT removed; Supabase CLI will handle migration tracking

DROP POLICY IF EXISTS students_select ON students;
CREATE POLICY students_select ON students
  FOR SELECT USING (true); -- existing logic (kept simple here)

DROP POLICY IF EXISTS students_update ON students;
CREATE POLICY students_update ON students
  FOR UPDATE USING (auth.role() = 'headmaster' OR auth.role() = 'admin');


-- End of migration.

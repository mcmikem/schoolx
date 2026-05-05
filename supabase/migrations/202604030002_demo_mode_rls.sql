-- Demo Mode RLS - anon read access for demo school
-- attendance/grades/fee_payments have no school_id; use student join
-- Tables that may not exist yet are wrapped in DO/EXCEPTION blocks

DROP POLICY IF EXISTS "Demo school read for anon" ON schools;
CREATE POLICY "Demo school read for anon" ON schools
  FOR SELECT TO anon USING (id = '00000000-0000-0000-0000-000000000001');

DROP POLICY IF EXISTS "Demo users read for anon" ON users;
CREATE POLICY "Demo users read for anon" ON users
  FOR SELECT TO anon USING (school_id = '00000000-0000-0000-0000-000000000001');

DROP POLICY IF EXISTS "Demo students read anon" ON students;
CREATE POLICY "Demo students read anon" ON students
  FOR SELECT TO anon USING (school_id = '00000000-0000-0000-0000-000000000001');

DROP POLICY IF EXISTS "Demo classes read anon" ON classes;
CREATE POLICY "Demo classes read anon" ON classes
  FOR SELECT TO anon USING (school_id = '00000000-0000-0000-0000-000000000001');

DROP POLICY IF EXISTS "Demo subjects read anon" ON subjects;
CREATE POLICY "Demo subjects read anon" ON subjects
  FOR SELECT TO anon USING (school_id = '00000000-0000-0000-0000-000000000001');

DROP POLICY IF EXISTS "Demo fee_structure read anon" ON fee_structure;
CREATE POLICY "Demo fee_structure read anon" ON fee_structure
  FOR SELECT TO anon USING (school_id = '00000000-0000-0000-0000-000000000001');

DROP POLICY IF EXISTS "Demo attendance read anon" ON attendance;
CREATE POLICY "Demo attendance read anon" ON attendance
  FOR SELECT TO anon
  USING (student_id IN (SELECT id FROM students WHERE school_id = '00000000-0000-0000-0000-000000000001'));

DROP POLICY IF EXISTS "Demo grades read anon" ON grades;
CREATE POLICY "Demo grades read anon" ON grades
  FOR SELECT TO anon
  USING (student_id IN (SELECT id FROM students WHERE school_id = '00000000-0000-0000-0000-000000000001'));

DROP POLICY IF EXISTS "Demo fee_payments read anon" ON fee_payments;
CREATE POLICY "Demo fee_payments read anon" ON fee_payments
  FOR SELECT TO anon
  USING (student_id IN (SELECT id FROM students WHERE school_id = '00000000-0000-0000-0000-000000000001'));

DROP POLICY IF EXISTS "Demo school_settings read anon" ON school_settings;
CREATE POLICY "Demo school_settings read anon" ON school_settings
  FOR SELECT TO anon USING (school_id = '00000000-0000-0000-0000-000000000001');

DROP POLICY IF EXISTS "Demo notices read anon" ON notices;
CREATE POLICY "Demo notices read anon" ON notices
  FOR SELECT TO anon USING (school_id = '00000000-0000-0000-0000-000000000001');

DROP POLICY IF EXISTS "Demo messages read anon" ON messages;
CREATE POLICY "Demo messages read anon" ON messages
  FOR SELECT TO anon USING (school_id = '00000000-0000-0000-0000-000000000001');

DROP POLICY IF EXISTS "Demo events read anon" ON events;
CREATE POLICY "Demo events read anon" ON events
  FOR SELECT TO anon USING (school_id = '00000000-0000-0000-0000-000000000001');

-- Optional tables: wrap in exception handlers in case they don't exist yet
DO $$ BEGIN
  DROP POLICY IF EXISTS "Demo staff read anon" ON staff;
  CREATE POLICY "Demo staff read anon" ON staff
    FOR SELECT TO anon USING (school_id = '00000000-0000-0000-0000-000000000001');
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Demo staff_attendance read anon" ON staff_attendance;
  CREATE POLICY "Demo staff_attendance read anon" ON staff_attendance
    FOR SELECT TO anon
    USING (staff_id IN (SELECT id FROM users WHERE school_id = '00000000-0000-0000-0000-000000000001'));
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Demo leave_requests read anon" ON leave_requests;
  CREATE POLICY "Demo leave_requests read anon" ON leave_requests
    FOR SELECT TO anon USING (school_id = '00000000-0000-0000-0000-000000000001');
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Demo dorms read anon" ON dorms;
  CREATE POLICY "Demo dorms read anon" ON dorms
    FOR SELECT TO anon USING (school_id = '00000000-0000-0000-0000-000000000001');
EXCEPTION WHEN undefined_table THEN NULL; END $$;

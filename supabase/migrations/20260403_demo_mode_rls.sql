-- Demo Mode RLS Fix - Fixed column names
-- Run this in Supabase SQL Editor

-- Demo school read access for anon users
CREATE POLICY "Demo school read for anon" ON schools
  FOR SELECT TO anon
  USING (id = '00000000-0000-0000-0000-000000000001');

-- Demo school users read access
CREATE POLICY "Demo users read for anon" ON users
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

-- Demo students read anon
CREATE POLICY "Demo students read anon" ON students
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

-- Demo classes read anon
CREATE POLICY "Demo classes read anon" ON classes
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

-- Demo subjects read anon
CREATE POLICY "Demo subjects read anon" ON subjects
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

-- Demo attendance read anon
CREATE POLICY "Demo attendance read anon" ON attendance
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

-- Demo grades read anon
CREATE POLICY "Demo grades read anon" ON grades
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

-- Demo fee_structure read anon
CREATE POLICY "Demo fee_structure read anon" ON fee_structure
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

-- Demo fee_payments read anon
CREATE POLICY "Demo fee_payments read anon" ON fee_payments
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

-- Demo staff read anon
CREATE POLICY "Demo staff read anon" ON staff
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

-- Demo leave_requests read anon (leave_requests HAS school_id)
CREATE POLICY "Demo leave_requests read anon" ON leave_requests
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

-- Demo staff_attendance - uses staff_id -> users -> school_id
CREATE POLICY "Demo staff_attendance read anon" ON staff_attendance
  FOR SELECT TO anon
  USING (staff_id IN (SELECT id FROM users WHERE school_id = '00000000-0000-0000-0000-000000000001'));

-- Demo school_settings read anon
CREATE POLICY "Demo school_settings read anon" ON school_settings
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

-- Demo notices read anon
CREATE POLICY "Demo notices read anon" ON notices
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

-- Demo messages read anon
CREATE POLICY "Demo messages read anon" ON messages
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

-- Demo events read anon
CREATE POLICY "Demo events read anon" ON events
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

-- Demo dorms read anon (dorms HAS school_id)
CREATE POLICY "Demo dorms read anon" ON dorms
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

-- Demo Mode RLS Fix
-- Allow anonymous users to read demo school data

-- Demo school ID
-- Demo school read access for anon users
CREATE POLICY "Demo school read for anon" ON schools
  FOR SELECT TO anon
  USING (id = '00000000-0000-0000-0000-000000000001');

-- Demo school read access for authenticated users
CREATE POLICY "Demo school read for auth" ON schools
  FOR SELECT TO authenticated
  USING (id = '00000000-0000-0000-0000-000000000001');

-- Demo school users read access
CREATE POLICY "Demo users read for anon" ON users
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "Demo users read for auth" ON users
  FOR SELECT TO authenticated
  USING (school_id = '00000000-0000-0000-0000-000000000001');

-- Demo school data read - all tables
CREATE POLICY "Demo students read anon" ON students
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "Demo classes read anon" ON classes
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "Demo subjects read anon" ON subjects
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "Demo attendance read anon" ON attendance
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "Demo grades read anon" ON grades
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "Demo fee_structure read anon" ON fee_structure
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "Demo fee_payments read anon" ON fee_payments
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "Demo staff read anon" ON staff
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "Demo staff_attendance read anon" ON staff_attendance
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "Demo school_settings read anon" ON school_settings
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "Demo notices read anon" ON notices
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "Demo messages read anon" ON messages
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "Demo events read anon" ON events
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "Demo automated_sms read anon" ON automated_sms
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "Demo automated_sms_rules read anon" ON automated_sms_rules
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "Demo dorms read anon" ON dorms
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "Demo dorm_rooms read anon" ON dorm_rooms
  FOR SELECT TO anon
  USING (dorm_id IN (SELECT id FROM dorms WHERE school_id = '00000000-0000-0000-0000-000000000001'));

CREATE POLICY "Demo leave_requests read anon" ON leave_requests
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

-- Allow insert/update for demo seeding (can be removed after initial setup)
CREATE POLICY "Demo data insert anon" ON students
  FOR INSERT TO anon
  WITH CHECK (school_id = '00000000-0000-0000-0000-000000000001');

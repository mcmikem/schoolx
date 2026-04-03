-- Demo Mode RLS - Only tables that have school_id column
-- Run these one by one:

-- 1. Schools
CREATE POLICY "Demo school read for anon" ON schools
  FOR SELECT TO anon
  USING (id = '00000000-0000-0000-0000-000000000001');

-- 2. Users
CREATE POLICY "Demo users read for anon" ON users
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

-- 3. Students
CREATE POLICY "Demo students read anon" ON students
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

-- 4. Classes
CREATE POLICY "Demo classes read anon" ON classes
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

-- 5. Subjects
CREATE POLICY "Demo subjects read anon" ON subjects
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

-- 6. Fee Structure
CREATE POLICY "Demo fee_structure read anon" ON fee_structure
  FOR SELECT TO anon
  USING (school_id = '00000000-0000-0000-0000-000000000001');

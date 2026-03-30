-- ============================================
-- SCHOOLX - Fixed RLS Policies
-- ============================================

-- First, disable RLS if it was partially enabled
ALTER TABLE schools DISABLE ROW LEVEL SECURITY;
ALTER TABLE classes DISABLE ROW LEVEL SECURITY;
ALTER TABLE subjects DISABLE ROW LEVEL SECURITY;
ALTER TABLE students DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE grades DISABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structure DISABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Allow authenticated users to read their school" ON schools;
DROP POLICY IF EXISTS "Allow demo school access" ON schools;
DROP POLICY IF EXISTS "Allow demo school insert" ON schools;
DROP POLICY IF EXISTS "Allow authenticated access to students" ON students;
DROP POLICY IF EXISTS "Allow demo school students" ON students;
DROP POLICY IF EXISTS "Allow authenticated access to classes" ON classes;
DROP POLICY IF EXISTS "Allow demo school classes" ON classes;
DROP POLICY IF EXISTS "Allow authenticated access to subjects" ON subjects;
DROP POLICY IF EXISTS "Allow demo school subjects" ON subjects;
DROP POLICY IF EXISTS "Allow authenticated access to users" ON users;
DROP POLICY IF EXISTS "Allow users to update own profile" ON users;
DROP POLICY IF EXISTS "Allow authenticated access to attendance" ON attendance;
DROP POLICY IF EXISTS "Allow authenticated access to grades" ON grades;
DROP POLICY IF EXISTS "Allow authenticated access to fee_structure" ON fee_structure;
DROP POLICY IF EXISTS "Allow demo school fee_structure" ON fee_structure;
DROP POLICY IF EXISTS "Allow authenticated access to fee_payments" ON fee_payments;
DROP POLICY IF EXISTS "Allow authenticated access to events" ON events;
DROP POLICY IF EXISTS "Allow demo school events" ON events;
DROP POLICY IF EXISTS "Allow authenticated access to messages" ON messages;
DROP POLICY IF EXISTS "Allow demo school messages" ON messages;

-- Now enable RLS and create policies

-- Schools
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow demo school access" ON schools FOR ALL TO anon USING (id = '00000000-0000-0000-0000-000000000001') WITH CHECK (id = '00000000-0000-0000-0000-000000000001');

-- Classes
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow demo school classes" ON classes FOR ALL TO anon USING (school_id = '00000000-0000-0000-0000-000000000001') WITH CHECK (school_id = '00000000-0000-0000-0000-000000000001');

-- Subjects
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow demo school subjects" ON subjects FOR ALL TO anon USING (school_id = '00000000-0000-0000-0000-000000000001') WITH CHECK (school_id = '00000000-0000-0000-0000-000000000001');

-- Students
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow demo school students" ON students FOR ALL TO anon USING (school_id = '00000000-0000-0000-0000-000000000001') WITH CHECK (school_id = '00000000-0000-0000-0000-000000000001');

-- Fee Structure
ALTER TABLE fee_structure ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow demo school fee_structure" ON fee_structure FOR ALL TO anon USING (school_id = '00000000-0000-0000-0000-000000000001') WITH CHECK (school_id = '00000000-0000-0000-0000-000000000001');

-- Events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow demo school events" ON events FOR ALL TO anon USING (school_id = '00000000-0000-0000-0000-000000000001') WITH CHECK (school_id = '00000000-0000-0000-0000-000000000001');

-- Messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow demo school messages" ON messages FOR ALL TO anon USING (school_id = '00000000-0000-0000-0000-000000000001') WITH CHECK (school_id = '00000000-0000-0000-0000-000000000001');

-- Users (keep simple for demo)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow demo access" ON users FOR ALL TO anon USING (school_id = '00000000-0000-0000-0000-000000000001') WITH CHECK (school_id = '00000000-0000-0000-0000-000000000001');

-- Attendance (simpler policy)
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow demo access" ON attendance FOR ALL TO anon USING (true) WITH CHECK (true);

-- Grades (simpler policy)
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow demo access" ON grades FOR ALL TO anon USING (true) WITH CHECK (true);

-- Fee Payments (simpler policy)
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow demo access" ON fee_payments FOR ALL TO anon USING (true) WITH CHECK (true);

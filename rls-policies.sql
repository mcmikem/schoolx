-- ============================================
-- OMUTO SCHOOL MANAGEMENT SYSTEM - RLS Policies (FINAL)
-- ============================================
-- Super admins can see everything
-- Regular users can only see their own school's data
-- ============================================

-- Disable RLS to reset
ALTER TABLE schools DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE students DISABLE ROW LEVEL SECURITY;
ALTER TABLE classes DISABLE ROW LEVEL SECURITY;
ALTER TABLE subjects DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE grades DISABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structure DISABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE parent_students DISABLE ROW LEVEL SECURITY;

-- Drop ALL old policies
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Anyone can register" ON users;
DROP POLICY IF EXISTS "School data access" ON students;
DROP POLICY IF EXISTS "School data access" ON classes;
DROP POLICY IF EXISTS "School data access" ON subjects;
DROP POLICY IF EXISTS "School data access" ON attendance;
DROP POLICY IF EXISTS "School data access" ON grades;
DROP POLICY IF EXISTS "School data access" ON fee_structure;
DROP POLICY IF EXISTS "School data access" ON fee_payments;
DROP POLICY IF EXISTS "School data access" ON events;
DROP POLICY IF EXISTS "School data access" ON messages;
DROP POLICY IF EXISTS "Anyone can create school" ON schools;
DROP POLICY IF EXISTS "schools_select" ON schools;
DROP POLICY IF EXISTS "schools_insert" ON schools;
DROP POLICY IF EXISTS "schools_update" ON schools;
DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "users_update" ON users;
DROP POLICY IF EXISTS "students_all" ON students;
DROP POLICY IF EXISTS "classes_all" ON classes;
DROP POLICY IF EXISTS "subjects_all" ON subjects;
DROP POLICY IF EXISTS "attendance_all" ON attendance;
DROP POLICY IF EXISTS "grades_all" ON grades;
DROP POLICY IF EXISTS "fee_structure_all" ON fee_structure;
DROP POLICY IF EXISTS "fee_payments_all" ON fee_payments;
DROP POLICY IF EXISTS "events_all" ON events;
DROP POLICY IF EXISTS "messages_all" ON messages;
DROP POLICY IF EXISTS "parent_students_select" ON parent_students;
DROP POLICY IF EXISTS "parent_students_insert" ON parent_students;
DROP POLICY IF EXISTS "super_admin all schools" ON schools;
DROP POLICY IF EXISTS "users read own school" ON schools;
DROP POLICY IF EXISTS "demo school access" ON schools;
DROP POLICY IF EXISTS "super_admin all users" ON users;
DROP POLICY IF EXISTS "users read own profile" ON users;
DROP POLICY IF EXISTS "users read same school" ON users;
DROP POLICY IF EXISTS "users update own profile" ON users;
DROP POLICY IF EXISTS "demo users access" ON users;
DROP POLICY IF EXISTS "super_admin all students" ON students;
DROP POLICY IF EXISTS "users access own school students" ON students;
DROP POLICY IF EXISTS "demo students access" ON students;
DROP POLICY IF EXISTS "super_admin all classes" ON classes;
DROP POLICY IF EXISTS "users access own school classes" ON classes;
DROP POLICY IF EXISTS "demo classes access" ON classes;
DROP POLICY IF EXISTS "super_admin all subjects" ON subjects;
DROP POLICY IF EXISTS "users access own school subjects" ON subjects;
DROP POLICY IF EXISTS "demo subjects access" ON subjects;
DROP POLICY IF EXISTS "super_admin all attendance" ON attendance;
DROP POLICY IF EXISTS "users access own school attendance" ON attendance;
DROP POLICY IF EXISTS "super_admin all grades" ON grades;
DROP POLICY IF EXISTS "users access own school grades" ON grades;
DROP POLICY IF EXISTS "super_admin all fee_structure" ON fee_structure;
DROP POLICY IF EXISTS "users access own school fee_structure" ON fee_structure;
DROP POLICY IF EXISTS "demo fee_structure access" ON fee_structure;
DROP POLICY IF EXISTS "super_admin all fee_payments" ON fee_payments;
DROP POLICY IF EXISTS "users access own school fee_payments" ON fee_payments;
DROP POLICY IF EXISTS "super_admin all events" ON events;
DROP POLICY IF EXISTS "users access own school events" ON events;
DROP POLICY IF EXISTS "demo events access" ON events;
DROP POLICY IF EXISTS "super_admin all messages" ON messages;
DROP POLICY IF EXISTS "users access own school messages" ON messages;
DROP POLICY IF EXISTS "demo messages access" ON messages;

-- Re-enable RLS
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structure ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_students ENABLE ROW LEVEL SECURITY;

-- Helper function: check if current user is super_admin
-- SECURITY DEFINER runs with owner privileges so it can read the users table
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role = 'super_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function: get current user's school_id
CREATE OR REPLACE FUNCTION public.current_user_school_id()
RETURNS uuid AS $$
  SELECT school_id FROM public.users
  WHERE auth_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================
-- SCHOOLS
-- super_admin: see ALL schools
-- regular user: see only their own school
-- ============================================
CREATE POLICY "schools_select" ON schools FOR SELECT
  USING (
    public.is_super_admin()
    OR id = public.current_user_school_id()
  );

CREATE POLICY "schools_insert" ON schools FOR INSERT
  WITH CHECK (true);

CREATE POLICY "schools_update" ON schools FOR UPDATE
  USING (
    public.is_super_admin()
    OR id = public.current_user_school_id()
  );

CREATE POLICY "schools_delete" ON schools FOR DELETE
  USING (public.is_super_admin());

-- ============================================
-- USERS
-- super_admin: see ALL users
-- regular user: see own profile + users in same school
-- ============================================
CREATE POLICY "users_select" ON users FOR SELECT
  USING (
    public.is_super_admin()
    OR auth_id = auth.uid()
    OR school_id = public.current_user_school_id()
  );

CREATE POLICY "users_insert" ON users FOR INSERT
  WITH CHECK (true);

CREATE POLICY "users_update" ON users FOR UPDATE
  USING (
    public.is_super_admin()
    OR auth_id = auth.uid()
  );

-- ============================================
-- STUDENTS
-- ============================================
CREATE POLICY "students_select" ON students FOR SELECT
  USING (
    public.is_super_admin()
    OR school_id = public.current_user_school_id()
  );

CREATE POLICY "students_insert" ON students FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR school_id = public.current_user_school_id()
  );

CREATE POLICY "students_update" ON students FOR UPDATE
  USING (
    public.is_super_admin()
    OR school_id = public.current_user_school_id()
  );

CREATE POLICY "students_delete" ON students FOR DELETE
  USING (
    public.is_super_admin()
    OR school_id = public.current_user_school_id()
  );

-- ============================================
-- CLASSES
-- ============================================
CREATE POLICY "classes_select" ON classes FOR SELECT
  USING (
    public.is_super_admin()
    OR school_id = public.current_user_school_id()
  );

CREATE POLICY "classes_insert" ON classes FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR school_id = public.current_user_school_id()
  );

CREATE POLICY "classes_update" ON classes FOR UPDATE
  USING (
    public.is_super_admin()
    OR school_id = public.current_user_school_id()
  );

CREATE POLICY "classes_delete" ON classes FOR DELETE
  USING (
    public.is_super_admin()
    OR school_id = public.current_user_school_id()
  );

-- ============================================
-- SUBJECTS
-- ============================================
CREATE POLICY "subjects_select" ON subjects FOR SELECT
  USING (
    public.is_super_admin()
    OR school_id = public.current_user_school_id()
  );

CREATE POLICY "subjects_insert" ON subjects FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR school_id = public.current_user_school_id()
  );

CREATE POLICY "subjects_update" ON subjects FOR UPDATE
  USING (
    public.is_super_admin()
    OR school_id = public.current_user_school_id()
  );

CREATE POLICY "subjects_delete" ON subjects FOR DELETE
  USING (
    public.is_super_admin()
    OR school_id = public.current_user_school_id()
  );

-- ============================================
-- ATTENDANCE (no school_id column - uses class_id subquery)
-- ============================================
CREATE POLICY "attendance_select" ON attendance FOR SELECT
  USING (
    public.is_super_admin()
    OR class_id IN (
      SELECT id FROM classes WHERE school_id = public.current_user_school_id()
    )
  );

CREATE POLICY "attendance_insert" ON attendance FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR class_id IN (
      SELECT id FROM classes WHERE school_id = public.current_user_school_id()
    )
  );

CREATE POLICY "attendance_update" ON attendance FOR UPDATE
  USING (
    public.is_super_admin()
    OR class_id IN (
      SELECT id FROM classes WHERE school_id = public.current_user_school_id()
    )
  );

-- ============================================
-- GRADES (no school_id column - uses class_id subquery)
-- ============================================
CREATE POLICY "grades_select" ON grades FOR SELECT
  USING (
    public.is_super_admin()
    OR class_id IN (
      SELECT id FROM classes WHERE school_id = public.current_user_school_id()
    )
  );

CREATE POLICY "grades_insert" ON grades FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR class_id IN (
      SELECT id FROM classes WHERE school_id = public.current_user_school_id()
    )
  );

CREATE POLICY "grades_update" ON grades FOR UPDATE
  USING (
    public.is_super_admin()
    OR class_id IN (
      SELECT id FROM classes WHERE school_id = public.current_user_school_id()
    )
  );

-- ============================================
-- FEE STRUCTURE
-- ============================================
CREATE POLICY "fee_structure_select" ON fee_structure FOR SELECT
  USING (
    public.is_super_admin()
    OR school_id = public.current_user_school_id()
  );

CREATE POLICY "fee_structure_insert" ON fee_structure FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR school_id = public.current_user_school_id()
  );

CREATE POLICY "fee_structure_update" ON fee_structure FOR UPDATE
  USING (
    public.is_super_admin()
    OR school_id = public.current_user_school_id()
  );

CREATE POLICY "fee_structure_delete" ON fee_structure FOR DELETE
  USING (
    public.is_super_admin()
    OR school_id = public.current_user_school_id()
  );

-- ============================================
-- FEE PAYMENTS (no school_id column - uses student_id subquery)
-- ============================================
CREATE POLICY "fee_payments_select" ON fee_payments FOR SELECT
  USING (
    public.is_super_admin()
    OR student_id IN (
      SELECT id FROM students WHERE school_id = public.current_user_school_id()
    )
  );

CREATE POLICY "fee_payments_insert" ON fee_payments FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR student_id IN (
      SELECT id FROM students WHERE school_id = public.current_user_school_id()
    )
  );

CREATE POLICY "fee_payments_update" ON fee_payments FOR UPDATE
  USING (
    public.is_super_admin()
    OR student_id IN (
      SELECT id FROM students WHERE school_id = public.current_user_school_id()
    )
  );

-- ============================================
-- EVENTS
-- ============================================
CREATE POLICY "events_select" ON events FOR SELECT
  USING (
    public.is_super_admin()
    OR school_id = public.current_user_school_id()
  );

CREATE POLICY "events_insert" ON events FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR school_id = public.current_user_school_id()
  );

CREATE POLICY "events_update" ON events FOR UPDATE
  USING (
    public.is_super_admin()
    OR school_id = public.current_user_school_id()
  );

CREATE POLICY "events_delete" ON events FOR DELETE
  USING (
    public.is_super_admin()
    OR school_id = public.current_user_school_id()
  );

-- ============================================
-- MESSAGES
-- ============================================
CREATE POLICY "messages_select" ON messages FOR SELECT
  USING (
    public.is_super_admin()
    OR school_id = public.current_user_school_id()
  );

CREATE POLICY "messages_insert" ON messages FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR school_id = public.current_user_school_id()
  );

CREATE POLICY "messages_update" ON messages FOR UPDATE
  USING (
    public.is_super_admin()
    OR school_id = public.current_user_school_id()
  );

-- ============================================
-- PARENT STUDENTS
-- ============================================
CREATE POLICY "parent_students_select" ON parent_students FOR SELECT
  USING (
    public.is_super_admin()
    OR parent_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "parent_students_insert" ON parent_students FOR INSERT
  WITH CHECK (true);

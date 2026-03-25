-- ============================================
-- OMUTO SCHOOL MANAGEMENT SYSTEM
-- Database Setup Script
-- Run this entire script in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- 1. SCHOOLS TABLE
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  school_code TEXT UNIQUE NOT NULL,
  district TEXT NOT NULL,
  subcounty TEXT,
  parish TEXT,
  village TEXT,
  school_type TEXT CHECK (school_type IN ('primary', 'secondary', 'combined')) NOT NULL,
  ownership TEXT CHECK (ownership IN ('private', 'government', 'government_aided')) DEFAULT 'private',
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#1e3a5f',
  uneab_center_number TEXT,
  subscription_plan TEXT CHECK (subscription_plan IN ('free', 'basic', 'premium')) DEFAULT 'free',
  subscription_status TEXT CHECK (subscription_status IN ('active', 'expired', 'trial')) DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  role TEXT CHECK (role IN ('super_admin', 'school_admin', 'teacher', 'student', 'parent')) NOT NULL,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CLASSES TABLE
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level TEXT NOT NULL,
  stream TEXT,
  class_teacher_id UUID,
  max_students INTEGER DEFAULT 60,
  academic_year TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SUBJECTS TABLE
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  level TEXT CHECK (level IN ('primary', 'secondary', 'both')) DEFAULT 'both',
  is_compulsory BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. STUDENTS TABLE
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID,
  student_number TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('M', 'F')) NOT NULL,
  date_of_birth DATE,
  parent_name TEXT NOT NULL,
  parent_phone TEXT NOT NULL,
  parent_phone2 TEXT,
  parent_email TEXT,
  address TEXT,
  class_id UUID REFERENCES classes(id),
  admission_date DATE DEFAULT CURRENT_DATE,
  ple_index_number TEXT,
  uneab_number TEXT,
  status TEXT CHECK (status IN ('active', 'transferred', 'dropped', 'completed')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, student_number)
);

-- 6. ATTENDANCE TABLE
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT CHECK (status IN ('present', 'absent', 'late', 'excused')) NOT NULL,
  remarks TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, date)
);

-- 7. GRADES TABLE
CREATE TABLE IF NOT EXISTS grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  assessment_type TEXT CHECK (assessment_type IN ('ca1', 'ca2', 'ca3', 'ca4', 'project', 'exam')) NOT NULL,
  score NUMERIC(5,2) NOT NULL,
  max_score NUMERIC(5,2) DEFAULT 100,
  term INTEGER CHECK (term IN (1, 2, 3)) NOT NULL,
  academic_year TEXT NOT NULL,
  recorded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, subject_id, assessment_type, term, academic_year)
);

-- 8. FEE STRUCTURE TABLE
CREATE TABLE IF NOT EXISTS fee_structure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  term INTEGER CHECK (term IN (1, 2, 3)) NOT NULL,
  academic_year TEXT NOT NULL,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. FEE PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS fee_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  fee_id UUID REFERENCES fee_structure(id) ON DELETE CASCADE,
  amount_paid NUMERIC(12,2) NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('cash', 'mobile_money', 'bank', 'installment')) NOT NULL,
  payment_reference TEXT,
  paid_by TEXT,
  notes TEXT,
  payment_date DATE DEFAULT CURRENT_DATE,
  recorded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. EVENTS TABLE
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT CHECK (event_type IN ('exam', 'meeting', 'holiday', 'event', 'academic')) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  recipient_type TEXT CHECK (recipient_type IN ('individual', 'class', 'all')) NOT NULL,
  recipient_id UUID,
  phone TEXT,
  message TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'sent', 'delivered', 'failed')) DEFAULT 'pending',
  sent_by UUID,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. PARENT-STUDENT LINK TABLE
CREATE TABLE IF NOT EXISTS parent_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  relationship TEXT DEFAULT 'parent',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_id, student_id)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_school_id ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_students_school_id ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_grades_student_id ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_subject_id ON grades(subject_id);
CREATE INDEX IF NOT EXISTS idx_classes_school_id ON classes(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_student_id ON fee_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_events_school_id ON events(school_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
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

-- POLICIES: Allow authenticated users to access their school data
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT USING (auth_id = auth.uid());

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth_id = auth.uid());

CREATE POLICY "School data access" ON students
  FOR ALL USING (
    school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "School data access" ON classes
  FOR ALL USING (
    school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "School data access" ON subjects
  FOR ALL USING (
    school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "School data access" ON attendance
  FOR ALL USING (
    class_id IN (
      SELECT id FROM classes WHERE school_id IN (
        SELECT school_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "School data access" ON grades
  FOR ALL USING (
    class_id IN (
      SELECT id FROM classes WHERE school_id IN (
        SELECT school_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "School data access" ON fee_structure
  FOR ALL USING (
    school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "School data access" ON fee_payments
  FOR ALL USING (
    student_id IN (
      SELECT id FROM students WHERE school_id IN (
        SELECT school_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "School data access" ON events
  FOR ALL USING (
    school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "School data access" ON messages
  FOR ALL USING (
    school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid())
  );

-- Allow anyone to insert users (for registration)
CREATE POLICY "Anyone can register" ON users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can create school" ON schools
  FOR INSERT WITH CHECK (true);

-- ============================================
-- SEED DATA: Demo School
-- ============================================

-- Insert demo school (only if not exists)
INSERT INTO schools (id, name, school_code, district, subcounty, school_type, ownership, phone, subscription_plan, subscription_status, trial_ends_at)
SELECT 
  'a0000000-0000-0000-0000-000000000001',
  'Demo Primary School',
  'DEMO001',
  'Kampala',
  'Central Division',
  'primary',
  'private',
  '0700000000',
  'free',
  'trial',
  NOW() + INTERVAL '30 days'
WHERE NOT EXISTS (SELECT 1 FROM schools WHERE school_code = 'DEMO001');

-- Insert demo classes
INSERT INTO classes (school_id, name, level, max_students, academic_year)
SELECT 'a0000000-0000-0000-0000-000000000001', cls.name, cls.level, 60, '2026'
FROM (VALUES 
  ('P.1A', 'P.1'), ('P.2A', 'P.2'), ('P.3A', 'P.3'), ('P.4A', 'P.4'),
  ('P.5A', 'P.5'), ('P.5B', 'P.5'), ('P.6A', 'P.6'), ('P.7A', 'P.7')
) AS cls(name, level)
WHERE NOT EXISTS (SELECT 1 FROM classes WHERE school_id = 'a0000000-0000-0000-0000-000000000001');

-- Insert primary school subjects
INSERT INTO subjects (school_id, name, code, level, is_compulsory)
SELECT 'a0000000-0000-0000-0000-000000000001', s.name, s.code, s.level, true
FROM (VALUES
  ('English Language', 'ENG', 'primary'),
  ('Mathematics', 'MATH', 'primary'),
  ('Integrated Science', 'SCI', 'primary'),
  ('Social Studies', 'SST', 'primary'),
  ('Religious Education', 'RE', 'primary'),
  ('Local Language', 'LL', 'primary'),
  ('Kiswahili', 'KIS', 'primary'),
  ('CAPE (Music, Dance & Drama)', 'CAPE1', 'primary'),
  ('CAPE (Physical Education)', 'CAPE2', 'primary'),
  ('CAPE (Arts & Technology)', 'CAPE3', 'primary')
) AS s(name, code, level)
WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE school_id = 'a0000000-0000-0000-0000-000000000001');

-- Insert sample events
INSERT INTO events (school_id, title, event_type, start_date, description)
SELECT 'a0000000-0000-0000-0000-000000000001', e.title, e.event_type, e.start_date, e.description
FROM (VALUES
  ('End of Term 1 Exams', 'exam', '2026-03-15'::date, 'Final examinations for Term 1'),
  ('Parent-Teacher Meeting', 'meeting', '2026-03-22'::date, 'Discuss student progress'),
  ('Report Card Distribution', 'academic', '2026-03-28'::date, 'Parents collect report cards'),
  ('Term 2 Opens', 'academic', '2026-04-05'::date, 'School reopens for Term 2'),
  ('Sports Day', 'event', '2026-04-10'::date, 'Annual inter-house sports competition'),
  ('Labour Day', 'holiday', '2026-05-01'::date, 'Public holiday - school closed')
) AS e(title, event_type, start_date, description)
WHERE NOT EXISTS (SELECT 1 FROM events WHERE school_id = 'a0000000-0000-0000-0000-000000000001');

-- ============================================
-- SETUP COMPLETE!
-- ============================================
-- Now you can:
-- 1. Go to /login and register a new school
-- 2. Or use the demo school to test features
-- ============================================

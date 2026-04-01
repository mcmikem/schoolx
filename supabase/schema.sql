-- ============================================
-- OMUTO SCHOOL MANAGEMENT SYSTEM
-- Supabase Database Schema
-- Designed for Uganda Primary & Secondary Schools
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. SCHOOLS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    subscription_plan TEXT CHECK (subscription_plan IN ('free_trial', 'basic', 'premium', 'max')) DEFAULT 'free_trial',
    subscription_status TEXT CHECK (subscription_status IN ('active', 'expired', 'trial', 'past_due')) DEFAULT 'trial',
    trial_ends_at TIMESTAMPTZ,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    paypal_subscription_id TEXT,
    last_payment_at TIMESTAMPTZ,
    next_payment_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. USERS TABLE (All user types)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    role TEXT CHECK (role IN ('super_admin', 'school_admin', 'teacher', 'student', 'parent')) NOT NULL,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. ACADEMIC YEARS
-- ============================================
CREATE TABLE IF NOT EXISTS academic_years (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    year TEXT NOT NULL, -- e.g. "2026"
    is_current BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. TERMS
-- ============================================
CREATE TABLE IF NOT EXISTS terms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
    term_number INTEGER CHECK (term_number IN (1, 2, 3)) NOT NULL,
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. CLASSES (e.g. P.5A, S.2B)
-- ============================================
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. "P.5A", "S.2B"
    level TEXT NOT NULL, -- e.g. "P.5", "S.2"
    stream TEXT, -- e.g. "A", "B", "Science", "Arts"
    class_teacher_id UUID REFERENCES users(id),
    max_students INTEGER DEFAULT 60,
    academic_year TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, name, academic_year)
);

-- ============================================
-- 6. SUBJECTS
-- ============================================
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    level TEXT CHECK (level IN ('primary', 'secondary', 'both')) DEFAULT 'both',
    is_compulsory BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default Uganda subjects
INSERT INTO subjects (school_id, name, code, level, is_compulsory) VALUES
-- These will be inserted per school during setup
-- Primary subjects
(NULL, 'English Language', 'ENG', 'primary', true),
(NULL, 'Mathematics', 'MATH', 'primary', true),
(NULL, 'Integrated Science', 'SCI', 'primary', true),
(NULL, 'Social Studies', 'SST', 'primary', true),
(NULL, 'Religious Education', 'RE', 'primary', true),
(NULL, 'Local Language', 'LL', 'primary', true),
(NULL, 'Kiswahili', 'KIS', 'primary', true),
(NULL, 'CAPE (Music, Dance & Drama)', 'CAPE1', 'primary', true),
(NULL, 'CAPE (Physical Education)', 'CAPE2', 'primary', true),
(NULL, 'CAPE (Arts & Technology)', 'CAPE3', 'primary', true),
-- Secondary subjects (New Lower Secondary Curriculum)
(NULL, 'English Language', 'ENG', 'secondary', true),
(NULL, 'Mathematics', 'MATH', 'secondary', true),
(NULL, 'Integrated Science', 'SCI', 'secondary', true),
(NULL, 'Social Studies', 'SST', 'secondary', true),
(NULL, 'Entrepreneurship', 'ENT', 'secondary', true),
(NULL, 'ICT', 'ICT', 'secondary', true),
(NULL, 'Physical Education', 'PE', 'secondary', true),
(NULL, 'Creative Arts', 'CA', 'secondary', true),
(NULL, 'Technology & Design', 'TD', 'secondary', true),
(NULL, 'Religious Education', 'RE', 'secondary', true);

-- ============================================
-- 7. STUDENTS
-- ============================================
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
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
    ple_index_number TEXT, -- For secondary students
    uneab_number TEXT, -- UNEB candidate number
    status TEXT CHECK (status IN ('active', 'transferred', 'dropped', 'completed')) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, student_number)
);

-- ============================================
-- 8. TEACHER SUBJECTS (Teacher-Subject assignments)
-- ============================================
CREATE TABLE IF NOT EXISTS teacher_subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. ATTENDANCE
-- ============================================
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT CHECK (status IN ('present', 'absent', 'late', 'excused')) NOT NULL,
    remarks TEXT,
    recorded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, date)
);

-- ============================================
-- 10. GRADES (Continuous Assessment & Exams)
-- ============================================
CREATE TABLE IF NOT EXISTS grades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    assessment_type TEXT CHECK (assessment_type IN ('ca1', 'ca2', 'ca3', 'ca4', 'project', 'exam')) NOT NULL,
    score NUMERIC(5,2) NOT NULL,
    max_score NUMERIC(5,2) DEFAULT 100,
    term INTEGER CHECK (term IN (1, 2, 3)) NOT NULL,
    academic_year TEXT NOT NULL,
    recorded_by UUID REFERENCES users(id),
    exam_supervisor_id UUID REFERENCES users(id),
    ca_locked BOOLEAN DEFAULT false,
    locked_by UUID REFERENCES users(id),
    locked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, subject_id, assessment_type, term, academic_year)
);

-- ============================================
-- 11. FEE STRUCTURE
-- ============================================
CREATE TABLE IF NOT EXISTS fee_structure (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. "Tuition", "Development", "Exam Fee"
    amount NUMERIC(12,2) NOT NULL,
    term INTEGER CHECK (term IN (1, 2, 3)) NOT NULL,
    academic_year TEXT NOT NULL,
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, class_id, name, term, academic_year)
);

-- ============================================
-- 12. FEE PAYMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS fee_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    fee_id UUID REFERENCES fee_structure(id) ON DELETE CASCADE,
    amount_paid NUMERIC(12,2) NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('cash', 'mobile_money', 'bank', 'installment')) NOT NULL,
    payment_reference TEXT,
    paid_by TEXT, -- Name of person who paid
    notes TEXT,
    payment_date DATE DEFAULT CURRENT_DATE,
    recorded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 13. EVENTS / CALENDAR
-- ============================================
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT CHECK (event_type IN ('exam', 'meeting', 'holiday', 'event', 'academic', 'substitution')) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 14. MESSAGES (SMS Log)
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    recipient_type TEXT CHECK (recipient_type IN ('individual', 'class', 'all')) NOT NULL,
    recipient_id UUID, -- student_id or class_id
    phone TEXT,
    message TEXT NOT NULL,
    status TEXT CHECK (status IN ('pending', 'sent', 'delivered', 'failed')) DEFAULT 'pending',
    sent_by UUID REFERENCES users(id),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 16. SCHOOL SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS school_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, key)
);

-- ============================================
-- 18. AUDIT LOG
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    user_name TEXT,
    action TEXT CHECK (action IN ('create', 'update', 'delete', 'view', 'login', 'logout')) NOT NULL,
    module TEXT NOT NULL,
    description TEXT,
    record_id TEXT,
    old_value JSONB,
    new_value JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_school ON audit_log(school_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_module ON audit_log(module);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

-- ============================================
-- 17. PARENT-STUDENT LINK
-- ============================================
CREATE TABLE IF NOT EXISTS parent_students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID REFERENCES users(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    relationship TEXT DEFAULT 'parent',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(parent_id, student_id)
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE "schools" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "academic_years" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "terms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "classes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subjects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teacher_subjects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fee_structure" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fee_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "parent_students" ENABLE ROW LEVEL SECURITY;

-- Super Admin can see everything
DROP POLICY IF EXISTS "Super admin full access" ON "schools";
CREATE POLICY "Super admin full access"
ON "schools"
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM "users"
    WHERE "users"."auth_id" = auth.uid()
      AND "users"."role" = 'super_admin'
  )
);

-- =========================
-- STUDENTS
-- =========================

-- SELECT
DROP POLICY IF EXISTS "School users students select" ON "students";
CREATE POLICY "School users students select"
ON "students"
FOR SELECT
TO authenticated
USING (
  "school_id" IN (
    SELECT "school_id"
    FROM "users"
    WHERE "auth_id" = auth.uid()
  )
);

-- INSERT (create students too)
DROP POLICY IF EXISTS "School users students insert" ON "students";
CREATE POLICY "School users students insert"
ON "students"
FOR INSERT
TO authenticated
WITH CHECK (
  "school_id" IN (
    SELECT "school_id"
    FROM "users"
    WHERE "auth_id" = auth.uid()
  )
);

-- UPDATE
DROP POLICY IF EXISTS "School users students update" ON "students";
CREATE POLICY "School users students update"
ON "students"
FOR UPDATE
TO authenticated
USING (
  "school_id" IN (
    SELECT "school_id"
    FROM "users"
    WHERE "auth_id" = auth.uid()
  )
)
WITH CHECK (
  "school_id" IN (
    SELECT "school_id"
    FROM "users"
    WHERE "auth_id" = auth.uid()
  )
);

-- DELETE
DROP POLICY IF EXISTS "School users students delete" ON "students";
CREATE POLICY "School users students delete"
ON "students"
FOR DELETE
TO authenticated
USING (
  "school_id" IN (
    SELECT "school_id"
    FROM "users"
    WHERE "auth_id" = auth.uid()
  )
);

-- =========================
-- CLASSES
-- =========================

DROP POLICY IF EXISTS "School users classes select" ON "classes";
CREATE POLICY "School users classes select"
ON "classes"
FOR SELECT
TO authenticated
USING (
  "school_id" IN (
    SELECT "school_id"
    FROM "users"
    WHERE "auth_id" = auth.uid()
  )
);

DROP POLICY IF EXISTS "School users classes write" ON "classes";
CREATE POLICY "School users classes write"
ON "classes"
FOR ALL
TO authenticated
USING (
  "school_id" IN (
    SELECT "school_id"
    FROM "users"
    WHERE "auth_id" = auth.uid()
  )
)
WITH CHECK (
  "school_id" IN (
    SELECT "school_id"
    FROM "users"
    WHERE "auth_id" = auth.uid()
  )
);

-- =========================
-- ATTENDANCE
-- =========================

DROP POLICY IF EXISTS "School users attendance select" ON "attendance";
CREATE POLICY "School users attendance select"
ON "attendance"
FOR SELECT
TO authenticated
USING (
  "class_id" IN (
    SELECT "id"
    FROM "classes"
    WHERE "school_id" IN (
      SELECT "school_id"
      FROM "users"
      WHERE "auth_id" = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "School users attendance write" ON "attendance";
CREATE POLICY "School users attendance write"
ON "attendance"
FOR ALL
TO authenticated
USING (
  "class_id" IN (
    SELECT "id"
    FROM "classes"
    WHERE "school_id" IN (
      SELECT "school_id"
      FROM "users"
      WHERE "auth_id" = auth.uid()
    )
  )
)
WITH CHECK (
  "class_id" IN (
    SELECT "id"
    FROM "classes"
    WHERE "school_id" IN (
      SELECT "school_id"
      FROM "users"
      WHERE "auth_id" = auth.uid()
    )
  )
);

-- =========================
-- GRADES
-- =========================

DROP POLICY IF EXISTS "School users grades select" ON "grades";
CREATE POLICY "School users grades select"
ON "grades"
FOR SELECT
TO authenticated
USING (
  "class_id" IN (
    SELECT "id"
    FROM "classes"
    WHERE "school_id" IN (
      SELECT "school_id"
      FROM "users"
      WHERE "auth_id" = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "School users grades write" ON "grades";
CREATE POLICY "School users grades write"
ON "grades"
FOR ALL
TO authenticated
USING (
  "class_id" IN (
    SELECT "id"
    FROM "classes"
    WHERE "school_id" IN (
      SELECT "school_id"
      FROM "users"
      WHERE "auth_id" = auth.uid()
    )
  )
)
WITH CHECK (
  "class_id" IN (
    SELECT "id"
    FROM "classes"
    WHERE "school_id" IN (
      SELECT "school_id"
      FROM "users"
      WHERE "auth_id" = auth.uid()
    )
  )
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_school_id ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_students_school_id ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_grades_student_id ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_subject_id ON grades(subject_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_student_id ON fee_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_classes_school_id ON classes(school_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get student's term average
CREATE OR REPLACE FUNCTION get_student_term_average(
    p_student_id UUID,
    p_term INTEGER,
    p_academic_year TEXT
)
RETURNS NUMERIC AS $$
DECLARE
    avg_score NUMERIC;
BEGIN
    SELECT AVG(score) INTO avg_score
    FROM grades
    WHERE student_id = p_student_id
    AND term = p_term
    AND academic_year = p_academic_year;
    
    RETURN COALESCE(avg_score, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to get UNEB grade from score
CREATE OR REPLACE FUNCTION get_uneb_grade(score NUMERIC)
RETURNS TEXT AS $$
BEGIN
    IF score >= 80 THEN RETURN 'D1';
    ELSIF score >= 70 THEN RETURN 'D2';
    ELSIF score >= 65 THEN RETURN 'C3';
    ELSIF score >= 60 THEN RETURN 'C4';
    ELSIF score >= 55 THEN RETURN 'C5';
    ELSIF score >= 50 THEN RETURN 'C6';
    ELSIF score >= 45 THEN RETURN 'P7';
    ELSIF score >= 40 THEN RETURN 'P8';
    ELSE RETURN 'F9';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get division from average score
CREATE OR REPLACE FUNCTION get_uneb_division(avg_score NUMERIC)
RETURNS TEXT AS $$
BEGIN
    IF avg_score >= 80 THEN RETURN 'Division I';
    ELSIF avg_score >= 60 THEN RETURN 'Division II';
    ELSIF avg_score >= 40 THEN RETURN 'Division III';
    ELSIF avg_score >= 20 THEN RETURN 'Division IV';
    ELSE RETURN 'Ungraded';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STORAGE BUCKETS SETUP
-- ============================================

-- Create storage bucket for school logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'school-logos',
    'school-logos',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Create policy for authenticated users to upload school logos
DROP POLICY IF EXISTS "Allow authenticated users to upload school logos" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload school logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'school-logos');

-- Create policy for authenticated users to update school logos
DROP POLICY IF EXISTS "Allow authenticated users to update school logos" ON storage.objects;
CREATE POLICY "Allow authenticated users to update school logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'school-logos');

-- Create policy for anyone to view school logos (for receipt printing)
DROP POLICY IF EXISTS "Allow public to view school logos" ON storage.objects;
CREATE POLICY "Allow public to view school logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'school-logos');

-- Create policy for authenticated users to delete school logos
DROP POLICY IF EXISTS "Authenticated can delete school logos" ON storage.objects;
CREATE POLICY "Authenticated can delete school logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'school-logos');

-- ============================================
-- DORMITORY TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS dorms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('boys', 'girls')) NOT NULL,
    capacity INTEGER DEFAULT 30,
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dorm_students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dorm_id UUID NOT NULL REFERENCES dorms(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    bed_number TEXT,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(dorm_id, student_id)
);

-- ============================================
-- HOMEWORK TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS homework (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    due_date DATE NOT NULL,
    marks INTEGER DEFAULT 10,
    academic_year TEXT,
    term INTEGER,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Homework submissions
CREATE TABLE IF NOT EXISTS homework_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    homework_id UUID NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    marks_obtained INTEGER,
    feedback TEXT,
    UNIQUE(homework_id, student_id)
);

-- ============================================
-- SYLLABUS / SCHEME OF WORK
-- ============================================
CREATE TABLE IF NOT EXISTS syllabus (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    term INTEGER NOT NULL,
    academic_year TEXT NOT NULL,
    topic TEXT NOT NULL,
    subtopics TEXT, -- JSON array of subtopics
    objectives TEXT,
    weeks_covered TEXT, -- e.g., "Week 1-2"
    resources TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Topic coverage tracking
CREATE TABLE IF NOT EXISTS topic_coverage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    syllabus_id UUID NOT NULL REFERENCES syllabus(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status TEXT CHECK (status IN ('not_started', 'in_progress', 'completed')) DEFAULT 'not_started',
    completed_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lesson Plans
CREATE TABLE IF NOT EXISTS lesson_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    lesson_title TEXT NOT NULL,
    objectives TEXT,
    materials TEXT,
    procedure TEXT, -- Lesson procedure/steps
    duration INTEGER, -- minutes
    date DATE,
    term INTEGER,
    academic_year TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NOTICES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT,
    type TEXT DEFAULT 'general',
    priority TEXT DEFAULT 'normal',
    target_audience TEXT DEFAULT 'all',
    published_by UUID REFERENCES users(id) ON DELETE SET NULL,
    publish_date TIMESTAMPTZ,
    expiry_date TIMESTAMPTZ,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for notices
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users notices all" ON notices;
CREATE POLICY "School users notices all" ON notices FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_id = auth.uid()
      AND users.school_id = notices.school_id
  )
);

-- Add image column to notices
ALTER TABLE notices ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ============================================
-- EXAMS TABLE (For Secondary Schools)
-- ============================================
CREATE TABLE IF NOT EXISTS exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    exam_type TEXT CHECK (exam_type IN ('class_test', 'bot', 'mid_term', 'saturday', 'eot', 'mock')) NOT NULL,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    exam_date DATE NOT NULL,
    max_score INTEGER DEFAULT 100,
    weight INTEGER DEFAULT 100,
    term INTEGER,
    academic_year TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EXAM SCORES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS exam_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    exam_type TEXT NOT NULL,
    exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
    score NUMERIC(5,2) NOT NULL,
    max_score NUMERIC(5,2) DEFAULT 100,
    term INTEGER,
    academic_year TEXT,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, subject_id, exam_type, term, academic_year)
);

-- ============================================
-- DORMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS dorms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('boys', 'girls')) NOT NULL,
    capacity INTEGER DEFAULT 30,
    location TEXT,
    warden_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DORM STUDENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS dorm_students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dorm_id UUID NOT NULL REFERENCES dorms(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    bed_number TEXT,
    assigned_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(dorm_id, student_id)
);

-- ============================================
-- LIBRARY BOOKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS library_books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    isbn TEXT,
    title TEXT NOT NULL,
    author TEXT,
    publisher TEXT,
    year_published INTEGER,
    category TEXT,
    copies INTEGER DEFAULT 1,
    available_copies INTEGER,
    shelf_location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LIBRARY CHECKOUTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS library_checkouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    checkout_date DATE DEFAULT CURRENT_DATE,
    due_date DATE,
    return_date DATE,
    status TEXT CHECK (status IN ('checked_out', 'returned', 'overdue')) DEFAULT 'checked_out',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STAFF ATTENDANCE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS staff_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT CHECK (status IN ('present', 'absent', 'late', 'leave')) DEFAULT 'present',
    time_in TIME,
    time_out TIME,
    remarks TEXT,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(staff_id, date)
);

-- RLS for staff_attendance
ALTER TABLE staff_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users staff_attendance all" ON staff_attendance;
CREATE POLICY "School users staff_attendance all" ON staff_attendance FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_id = auth.uid()
      AND users.school_id IN (SELECT school_id FROM users WHERE users.id = staff_attendance.staff_id)
  )
);

-- ============================================
-- LEAVE REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    leave_type TEXT CHECK (leave_type IN ('sick', 'personal', 'bereavement', 'maternity', 'paternity', 'study', 'annual', 'unpaid', 'other')) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_count INTEGER NOT NULL,
    reason TEXT,
    substitute_suggestion TEXT,
    status TEXT CHECK (status IN ('pending', 'dos_approved', 'approved', 'rejected')) DEFAULT 'pending',
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SUBJECT ALLOCATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS subject_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    academic_year TEXT NOT NULL,
    term INTEGER,
    is_class_teacher BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(teacher_id, subject_id, class_id, academic_year, term)
);

-- ============================================
-- STUDENT HEALTH RECORDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS health_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    blood_type TEXT,
    allergies TEXT,
    medical_conditions TEXT,
    medications TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    last_checkup_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- HEALTH VISITS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS health_visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    visit_date DATE NOT NULL,
    complaint TEXT,
    diagnosis TEXT,
    treatment TEXT,
    visited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INVENTORY/ASSETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT CHECK (category IN ('furniture', 'electronics', 'textbooks', 'equipment', 'vehicle', 'building', 'other')) NOT NULL,
    description TEXT,
    quantity INTEGER DEFAULT 1,
    unit_price NUMERIC(12,2),
    total_value NUMERIC(12,2),
    location TEXT,
    condition TEXT CHECK (condition IN ('new', 'good', 'fair', 'poor', 'damaged')) DEFAULT 'good',
    purchased_date DATE,
    supplier TEXT,
    serial_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ASSET ASSIGNMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS asset_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    assigned_to_type TEXT CHECK (assigned_to_type IN ('class', 'staff', 'student')) NOT NULL,
    assigned_to_id UUID NOT NULL,
    quantity INTEGER DEFAULT 1,
    assigned_date DATE DEFAULT CURRENT_DATE,
    returned_date DATE,
    status TEXT CHECK (status IN ('assigned', 'returned')) DEFAULT 'assigned',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TRANSPORT/BUSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS transport_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    route_name TEXT NOT NULL,
    vehicle_number TEXT,
    driver_name TEXT,
    driver_phone TEXT,
    pickup_points TEXT, -- JSON array of pickup points
    monthly_fee NUMERIC(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TRANSPORT STUDENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS transport_students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    route_id UUID NOT NULL REFERENCES transport_routes(id) ON DELETE CASCADE,
    pickup_point TEXT,
    start_date DATE,
    end_date DATE,
    status TEXT CHECK (status IN ('active', 'suspended', 'cancelled')) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BUDGET & EXPENSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g., "Term 1 2026"
    academic_year TEXT NOT NULL,
    term INTEGER,
    total_budget NUMERIC(12,2) NOT NULL,
    status TEXT CHECK (status IN ('draft', 'approved', 'closed')) DEFAULT 'draft',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    budget_id UUID REFERENCES budgets(id) ON DELETE SET NULL,
    category TEXT CHECK (category IN ('salaries', 'utilities', 'maintenance', 'supplies', 'transport', 'events', 'other')) NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    expense_date DATE NOT NULL,
    vendor TEXT,
    receipt_number TEXT,
    status TEXT CHECK (status IN ('pending', 'approved', 'paid')) DEFAULT 'pending',
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STUDENT BEHAVIOR LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS behavior_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    incident_type TEXT CHECK (incident_type IN ('positive', 'negative', 'neutral')) NOT NULL,
    category TEXT, -- e.g., "Disrespect", "Homework", "Helping others"
    description TEXT NOT NULL,
    action_taken TEXT,
    points INTEGER DEFAULT 0, -- Positive/Negative points
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LESSON PLANS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS lesson_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    subtopics TEXT, -- JSON array
    objectives TEXT,
    teaching_method TEXT,
    materials_needed TEXT,
    procedure TEXT,
    assessment TEXT,
    homework TEXT,
    duration INTEGER, -- minutes
    lesson_date DATE,
    term INTEGER,
    academic_year TEXT,
    status TEXT CHECK (status IN ('draft', 'completed', 'cancelled')) DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SCHEME OF WORK TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS scheme_of_work (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    term INTEGER NOT NULL,
    academic_year TEXT NOT NULL,
    week_number INTEGER,
    topic TEXT NOT NULL,
    subtopics TEXT, -- JSON array
    objectives TEXT,
    resources TEXT,
    status TEXT CHECK (status IN ('not_started', 'in_progress', 'completed')) DEFAULT 'not_started',
    completed_date DATE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TEACHER TIMETABLE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS teacher_timetable (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    day_of_week INTEGER NOT NULL, -- 1=Monday, 7=Sunday
    period_number INTEGER NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room TEXT,
    academic_year TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DORM ATTENDANCE TABLE (Nightly Attendance)
-- ============================================
CREATE TABLE IF NOT EXISTS dorm_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    dorm_id UUID REFERENCES dorms(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT CHECK (status IN ('present', 'absent', 'sick', 'permission')) DEFAULT 'present',
    notes TEXT,
    checked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    checked_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(dorm_id, student_id, date)
);

-- ============================================
-- HOMEWORK SUBMISSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS homework_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    homework_id UUID REFERENCES homework(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    submitted_at TIMESTAMPTZ,
    marks INTEGER,
    feedback TEXT,
    status TEXT CHECK (status IN ('pending', 'submitted', 'graded', 'late')) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(homework_id, student_id)
);

-- ============================================
-- UNEB CANDIDATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS uneb_candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    exam_type TEXT CHECK (exam_type IN ('PLE', 'UCE', 'UACE')) NOT NULL,
    index_number TEXT,
    registration_status TEXT CHECK (registration_status IN ('pending', 'registered', 'confirmed')) DEFAULT 'pending',
    fees_paid BOOLEAN DEFAULT false,
    photo_url TEXT,
    academic_year TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, student_id, exam_type, academic_year)
);

-- ============================================
-- STUDENT PROMOTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS student_promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    from_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    to_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    academic_year TEXT NOT NULL,
    promoted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    promoted_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PAYMENT PLANS TABLE (EMI)
-- ============================================
CREATE TABLE IF NOT EXISTS payment_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    total_amount INTEGER NOT NULL,
    installments INTEGER NOT NULL DEFAULT 3,
    start_date DATE NOT NULL,
    status TEXT CHECK (status IN ('active', 'completed', 'defaulted', 'cancelled')) DEFAULT 'active',
    academic_year TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PAYMENT PLAN INSTALLMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payment_plan_installments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID REFERENCES payment_plans(id) ON DELETE CASCADE,
    due_date DATE NOT NULL,
    amount INTEGER NOT NULL,
    paid BOOLEAN DEFAULT false,
    paid_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SMS TEMPLATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sms_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- fee_reminder, attendance, exam, general
    message TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LEAVE APPROVAL WORKFLOW TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS leave_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    leave_request_id UUID REFERENCES leave_requests(id) ON DELETE CASCADE,
    approver_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    comments TEXT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EXPENSE APPROVAL TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS expense_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
    approver_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    comments TEXT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SUBSCRIPTION PAYMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    plan TEXT CHECK (plan IN ('free_trial', 'basic', 'premium', 'max')) NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    currency TEXT DEFAULT 'UGX',
    provider TEXT CHECK (provider IN ('stripe', 'paypal', 'mtn', 'airtel')) NOT NULL,
    transaction_id TEXT NOT NULL,
    payment_status TEXT CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')) DEFAULT 'pending',
    customer_id TEXT,
    subscription_id TEXT,
    invoice_url TEXT,
    receipt_url TEXT,
    payment_method_detail TEXT,
    phone_number TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_school ON subscription_payments(school_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_status ON subscription_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_transaction ON subscription_payments(transaction_id);

-- ============================================
-- PAYMENT HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payment_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    payment_id UUID REFERENCES subscription_payments(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_history_school ON payment_history(school_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_payment ON payment_history(payment_id);

-- ============================================
-- MOBILE MONEY PENDING PAYMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS pending_mobile_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    plan TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    provider TEXT CHECK (provider IN ('mtn', 'airtel')) NOT NULL,
    phone_number TEXT NOT NULL,
    tx_ref TEXT NOT NULL,
    status TEXT CHECK (status IN ('pending', 'completed', 'failed', 'expired')) DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tx_ref)
);

CREATE INDEX IF NOT EXISTS idx_pending_mobile_payments_txref ON pending_mobile_payments(tx_ref);
CREATE INDEX IF NOT EXISTS idx_pending_mobile_payments_school ON pending_mobile_payments(school_id);

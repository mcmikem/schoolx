-- ============================================
-- OMUTO SCHOOL MANAGEMENT SYSTEM
-- Supabase Database Schema
-- Designed for Uganda Primary & Secondary Schools
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Also ensure gen_random_uuid is available (Postgres 13+)
DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS "pgcrypto"; EXCEPTION WHEN duplicate_object THEN END $$;

-- ============================================
-- 1. SCHOOLS TABLE
-- ============================================
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
    uneb_center_number TEXT,
    subscription_plan TEXT CHECK (subscription_plan IN ('free_trial', 'basic', 'premium', 'max')) DEFAULT 'free_trial',
    subscription_status TEXT CHECK (subscription_status IN ('active', 'expired', 'trial', 'past_due')) DEFAULT 'trial',
    trial_ends_at TIMESTAMPTZ,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    paypal_subscription_id TEXT,
    last_payment_at TIMESTAMPTZ,
    next_payment_date TIMESTAMPTZ,
    signature_headteacher_url TEXT,
    signature_class_teacher_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. USERS TABLE (All user types)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    year TEXT NOT NULL, -- e.g. "2026"
    is_current BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. TERMS
-- ============================================
CREATE TABLE IF NOT EXISTS terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- RLS for subjects
DROP POLICY IF EXISTS "School users subjects select" ON "subjects";
CREATE POLICY "School users subjects select"
ON "subjects"
FOR SELECT
TO authenticated
USING (
  school_id = my_school_id()
);

DROP POLICY IF EXISTS "School users subjects write" ON "subjects";
CREATE POLICY "School users subjects write"
ON "subjects"
FOR ALL
TO authenticated
USING (
  school_id = my_school_id()
)
WITH CHECK (
  school_id = my_school_id()
);

-- ============================================
-- 6.5 HOUSES (Sports/competition houses)
-- ============================================
CREATE TABLE IF NOT EXISTS houses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. STUDENTS
-- ============================================
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    uneb_number TEXT, -- UNEB candidate number
    status TEXT CHECK (status IN ('active', 'transferred', 'dropped', 'completed')) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, student_number)
);

-- Extended student fields (keep schema.sql in sync with application selects)
ALTER TABLE students ADD COLUMN IF NOT EXISTS blood_type TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS religion TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS nationality TEXT DEFAULT 'Ugandan';
ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS passport_photo_url TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS transfer_from TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS transfer_to TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS transfer_reason TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS dropout_reason TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS dropout_date DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS repeating BOOLEAN DEFAULT false;
ALTER TABLE students ADD COLUMN IF NOT EXISTS last_attendance_date DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS consecutive_absent_days INTEGER DEFAULT 0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS house_id UUID;
ALTER TABLE students ADD COLUMN IF NOT EXISTS previous_school TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS district_origin TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS sub_county TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS parish TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS village TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS boarding_status TEXT DEFAULT 'day';
ALTER TABLE students ADD COLUMN IF NOT EXISTS games_house TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_class_monitor BOOLEAN DEFAULT false;
ALTER TABLE students ADD COLUMN IF NOT EXISTS prefect_role TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_council_role TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(12,2) DEFAULT 0;

-- ============================================
-- 8. TEACHER SUBJECTS (Teacher-Subject assignments)
-- ============================================
CREATE TABLE IF NOT EXISTS teacher_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. ATTENDANCE
-- ============================================
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
-- 11.5 ACADEMIC TERMS (also see "terms" table above for FK-based variant)
-- ============================================
CREATE TABLE IF NOT EXISTS academic_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    term_number INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    academic_year TEXT NOT NULL,
    is_current BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, term_number, academic_year)
);

ALTER TABLE academic_terms ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE academic_terms ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE academic_terms ADD COLUMN IF NOT EXISTS term_number INT;
ALTER TABLE academic_terms ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE academic_terms ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE academic_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users academic_terms select" ON academic_terms;
CREATE POLICY "School users academic_terms select"
ON academic_terms
FOR SELECT
TO authenticated
USING (
  school_id IN (
    SELECT school_id
    FROM users
    WHERE auth_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "School users academic_terms write" ON academic_terms;
CREATE POLICY "School users academic_terms write"
ON academic_terms
FOR ALL
TO authenticated
USING (
  school_id IN (
    SELECT school_id
    FROM users
    WHERE auth_id = auth.uid()
  )
)
WITH CHECK (
  school_id IN (
    SELECT school_id
    FROM users
    WHERE auth_id = auth.uid()
  )
);

-- ============================================
-- 12. FEE PAYMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS fee_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT CHECK (event_type IN ('exam', 'meeting', 'holiday', 'event', 'academic', 'substitution')) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for events
DROP POLICY IF EXISTS "School users events select" ON "events";
CREATE POLICY "School users events select"
ON "events"
FOR SELECT
TO authenticated
USING (
  school_id = my_school_id()
);

DROP POLICY IF EXISTS "School users events write" ON "events";
CREATE POLICY "School users events write"
ON "events"
FOR ALL
TO authenticated
USING (
  school_id = my_school_id()
)
WITH CHECK (
  school_id = my_school_id()
);

-- School settings (RLS with my_school_id() helper — SECURITY DEFINER bypasses recursion)
DROP POLICY IF EXISTS "School users can access school_settings" ON school_settings;
CREATE POLICY "School users can access school_settings"
ON school_settings
FOR ALL
TO authenticated
USING (school_id = my_school_id())
WITH CHECK (school_id = my_school_id());

-- ============================================
-- 14. MESSAGES (SMS Log)
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES users(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    relationship TEXT DEFAULT 'parent',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(parent_id, student_id)
);

-- ============================================
-- 18. ACTIVITY COMMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS activity_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    author_id UUID REFERENCES users(id),
    author_name VARCHAR(100),
    content TEXT NOT NULL,
    comment_type VARCHAR(20) DEFAULT 'note' CHECK (comment_type IN ('note', 'system', 'action_required', 'resolved')),
    is_internal BOOLEAN DEFAULT false,
    parent_id UUID REFERENCES activity_comments(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_comments_entity ON activity_comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_comments_author ON activity_comments(author_id);
ALTER TABLE activity_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users activity_comments all" ON activity_comments;
CREATE POLICY "School users activity_comments all" ON activity_comments FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 19. AUTOMATED MESSAGE LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS automated_message_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    trigger_id UUID REFERENCES sms_triggers(id) ON DELETE SET NULL,
    recipient_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed')) DEFAULT 'sent',
    sent_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_automated_message_logs_school ON automated_message_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_automated_message_logs_trigger ON automated_message_logs(trigger_id, created_at);
ALTER TABLE automated_message_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users automated_message_logs select" ON automated_message_logs;
CREATE POLICY "School users automated_message_logs select" ON automated_message_logs FOR SELECT TO authenticated USING (school_id = my_school_id());
DROP POLICY IF EXISTS "School users automated_message_logs insert" ON automated_message_logs;
CREATE POLICY "School users automated_message_logs insert" ON automated_message_logs FOR INSERT TO authenticated WITH CHECK (school_id = my_school_id());

-- ============================================
-- 20. CANTEEN ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS canteen_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'food',
    price NUMERIC(12,2) NOT NULL,
    stock INTEGER DEFAULT 0,
    unit TEXT DEFAULT 'pieces',
    is_active BOOLEAN DEFAULT true,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE canteen_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users canteen_items all" ON canteen_items;
CREATE POLICY "School users canteen_items all" ON canteen_items FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 21. CANTEEN ORDERS
-- ============================================
CREATE TABLE IF NOT EXISTS canteen_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    items JSONB DEFAULT '[]',
    total NUMERIC(12,2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE canteen_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users canteen_orders all" ON canteen_orders;
CREATE POLICY "School users canteen_orders all" ON canteen_orders FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 22. CANTEEN SALES
-- ============================================
CREATE TABLE IF NOT EXISTS canteen_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    total_amount NUMERIC(12,2) NOT NULL,
    payment_method TEXT DEFAULT 'cash',
    items JSONB DEFAULT '[]',
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE canteen_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users canteen_sales all" ON canteen_sales;
CREATE POLICY "School users canteen_sales all" ON canteen_sales FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 23. COURSES
-- ============================================
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'core',
    is_active BOOLEAN DEFAULT true,
    is_elective BOOLEAN DEFAULT false,
    is_laboratory BOOLEAN DEFAULT false,
    credit_hours INTEGER DEFAULT 0,
    max_score INTEGER DEFAULT 100,
    passing_score INTEGER DEFAULT 50,
    color TEXT DEFAULT '#3b82f6',
    icon TEXT DEFAULT 'menu_book',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, code)
);
CREATE INDEX IF NOT EXISTS idx_courses_school_name ON courses(school_id, name);
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users courses all" ON courses;
CREATE POLICY "School users courses all" ON courses FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 24. COURSE CLASSES
-- ============================================
CREATE TABLE IF NOT EXISTS course_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    academic_year VARCHAR(10) NOT NULL,
    term_id UUID REFERENCES academic_terms(id),
    teacher_id UUID REFERENCES users(id),
    is_compulsory BOOLEAN DEFAULT true,
    weight DECIMAL(3,2) DEFAULT 1.00,
    max_score INTEGER DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(course_id, class_id, academic_year)
);
CREATE INDEX IF NOT EXISTS idx_course_classes_course ON course_classes(course_id);
CREATE INDEX IF NOT EXISTS idx_course_classes_class ON course_classes(class_id);
CREATE INDEX IF NOT EXISTS idx_course_classes_year ON course_classes(academic_year);
ALTER TABLE course_classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users course_classes all" ON course_classes;
CREATE POLICY "School users course_classes all" ON course_classes FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 25. DROPOUT INTERVENTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS dropout_interventions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    student_name TEXT,
    reason TEXT,
    action_taken TEXT,
    logged_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE dropout_interventions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users dropout_interventions all" ON dropout_interventions;
CREATE POLICY "School users dropout_interventions all" ON dropout_interventions FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 26. FEE ADJUSTMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS fee_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    adjustment_type TEXT CHECK (adjustment_type IN ('discount', 'scholarship', 'penalty', 'manual_credit')) NOT NULL,
    notes TEXT,
    recorded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fee_adjustments_student ON fee_adjustments(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_adjustments_type ON fee_adjustments(adjustment_type);
ALTER TABLE fee_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users fee_adjustments all" ON fee_adjustments;
CREATE POLICY "School users fee_adjustments all" ON fee_adjustments FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 27. FEE TERMS
-- ============================================
CREATE TABLE IF NOT EXISTS fee_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL,
    description TEXT,
    term_type VARCHAR(20) DEFAULT 'fixed_days' CHECK (term_type IN ('fixed_days', 'fixed_date', 'installments')),
    total_amount DECIMAL(12, 2) NOT NULL,
    discount_percentage DECIMAL(5, 2) DEFAULT 0,
    no_of_days INTEGER,
    day_type VARCHAR(20) CHECK (day_type IN ('before', 'after')),
    is_active BOOLEAN DEFAULT true,
    academic_year VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, code, academic_year)
);
CREATE INDEX IF NOT EXISTS idx_fee_terms_school ON fee_terms(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_terms_year ON fee_terms(academic_year);
ALTER TABLE fee_terms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users fee_terms all" ON fee_terms;
CREATE POLICY "School users fee_terms all" ON fee_terms FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 28. FEE TERM LINES
-- ============================================
CREATE TABLE IF NOT EXISTS fee_term_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    term_id UUID NOT NULL REFERENCES fee_terms(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,
    due_days INTEGER,
    due_date DATE,
    amount_percentage DECIMAL(5, 2) NOT NULL CHECK (amount_percentage > 0 AND amount_percentage <= 100),
    amount DECIMAL(12, 2),
    is_optional BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fee_term_lines_term ON fee_term_lines(term_id);
ALTER TABLE fee_term_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users fee_term_lines all" ON fee_term_lines;
CREATE POLICY "School users fee_term_lines all" ON fee_term_lines FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 29. INVENTORY ALERTS
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    asset_id UUID,
    alert_type TEXT NOT NULL,
    current_stock NUMERIC(12,2),
    reorder_level NUMERIC(12,2),
    deficit NUMERIC(12,2),
    notified_at TIMESTAMPTZ,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE inventory_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users inventory_alerts all" ON inventory_alerts;
CREATE POLICY "School users inventory_alerts all" ON inventory_alerts FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 30. NOTICE ACKNOWLEDGMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS notice_acknowledgments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notice_id UUID NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    acknowledged_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(notice_id, user_id)
);
ALTER TABLE notice_acknowledgments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users notice_acknowledgments all" ON notice_acknowledgments;
CREATE POLICY "School users notice_acknowledgments all" ON notice_acknowledgments FOR ALL TO authenticated USING (true);

-- ============================================
-- 31. PARENT MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS parent_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES users(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('parent', 'school')),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_parent_messages_school ON parent_messages(school_id);
CREATE INDEX IF NOT EXISTS idx_parent_messages_parent ON parent_messages(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_messages_student ON parent_messages(student_id);
ALTER TABLE parent_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users parent_messages all" ON parent_messages;
CREATE POLICY "School users parent_messages all" ON parent_messages FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 32. PASSWORD RESET TOKENS
-- ============================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at) WHERE used_at IS NULL;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "password_reset_tokens_owner" ON password_reset_tokens;
CREATE POLICY "password_reset_tokens_owner" ON password_reset_tokens FOR SELECT TO authenticated USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));
DROP POLICY IF EXISTS "password_reset_tokens_insert" ON password_reset_tokens;
CREATE POLICY "password_reset_tokens_insert" ON password_reset_tokens FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================
-- 33. PAYMENTS (Subscription Invoices)
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    plan TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    currency TEXT DEFAULT 'UGX',
    provider TEXT DEFAULT 'manual',
    payment_status TEXT DEFAULT 'pending',
    transaction_id TEXT,
    invoice_url TEXT,
    receipt_url TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users payments all" ON payments;
CREATE POLICY "School users payments all" ON payments FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 34. PAYROLL DEDUCTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS payroll_deductions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    payroll_record_id UUID,
    staff_id UUID,
    type TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    month INTEGER,
    year INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE payroll_deductions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users payroll_deductions all" ON payroll_deductions;
CREATE POLICY "School users payroll_deductions all" ON payroll_deductions FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 35. PAYROLL RECORDS
-- ============================================
CREATE TABLE IF NOT EXISTS payroll_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    gross_salary NUMERIC(12,2) NOT NULL,
    allowances NUMERIC(12,2) DEFAULT 0,
    nssf_employee NUMERIC(12,2) DEFAULT 0,
    nssf_employer NUMERIC(12,2) DEFAULT 0,
    nssf_total NUMERIC(12,2) DEFAULT 0,
    paye NUMERIC(12,2) DEFAULT 0,
    other_deductions NUMERIC(12,2) DEFAULT 0,
    total_deductions NUMERIC(12,2) DEFAULT 0,
    net_salary NUMERIC(12,2) NOT NULL,
    bank_account TEXT,
    bank_name TEXT,
    nssf_number TEXT,
    tin_number TEXT,
    status TEXT DEFAULT 'processed',
    processed_at TIMESTAMPTZ,
    processed_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users payroll_records all" ON payroll_records;
CREATE POLICY "School users payroll_records all" ON payroll_records FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 36. PAYROLL SUMMARIES
-- ============================================
CREATE TABLE IF NOT EXISTS payroll_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    staff_count INTEGER DEFAULT 0,
    total_gross NUMERIC(12,2) DEFAULT 0,
    total_nssf NUMERIC(12,2) DEFAULT 0,
    total_paye NUMERIC(12,2) DEFAULT 0,
    total_net NUMERIC(12,2) DEFAULT 0,
    generated_at TIMESTAMPTZ,
    generated_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE payroll_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users payroll_summaries all" ON payroll_summaries;
CREATE POLICY "School users payroll_summaries all" ON payroll_summaries FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 37. PERIOD ATTENDANCE
-- ============================================
CREATE TABLE IF NOT EXISTS period_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    period TEXT NOT NULL,
    status TEXT NOT NULL,
    recorded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, date, period)
);
ALTER TABLE period_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users period_attendance all" ON period_attendance;
CREATE POLICY "School users period_attendance all" ON period_attendance FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 38. PROMOTION HISTORY
-- ============================================
CREATE TABLE IF NOT EXISTS promotion_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    student_name TEXT,
    from_class TEXT,
    to_class TEXT,
    promotion_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE promotion_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users promotion_history all" ON promotion_history;
CREATE POLICY "School users promotion_history all" ON promotion_history FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 39. PUSH SUBSCRIPTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    keys JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_subscriptions_own" ON push_subscriptions;
CREATE POLICY "push_subscriptions_own" ON push_subscriptions FOR ALL TO authenticated USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())) WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- ============================================
-- 40. RATE LIMIT LOG
-- ============================================
CREATE TABLE IF NOT EXISTS rate_limit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_log_key_created ON rate_limit_log(key, created_at);
ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rate_limit_log_service_role" ON rate_limit_log;
CREATE POLICY "rate_limit_log_service_role" ON rate_limit_log FOR ALL TO service_role USING (true);

-- ============================================
-- 41. REPORT CARDS
-- ============================================
CREATE TABLE IF NOT EXISTS report_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    academic_year TEXT NOT NULL,
    term INTEGER NOT NULL,
    subjects JSONB DEFAULT '[]',
    aggregate NUMERIC,
    division TEXT,
    best4 NUMERIC[],
    attendance_rate NUMERIC,
    generated_at TIMESTAMPTZ,
    generated_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, academic_year, term)
);
ALTER TABLE report_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users report_cards all" ON report_cards;
CREATE POLICY "School users report_cards all" ON report_cards FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 42. SALARY PAYMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS salary_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month INTEGER CHECK (month BETWEEN 1 AND 12) NOT NULL,
    year INTEGER NOT NULL,
    base_paid NUMERIC(12, 2) NOT NULL,
    allowances_paid NUMERIC(12, 2) DEFAULT 0,
    deductions_applied NUMERIC(12, 2) DEFAULT 0,
    net_paid NUMERIC(12, 2) NOT NULL,
    payment_date DATE DEFAULT CURRENT_DATE,
    payment_status TEXT CHECK (payment_status IN ('pending', 'processing', 'paid', 'failed')) DEFAULT 'paid',
    reference_number TEXT,
    remarks TEXT,
    processed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE salary_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users salary_payments all" ON salary_payments;
CREATE POLICY "School users salary_payments all" ON salary_payments FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 43. SCHOOL WORKFLOWS
-- ============================================
CREATE TABLE IF NOT EXISTS school_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    trigger_id TEXT NOT NULL,
    action_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_school_workflows_school_id ON school_workflows(school_id);
ALTER TABLE school_workflows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users school_workflows all" ON school_workflows;
CREATE POLICY "School users school_workflows all" ON school_workflows FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 44. SETUP CHECKLIST
-- ============================================
CREATE TABLE IF NOT EXISTS setup_checklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    item_key TEXT NOT NULL,
    item_label TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, item_key)
);
ALTER TABLE setup_checklist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users setup_checklist all" ON setup_checklist;
CREATE POLICY "School users setup_checklist all" ON setup_checklist FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 45. SMS AUTOMATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS sms_automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    automation_type TEXT NOT NULL CHECK (automation_type IN ('fee_overdue', 'absentee_alert', 'payment_confirmation', 'report_card_ready')),
    is_active BOOLEAN DEFAULT true,
    schedule_days INTEGER[] DEFAULT '{7, 14, 30}',
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, automation_type)
);
ALTER TABLE sms_automations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users sms_automations all" ON sms_automations;
CREATE POLICY "School users sms_automations all" ON sms_automations FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 46. SMS LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS sms_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
    automation_type TEXT NOT NULL,
    student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    parent_phone TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
    metadata JSONB DEFAULT '{}',
    sent_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users sms_logs all" ON sms_logs;
CREATE POLICY "School users sms_logs all" ON sms_logs FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 47. SMS TRIGGERS
-- ============================================
CREATE TABLE IF NOT EXISTS sms_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('fee_overdue', 'student_absent', 'staff_absent', 'exam_results')),
    threshold_days INTEGER DEFAULT 0,
    template_id UUID REFERENCES sms_templates(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE sms_triggers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users sms_triggers all" ON sms_triggers;
CREATE POLICY "School users sms_triggers all" ON sms_triggers FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 48. STAFF
-- ============================================
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    employee_number TEXT,
    position TEXT,
    department TEXT,
    role TEXT,
    gross_salary NUMERIC(12,2) DEFAULT 0,
    allowances NUMERIC(12,2) DEFAULT 0,
    deductions NUMERIC(12,2) DEFAULT 0,
    bank_account TEXT,
    bank_name TEXT,
    nssf_number TEXT,
    tin_number TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users staff all" ON staff;
CREATE POLICY "School users staff all" ON staff FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 49. STAFF REVIEWS
-- ============================================
CREATE TABLE IF NOT EXISTS staff_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    review_date DATE DEFAULT CURRENT_DATE,
    period_start DATE,
    period_end DATE,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    strengths TEXT,
    areas_for_improvement TEXT,
    goals TEXT,
    comments TEXT,
    status TEXT CHECK (status IN ('draft', 'shared', 'completed')) DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE staff_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users staff_reviews all" ON staff_reviews;
CREATE POLICY "School users staff_reviews all" ON staff_reviews FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 50. STAFF SALARIES
-- ============================================
CREATE TABLE IF NOT EXISTS staff_salaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    base_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
    allowances NUMERIC(12, 2) DEFAULT 0,
    deductions NUMERIC(12, 2) DEFAULT 0,
    currency TEXT DEFAULT 'UGX',
    payment_method TEXT CHECK (payment_method IN ('bank', 'mobile_money', 'cash', 'cheque')) DEFAULT 'cash',
    bank_name TEXT,
    account_number TEXT,
    mobile_money_number TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(staff_id)
);
ALTER TABLE staff_salaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users staff_salaries all" ON staff_salaries;
CREATE POLICY "School users staff_salaries all" ON staff_salaries FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 51. STUDENT ENROLLMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS student_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    academic_year VARCHAR(20) NOT NULL,
    roll_number VARCHAR(50),
    enrollment_date TIMESTAMPTZ DEFAULT NOW(),
    state VARCHAR(20) DEFAULT 'running' CHECK (state IN ('draft', 'running', 'completed', 'transferred', 'dropped')),
    completion_date TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    UNIQUE(student_id, class_id, academic_year)
);
CREATE INDEX IF NOT EXISTS idx_enrollment_student ON student_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_class ON student_enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_year ON student_enrollments(academic_year);
ALTER TABLE student_enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users student_enrollments all" ON student_enrollments;
CREATE POLICY "School users student_enrollments all" ON student_enrollments FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 52. STUDENT FEE TERMS
-- ============================================
CREATE TABLE IF NOT EXISTS student_fee_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    fee_term_id UUID NOT NULL REFERENCES fee_terms(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id),
    academic_year VARCHAR(20) NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    final_amount DECIMAL(12, 2) NOT NULL,
    amount_paid DECIMAL(12, 2) DEFAULT 0,
    balance DECIMAL(12, 2) GENERATED ALWAYS AS (final_amount - amount_paid) STORED,
    start_date DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, fee_term_id, academic_year)
);
CREATE INDEX IF NOT EXISTS idx_student_fee_terms_student ON student_fee_terms(student_id);
ALTER TABLE student_fee_terms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users student_fee_terms all" ON student_fee_terms;
CREATE POLICY "School users student_fee_terms all" ON student_fee_terms FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 53. STUDENT FEES
-- ============================================
CREATE TABLE IF NOT EXISTS student_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    total_fees NUMERIC(12,2) DEFAULT 0,
    amount_paid NUMERIC(12,2) DEFAULT 0,
    balance NUMERIC(12,2) GENERATED ALWAYS AS (total_fees - amount_paid) STORED,
    academic_year VARCHAR(20),
    term INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE student_fees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users student_fees all" ON student_fees;
CREATE POLICY "School users student_fees all" ON student_fees FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 54. STUDENT GRADES
-- ============================================
CREATE TABLE IF NOT EXISTS student_grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    academic_year TEXT NOT NULL,
    term INTEGER NOT NULL,
    ca1 NUMERIC(5,2) DEFAULT 0,
    ca2 NUMERIC(5,2) DEFAULT 0,
    ca3 NUMERIC(5,2) DEFAULT 0,
    ca4 NUMERIC(5,2) DEFAULT 0,
    project NUMERIC(5,2) DEFAULT 0,
    exam_score NUMERIC(5,2) DEFAULT 0,
    final_score NUMERIC(5,2),
    status TEXT DEFAULT 'draft',
    locked BOOLEAN DEFAULT false,
    locked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE student_grades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users student_grades all" ON student_grades;
CREATE POLICY "School users student_grades all" ON student_grades FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 55. STUDENT TRANSFERS
-- ============================================
CREATE TABLE IF NOT EXISTS student_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    transfer_type TEXT CHECK (transfer_type IN ('in', 'out')) NOT NULL,
    previous_school TEXT,
    next_school TEXT,
    transfer_date DATE NOT NULL,
    reason TEXT,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'completed')) DEFAULT 'pending',
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE student_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users student_transfers all" ON student_transfers;
CREATE POLICY "School users student_transfers all" ON student_transfers FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 56. STUDENT WALLETS
-- ============================================
CREATE TABLE IF NOT EXISTS student_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE UNIQUE,
    balance NUMERIC(12,2) DEFAULT 0,
    daily_spend_limit NUMERIC(12,2),
    last_topup_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_student_wallets_school ON student_wallets(school_id);
ALTER TABLE student_wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users student_wallets all" ON student_wallets;
CREATE POLICY "School users student_wallets all" ON student_wallets FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 57. SUGGESTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'feedback',
    status TEXT DEFAULT 'pending',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users suggestions all" ON suggestions;
CREATE POLICY "School users suggestions all" ON suggestions FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 58. TEACHER SUBSTITUTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS teacher_substitutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    absent_teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    substitute_teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    period INTEGER NOT NULL,
    reason TEXT,
    status TEXT CHECK (status IN ('pending', 'completed', 'cancelled')) DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE teacher_substitutions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users teacher_substitutions all" ON teacher_substitutions;
CREATE POLICY "School users teacher_substitutions all" ON teacher_substitutions FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 59. TERM ARCHIVES
-- ============================================
CREATE TABLE IF NOT EXISTS term_archives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year TEXT NOT NULL,
    term INTEGER NOT NULL,
    classes_count INTEGER,
    students_count INTEGER,
    grades_count INTEGER,
    archived_at TIMESTAMPTZ,
    archived_by TEXT,
    data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE term_archives ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users term_archives all" ON term_archives;
CREATE POLICY "School users term_archives all" ON term_archives FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 60. TIMETABLE SLOTS
-- ============================================
CREATE TABLE IF NOT EXISTS timetable_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_lesson BOOLEAN DEFAULT true,
    order_number INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE timetable_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users timetable_slots all" ON timetable_slots;
CREATE POLICY "School users timetable_slots all" ON timetable_slots FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 61. WALLET TRANSACTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    wallet_id UUID REFERENCES student_wallets(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    transaction_type TEXT CHECK (transaction_type IN ('topup', 'spend', 'refund', 'adjustment')),
    type TEXT,
    description TEXT,
    reference_id TEXT,
    reference TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_school ON wallet_transactions(school_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet ON wallet_transactions(wallet_id);
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users wallet_transactions all" ON wallet_transactions;
CREATE POLICY "School users wallet_transactions all" ON wallet_transactions FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE "schools" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "academic_years" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "terms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "classes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subjects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "houses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teacher_subjects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fee_structure" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fee_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "parent_students" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "school_settings" ENABLE ROW LEVEL SECURITY;

-- Helper: SECURITY DEFINER functions to avoid RLS recursion when querying users
CREATE OR REPLACE FUNCTION my_school_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT school_id FROM users WHERE auth_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION is_school_admin(p_school_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
      AND school_id = p_school_id
      AND role IN ('school_admin', 'headmaster', 'admin', 'super_admin')
  )
$$;

-- Users can see their own record (no subquery on users to avoid infinite recursion)
DROP POLICY IF EXISTS "Users select own and school" ON "users";
DROP POLICY IF EXISTS "Users select own" ON "users";
CREATE POLICY "Users select own"
ON "users"
FOR SELECT
TO authenticated
USING (auth_id = auth.uid());

-- Users can update their own record
DROP POLICY IF EXISTS "Users update own" ON "users";
CREATE POLICY "Users update own"
ON "users"
FOR UPDATE
TO authenticated
USING (auth_id = auth.uid())
WITH CHECK (auth_id = auth.uid());

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
-- ACADEMIC YEARS
-- =========================
DROP POLICY IF EXISTS "School users academic_years select" ON "academic_years";
CREATE POLICY "School users academic_years select"
ON "academic_years"
FOR SELECT
TO authenticated
USING (school_id = my_school_id());

DROP POLICY IF EXISTS "School users academic_years write" ON "academic_years";
CREATE POLICY "School users academic_years write"
ON "academic_years"
FOR ALL
TO authenticated
USING (school_id = my_school_id())
WITH CHECK (school_id = my_school_id());

-- =========================
-- TERMS
-- =========================
DROP POLICY IF EXISTS "School users terms access" ON "terms";
CREATE POLICY "School users terms access"
ON "terms"
FOR ALL
TO authenticated
USING (school_id = my_school_id())
WITH CHECK (school_id = my_school_id());

-- =========================
-- TEACHER SUBJECTS
-- =========================
DROP POLICY IF EXISTS "School users teacher_subjects select" ON "teacher_subjects";
CREATE POLICY "School users teacher_subjects select"
ON "teacher_subjects"
FOR SELECT
TO authenticated
USING (class_id IN (SELECT id FROM classes WHERE school_id = my_school_id()));

DROP POLICY IF EXISTS "School users teacher_subjects write" ON "teacher_subjects";
CREATE POLICY "School users teacher_subjects write"
ON "teacher_subjects"
FOR ALL
TO authenticated
USING (class_id IN (SELECT id FROM classes WHERE school_id = my_school_id()))
WITH CHECK (class_id IN (SELECT id FROM classes WHERE school_id = my_school_id()));

-- =========================
-- FEE STRUCTURE
-- =========================
DROP POLICY IF EXISTS "School users fee_structure select" ON "fee_structure";
CREATE POLICY "School users fee_structure select"
ON "fee_structure"
FOR SELECT
TO authenticated
USING (school_id = my_school_id());

DROP POLICY IF EXISTS "School users fee_structure write" ON "fee_structure";
CREATE POLICY "School users fee_structure write"
ON "fee_structure"
FOR ALL
TO authenticated
USING (school_id = my_school_id())
WITH CHECK (school_id = my_school_id());

-- =========================
-- FEE PAYMENTS
-- =========================
DROP POLICY IF EXISTS "School users fee_payments select" ON "fee_payments";
CREATE POLICY "School users fee_payments select"
ON "fee_payments"
FOR SELECT
TO authenticated
USING (student_id IN (SELECT id FROM students WHERE school_id = my_school_id()));

DROP POLICY IF EXISTS "School users fee_payments write" ON "fee_payments";
CREATE POLICY "School users fee_payments write"
ON "fee_payments"
FOR ALL
TO authenticated
USING (student_id IN (SELECT id FROM students WHERE school_id = my_school_id()))
WITH CHECK (student_id IN (SELECT id FROM students WHERE school_id = my_school_id()));

-- =========================
-- MESSAGES
-- =========================
DROP POLICY IF EXISTS "School users messages access" ON "messages";
CREATE POLICY "School users messages access"
ON "messages"
FOR ALL
TO authenticated
USING (school_id = my_school_id())
WITH CHECK (school_id = my_school_id());

-- =========================
-- PARENT STUDENTS
-- =========================
DROP POLICY IF EXISTS "School users parent_students select" ON "parent_students";
CREATE POLICY "School users parent_students select"
ON "parent_students"
FOR SELECT
TO authenticated
USING (
  parent_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  OR student_id IN (SELECT id FROM students WHERE school_id = my_school_id())
);

DROP POLICY IF EXISTS "School users parent_students write" ON "parent_students";
CREATE POLICY "School users parent_students write"
ON "parent_students"
FOR ALL
TO authenticated
USING (student_id IN (SELECT id FROM students WHERE school_id = my_school_id()))
WITH CHECK (student_id IN (SELECT id FROM students WHERE school_id = my_school_id()));

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
  school_id = my_school_id()
);

-- INSERT (create students too)
DROP POLICY IF EXISTS "School users students insert" ON "students";
CREATE POLICY "School users students insert"
ON "students"
FOR INSERT
TO authenticated
WITH CHECK (
  school_id = my_school_id()
);

-- UPDATE
DROP POLICY IF EXISTS "School users students update" ON "students";
CREATE POLICY "School users students update"
ON "students"
FOR UPDATE
TO authenticated
USING (
  school_id = my_school_id()
)
WITH CHECK (
  school_id = my_school_id()
);

-- DELETE
DROP POLICY IF EXISTS "School users students delete" ON "students";
CREATE POLICY "School users students delete"
ON "students"
FOR DELETE
TO authenticated
USING (
  school_id = my_school_id()
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
  school_id = my_school_id()
);

DROP POLICY IF EXISTS "School users classes write" ON "classes";
CREATE POLICY "School users classes write"
ON "classes"
FOR ALL
TO authenticated
USING (
  school_id = my_school_id()
)
WITH CHECK (
  school_id = my_school_id()
);

-- =========================
-- HOUSES
-- =========================

DROP POLICY IF EXISTS "School users houses select" ON "houses";
CREATE POLICY "School users houses select"
ON "houses"
FOR SELECT
TO authenticated
USING (
  school_id = my_school_id()
);

DROP POLICY IF EXISTS "School users houses write" ON "houses";
CREATE POLICY "School users houses write"
ON "houses"
FOR ALL
TO authenticated
USING (
  school_id = my_school_id()
)
WITH CHECK (
  school_id = my_school_id()
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
    WHERE school_id = my_school_id()
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
    WHERE school_id = my_school_id()
  )
)
WITH CHECK (
  "class_id" IN (
    SELECT "id"
    FROM "classes"
    WHERE school_id = my_school_id()
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
    WHERE school_id = my_school_id()
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
    WHERE school_id = my_school_id()
  )
)
WITH CHECK (
  "class_id" IN (
    SELECT "id"
    FROM "classes"
    WHERE school_id = my_school_id()
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
-- HOMEWORK TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS homework (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- ============================================
-- SYLLABUS / SCHEME OF WORK
-- ============================================
CREATE TABLE IF NOT EXISTS syllabus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    cross_cutting_theme TEXT[] DEFAULT '{}'
);

-- Topic coverage tracking
CREATE TABLE IF NOT EXISTS topic_coverage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    syllabus_id UUID NOT NULL REFERENCES syllabus(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status TEXT CHECK (status IN ('not_started', 'in_progress', 'completed')) DEFAULT 'not_started',
    completed_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for syllabus
ALTER TABLE syllabus ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School staff can manage own syllabus" ON syllabus;
CREATE POLICY "School staff can manage own syllabus" ON syllabus
  FOR ALL USING (
    school_id IN (SELECT my_school_id())
  );

-- ============================================
-- NOTICES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dorm_id UUID NOT NULL REFERENCES dorms(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    bed_number TEXT,
    assigned_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(dorm_id, student_id)
);

-- ============================================
-- STAFF ATTENDANCE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS staff_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    plan TEXT CHECK (plan IN ('free_trial', 'starter', 'growth', 'enterprise', 'lifetime')) NOT NULL,
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    plan TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    provider TEXT CHECK (provider IN ('mtn', 'airtel')) NOT NULL,
    phone_number TEXT NOT NULL,
    reference TEXT NOT NULL,
    status TEXT CHECK (status IN ('pending', 'completed', 'failed', 'expired')) DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(reference)
);

CREATE INDEX IF NOT EXISTS idx_pending_mobile_payments_reference ON pending_mobile_payments(reference);
CREATE INDEX IF NOT EXISTS idx_pending_mobile_payments_school ON pending_mobile_payments(school_id);

ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_mobile_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users subscription payments all" ON subscription_payments;
CREATE POLICY "School users subscription payments all" ON subscription_payments FOR ALL TO authenticated USING (
  school_id = my_school_id()
);

DROP POLICY IF EXISTS "School users payment history all" ON payment_history;
CREATE POLICY "School users payment history all" ON payment_history FOR ALL TO authenticated USING (
  school_id = my_school_id()
);

DROP POLICY IF EXISTS "School users pending mobile payments all" ON pending_mobile_payments;
CREATE POLICY "School users pending mobile payments all" ON pending_mobile_payments FOR ALL TO authenticated USING (
  school_id = my_school_id()
);

-- ============================================
-- ADDITIONAL TABLES FOR PRODUCTION READINESS
-- ============================================

-- 1. BUDGET ITEMS (Persistence for Budgeting Module)
CREATE TABLE IF NOT EXISTS budget_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    type TEXT CHECK (type IN ('income', 'expense')) NOT NULL,
    budgeted NUMERIC(12,2) DEFAULT 0,
    actual NUMERIC(12,2) DEFAULT 0,
    academic_year TEXT,
    term INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, category, academic_year, term)
);

-- 2. PAYROLL HISTORY (Tracking processed salaries)
CREATE TABLE IF NOT EXISTS payroll_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES users(id) ON DELETE CASCADE,
    month TEXT NOT NULL, -- e.g. "April 2026"
    gross_pay NUMERIC(12,2) NOT NULL,
    nssf_deduction NUMERIC(12,2) DEFAULT 0,
    paye_tax NUMERIC(12,2) DEFAULT 0,
    other_deductions NUMERIC(12,2) DEFAULT 0,
    net_pay NUMERIC(12,2) NOT NULL,
    status TEXT CHECK (status IN ('pending', 'paid')) DEFAULT 'pending',
    payment_method TEXT,
    processed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(staff_id, month)
);

-- 3. LIBRARY BOOKS
CREATE TABLE IF NOT EXISTS library_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    isbn TEXT,
    title TEXT NOT NULL,
    author TEXT,
    publisher TEXT,
    year_published INTEGER,
    category TEXT,
    total_copies INTEGER DEFAULT 1,
    available_copies INTEGER DEFAULT 1,
    shelf_location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. LIBRARY CHECKOUTS
CREATE TABLE IF NOT EXISTS library_checkouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    checkout_date DATE DEFAULT CURRENT_DATE,
    due_date DATE,
    return_date DATE,
    status TEXT CHECK (status IN ('checked_out', 'returned', 'overdue')) DEFAULT 'checked_out',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for new tables
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_checkouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School users budget_items all" ON budget_items FOR ALL TO authenticated USING (school_id = my_school_id());
CREATE POLICY "School users payroll_history all" ON payroll_history FOR ALL TO authenticated USING (school_id = my_school_id());
CREATE POLICY "School users library_books all" ON library_books FOR ALL TO authenticated USING (school_id = my_school_id());
CREATE POLICY "School users library_checkouts all" ON library_checkouts FOR ALL TO authenticated USING (school_id = my_school_id());

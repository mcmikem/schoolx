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
    subscription_plan TEXT CHECK (subscription_plan IN ('free_trial', 'basic', 'premium', 'max', 'starter', 'growth', 'enterprise', 'lifetime')) DEFAULT 'free_trial',
    subscription_status TEXT CHECK (subscription_status IN ('active', 'expired', 'trial', 'past_due', 'suspended', 'canceled', 'unpaid')) DEFAULT 'trial',
    trial_ends_at TIMESTAMPTZ,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    paypal_subscription_id TEXT,
    last_payment_at TIMESTAMPTZ,
    next_payment_date TIMESTAMPTZ,
    signature_headteacher_url TEXT,
    signature_class_teacher_url TEXT,
    billing_mode TEXT NOT NULL DEFAULT 'full_suite' CHECK (billing_mode IN ('full_suite', 'modular')),
    school_size_band TEXT NOT NULL DEFAULT 'small' CHECK (school_size_band IN ('small', 'medium', 'large')),
    feature_stage TEXT DEFAULT 'core',
    support_phone TEXT DEFAULT '256727790003',
    student_id_format TEXT DEFAULT 'STU{YYYY}{####}',
    has_boarding BOOLEAN DEFAULT false,
    has_houses BOOLEAN DEFAULT false,
    has_student_council BOOLEAN DEFAULT false,
    location_type TEXT CHECK (location_type IN ('urban', 'peri_urban', 'rural')) DEFAULT 'urban',
    address TEXT,
    motto TEXT,
    principal_name TEXT,
    report_header TEXT,
    report_footer TEXT,
    id_card_style TEXT DEFAULT 'standard',
    onboarded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_tester BOOLEAN DEFAULT false,
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
    role TEXT CHECK (role IN ('super_admin', 'school_admin', 'admin', 'headmaster', 'board', 'dean_of_studies', 'bursar', 'teacher', 'secretary', 'dorm_master', 'student', 'parent', 'marketer')) NOT NULL,
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
    motto TEXT,
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
    uneab_number TEXT, -- UNEB candidate number (column spelling matches prod)
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
ALTER TABLE students ADD COLUMN IF NOT EXISTS nin TEXT;

CREATE INDEX IF NOT EXISTS idx_students_school_status
  ON public.students (school_id, status);

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
    period_number INTEGER DEFAULT 1, -- matches prod (202605190001_scenarios_fixes.sql)
    status TEXT CHECK (status IN ('present', 'absent', 'late', 'excused')) NOT NULL,
    remarks TEXT,
    recorded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, date, period_number)
);

-- ============================================
-- 10. GRADES (Continuous Assessment & Exams)
-- ============================================
CREATE TABLE IF NOT EXISTS grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    assessment_type TEXT CHECK (assessment_type IN ('ca1', 'ca2', 'ca3', 'ca4', 'project', 'exam', 'competency', 'u1', 'u2', 'eot')) NOT NULL,
    score NUMERIC(5,2) NOT NULL,
    max_score NUMERIC(5,2) DEFAULT 100,
    term INTEGER CHECK (term IN (1, 2, 3)) NOT NULL,
    academic_year TEXT NOT NULL,
    recorded_by UUID REFERENCES users(id),
    exam_supervisor_id UUID REFERENCES users(id),
    ca_locked BOOLEAN DEFAULT false,
    locked_by UUID REFERENCES users(id),
    locked_at TIMESTAMPTZ,
    competency_level TEXT,
    topic_name TEXT,
    teacher_remark TEXT,
    identifier_score NUMERIC(3,1),
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
    name TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    term INTEGER CHECK (term IN (1, 2, 3)) NOT NULL,
    academic_year TEXT NOT NULL,
    due_date DATE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id),
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
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    fee_id UUID REFERENCES fee_structure(id) ON DELETE SET NULL,
    student_fee_term_id UUID REFERENCES student_fee_terms(id) ON DELETE SET NULL,
    amount_paid NUMERIC(12,2) NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('cash', 'mobile_money', 'bank', 'installment', 'in_kind')) NOT NULL,
    payment_reference TEXT,
    paid_by TEXT,
    notes TEXT,
    payment_date DATE DEFAULT CURRENT_DATE,
    recorded_by UUID REFERENCES users(id),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id),
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

CREATE INDEX IF NOT EXISTS idx_events_school_start_date
  ON public.events (school_id, start_date DESC);

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
    recipient_type TEXT CHECK (recipient_type IN ('individual', 'class', 'all', 'bulk', 'staff')) NOT NULL,
    recipient_id TEXT,
    phone TEXT,
    message TEXT NOT NULL,
    status TEXT CHECK (status IN ('pending', 'sent', 'delivered', 'failed')) DEFAULT 'pending',
    delivery_status TEXT,
    recipient_count INTEGER DEFAULT 1,
    sent_by UUID REFERENCES users(id),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_school_created
  ON public.messages (school_id, created_at DESC);

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
-- 16B. APP EVENTS — usage & error tracking
-- ============================================
CREATE TABLE IF NOT EXISTS app_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('page_view', 'feature_use', 'error', 'api_call')),
    event_name TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    url TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_events_created ON app_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_events_type ON app_events (event_type);
CREATE INDEX IF NOT EXISTS idx_app_events_name ON app_events (event_name);
CREATE INDEX IF NOT EXISTS idx_app_events_school ON app_events (school_id);
CREATE INDEX IF NOT EXISTS idx_app_events_user ON app_events (user_id);

ALTER TABLE app_events ENABLE ROW LEVEL SECURITY;

-- Super admins can read all events
CREATE POLICY app_events_select_super_admin ON app_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
        AND users.role = 'super_admin'
    )
  );

-- Service role can insert events (API endpoint uses service role)
CREATE POLICY app_events_insert_service ON app_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

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
    recipient_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed')) DEFAULT 'sent',
    record_id TEXT,
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
CREATE POLICY "School users canteen_orders all" ON canteen_orders FOR ALL TO authenticated
USING (
  (school_id = my_school_id() AND is_staff_role())
  OR student_id IN (SELECT my_student_ids())
)
WITH CHECK (
  (school_id = my_school_id() AND is_staff_role())
  OR (school_id = my_school_id() AND student_id IS NOT NULL AND student_id IN (SELECT my_student_ids()))
);

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
    adjustment_type TEXT CHECK (adjustment_type IN ('discount', 'scholarship', 'penalty', 'manual_credit', 'write_off', 'bursary', 'amnesty')) NOT NULL,
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
CREATE POLICY "School users notice_acknowledgments all" ON notice_acknowledgments FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM notices n
    JOIN users u ON u.id = notice_acknowledgments.user_id
    WHERE n.id = notice_acknowledgments.notice_id
      AND n.school_id = my_school_id()
  )
);

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
CREATE POLICY "School users parent_messages all" ON parent_messages FOR ALL TO authenticated
USING (
  (school_id = my_school_id() AND is_staff_role())
  OR parent_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
)
WITH CHECK (
  (school_id = my_school_id() AND is_staff_role())
  OR (school_id = my_school_id() AND parent_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))
);

-- ============================================
-- 31.5 PARENT NOTIFICATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS parent_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    action_url TEXT,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_parent_notifications_parent ON parent_notifications(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_notifications_school ON parent_notifications(school_id);
ALTER TABLE parent_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Parent notifications own" ON parent_notifications;
CREATE POLICY "Parent notifications own" ON parent_notifications FOR ALL TO authenticated USING (
  parent_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
) WITH CHECK (
  parent_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

DROP POLICY IF EXISTS "School users parent_notifications all" ON parent_notifications;
CREATE POLICY "School users parent_notifications all" ON parent_notifications FOR ALL TO authenticated USING (
  school_id = my_school_id() AND is_staff_role()
) WITH CHECK (
  school_id = my_school_id() AND is_staff_role()
);

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
DROP POLICY IF EXISTS "School users period_attendance select" ON period_attendance;
DROP POLICY IF EXISTS "School users period_attendance write" ON period_attendance;
CREATE POLICY "School users period_attendance select" ON period_attendance FOR SELECT TO authenticated USING (
  (school_id = my_school_id() AND is_staff_role())
  OR student_id IN (SELECT my_student_ids())
);
CREATE POLICY "School users period_attendance write" ON period_attendance FOR ALL TO authenticated USING (
  school_id = my_school_id() AND is_staff_role()
) WITH CHECK (school_id = my_school_id() AND is_staff_role());

-- ============================================
-- 37d. STUDENT COMMENTS (report-card comments)
-- ============================================
CREATE TABLE IF NOT EXISTS student_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, subject_id)
);
ALTER TABLE student_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users student_comments select" ON student_comments;
DROP POLICY IF EXISTS "School users student_comments write" ON student_comments;
CREATE POLICY "School users student_comments select" ON student_comments FOR SELECT TO authenticated USING (
  (student_id IN (SELECT id FROM students WHERE school_id = my_school_id()) AND is_staff_role())
  OR student_id IN (SELECT my_student_ids())
);
CREATE POLICY "School users student_comments write" ON student_comments FOR ALL TO authenticated USING (
  student_id IN (SELECT id FROM students WHERE school_id = my_school_id()) AND is_staff_role()
) WITH CHECK (student_id IN (SELECT id FROM students WHERE school_id = my_school_id()) AND is_staff_role());

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
    report_format TEXT DEFAULT 'numerical' CHECK (report_format IN ('numerical', 'competency', 'cbc')),
    identifier_total NUMERIC,
    formative_total NUMERIC,
    summative_total NUMERIC,
    grading_scheme JSONB,
    date_of_issue DATE,
    next_term_opens DATE,
    class_teacher_name TEXT,
    head_teacher_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, academic_year, term)
);
ALTER TABLE report_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users report_cards all" ON report_cards;
CREATE POLICY "School users report_cards all" ON report_cards FOR ALL TO authenticated USING (school_id = my_school_id() AND is_staff_role()) WITH CHECK (school_id = my_school_id() AND is_staff_role());

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
    skipped BOOLEAN DEFAULT FALSE,
    skipped_at TIMESTAMPTZ,
    sort_order INTEGER,
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
-- 47.5 SMS QUOTA
-- ============================================
CREATE TABLE IF NOT EXISTS sms_quota (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    monthly_limit INTEGER NOT NULL DEFAULT 500,
    monthly_used INTEGER NOT NULL DEFAULT 0,
    reset_day INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id)
);
CREATE INDEX IF NOT EXISTS idx_sms_quota_school ON sms_quota(school_id);
ALTER TABLE sms_quota ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users sms_quota all" ON sms_quota;
CREATE POLICY "School users sms_quota all" ON sms_quota FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- 47.6 SMS USAGE
-- ============================================
CREATE TABLE IF NOT EXISTS sms_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    month TEXT NOT NULL,
    year INTEGER NOT NULL,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, month, year)
);
CREATE INDEX IF NOT EXISTS idx_sms_usage_school ON sms_usage(school_id);
CREATE INDEX IF NOT EXISTS idx_sms_usage_month_year ON sms_usage(school_id, year, month);
ALTER TABLE sms_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users sms_usage all" ON sms_usage;
CREATE POLICY "School users sms_usage all" ON sms_usage FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

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
CREATE POLICY "School users student_fee_terms all" ON student_fee_terms FOR ALL TO authenticated
USING (
  (school_id = my_school_id() AND is_staff_role())
  OR student_id IN (SELECT my_student_ids())
)
WITH CHECK (
  (school_id = my_school_id() AND is_staff_role())
  OR (school_id = my_school_id() AND student_id IN (SELECT my_student_ids()))
);

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
DROP POLICY IF EXISTS "School users student_grades select" ON student_grades;
DROP POLICY IF EXISTS "School users student_grades write" ON student_grades;
CREATE POLICY "School users student_grades select" ON student_grades FOR SELECT TO authenticated USING (
  (student_id IN (SELECT id FROM students WHERE school_id = my_school_id()) AND is_staff_role())
  OR student_id IN (SELECT my_student_ids())
);
CREATE POLICY "School users student_grades write" ON student_grades FOR ALL TO authenticated USING (
  student_id IN (SELECT id FROM students WHERE school_id = my_school_id()) AND is_staff_role()
) WITH CHECK (student_id IN (SELECT id FROM students WHERE school_id = my_school_id()) AND is_staff_role());

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
CREATE POLICY "School users student_wallets all" ON student_wallets FOR ALL TO authenticated
USING (
  (school_id = my_school_id() AND is_staff_role())
  OR student_id IN (SELECT my_student_ids())
)
WITH CHECK (
  (school_id = my_school_id() AND is_staff_role())
  OR (school_id = my_school_id() AND student_id IN (SELECT my_student_ids()))
);

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
DROP POLICY IF EXISTS "School users term_archives select" ON term_archives;
DROP POLICY IF EXISTS "School users term_archives write" ON term_archives;
CREATE POLICY "School users term_archives select" ON term_archives FOR SELECT TO authenticated USING (
  school_id = my_school_id() AND is_staff_role()
);
CREATE POLICY "School users term_archives write" ON term_archives FOR ALL TO authenticated USING (
  school_id = my_school_id() AND is_staff_role()
) WITH CHECK (school_id = my_school_id() AND is_staff_role());

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
CREATE POLICY "School users wallet_transactions all" ON wallet_transactions FOR ALL TO authenticated
USING (
  (school_id = my_school_id() AND is_staff_role())
  OR student_id IN (SELECT my_student_ids())
)
WITH CHECK (
  (school_id = my_school_id() AND is_staff_role())
  OR (school_id = my_school_id() AND student_id IN (SELECT my_student_ids()))
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

CREATE OR REPLACE FUNCTION is_school_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT is_school_admin(my_school_id())
$$;

CREATE OR REPLACE FUNCTION is_school_staff(p_school_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
      AND school_id = p_school_id
      AND role IN ('school_admin', 'headmaster', 'admin', 'super_admin', 'teacher', 'class_teacher', 'deputy_head')
  )
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

CREATE OR REPLACE FUNCTION my_student_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT ps.student_id
  FROM parent_students ps
  JOIN users u ON u.id = ps.parent_id
  WHERE u.auth_id = auth.uid()
  UNION
  SELECT s.id
  FROM students s
  JOIN users u ON u.id = s.user_id
  WHERE u.auth_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION is_staff_role()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
      AND role IS DISTINCT FROM 'parent'
      AND role IS DISTINCT FROM 'student'
  )
$$;

CREATE OR REPLACE FUNCTION my_children_class_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT s.class_id
  FROM parent_students ps
  JOIN students s ON s.id = ps.student_id
  JOIN users u ON u.id = ps.parent_id
  WHERE u.auth_id = auth.uid()
    AND s.class_id IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION increment_sms_usage(
  p_school_id UUID,
  p_month TEXT,
  p_year INTEGER,
  p_success BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO sms_usage (school_id, month, year, sent_count, failed_count)
  VALUES (
    p_school_id,
    p_month,
    p_year,
    CASE WHEN p_success THEN 1 ELSE 0 END,
    CASE WHEN p_success THEN 0 ELSE 1 END
  )
  ON CONFLICT (school_id, month, year)
  DO UPDATE SET
    sent_count = sms_usage.sent_count + CASE WHEN p_success THEN 1 ELSE 0 END,
    failed_count = sms_usage.failed_count + CASE WHEN p_success THEN 0 ELSE 1 END;

  UPDATE sms_quota
  SET monthly_used = (
    SELECT COALESCE(SUM(sent_count + failed_count), 0)
    FROM sms_usage
    WHERE school_id = p_school_id AND month = p_month AND year = p_year
  )
  WHERE school_id = p_school_id;
END;
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

-- School users can view their own school
DROP POLICY IF EXISTS "School users select own school" ON "schools";
CREATE POLICY "School users select own school"
ON "schools"
FOR SELECT
TO authenticated
USING (id = my_school_id());

-- School admins can update their own school (name, logo, colors, etc.)
DROP POLICY IF EXISTS "School admins update own school" ON "schools";
CREATE POLICY "School admins update own school"
ON "schools"
FOR UPDATE
TO authenticated
USING (id = my_school_id() AND is_school_admin(id))
WITH CHECK (id = my_school_id());

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
USING (
  (student_id IN (SELECT id FROM students WHERE school_id = my_school_id()) AND is_staff_role())
  OR student_id IN (SELECT my_student_ids())
);

DROP POLICY IF EXISTS "School users fee_payments write" ON "fee_payments";
CREATE POLICY "School users fee_payments write"
ON "fee_payments"
FOR ALL
TO authenticated
USING (student_id IN (SELECT id FROM students WHERE school_id = my_school_id()) AND is_staff_role())
WITH CHECK (student_id IN (SELECT id FROM students WHERE school_id = my_school_id()) AND is_staff_role());

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
  OR (student_id IN (SELECT id FROM students WHERE school_id = my_school_id()) AND is_staff_role())
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
DROP POLICY IF EXISTS students_select ON "students";
CREATE POLICY "School users students select"
ON "students"
FOR SELECT
TO authenticated
USING (
  (school_id = my_school_id() AND is_staff_role())
  OR id IN (SELECT my_student_ids())
);

-- INSERT (create students too)
DROP POLICY IF EXISTS "School users students insert" ON "students";
CREATE POLICY "School users students insert"
ON "students"
FOR INSERT
TO authenticated
WITH CHECK (
  school_id = my_school_id() AND is_staff_role()
);

-- UPDATE
DROP POLICY IF EXISTS "School users students update" ON "students";
DROP POLICY IF EXISTS students_update ON "students";
CREATE POLICY "School users students update"
ON "students"
FOR UPDATE
TO authenticated
USING (
  school_id = my_school_id() AND is_staff_role()
)
WITH CHECK (
  school_id = my_school_id() AND is_staff_role()
);

-- DELETE
DROP POLICY IF EXISTS "School users students delete" ON "students";
CREATE POLICY "School users students delete"
ON "students"
FOR DELETE
TO authenticated
USING (
  school_id = my_school_id() AND is_staff_role()
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
  ("class_id" IN (
    SELECT "id"
    FROM "classes"
    WHERE school_id = my_school_id()
  ) AND is_staff_role())
  OR student_id IN (SELECT my_student_ids())
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
  ) AND is_staff_role()
)
WITH CHECK (
  "class_id" IN (
    SELECT "id"
    FROM "classes"
    WHERE school_id = my_school_id()
  ) AND is_staff_role()
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
  ("class_id" IN (
    SELECT "id"
    FROM "classes"
    WHERE school_id = my_school_id()
  ) AND is_staff_role())
  OR student_id IN (SELECT my_student_ids())
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
  ) AND is_staff_role()
)
WITH CHECK (
  "class_id" IN (
    SELECT "id"
    FROM "classes"
    WHERE school_id = my_school_id()
  ) AND is_staff_role()
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

-- Create storage bucket for student photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'student-photos',
    'student-photos',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Create policy for authenticated users to upload student photos
DROP POLICY IF EXISTS "Allow authenticated users to upload student photos" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload student photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'student-photos');

-- Create policy for authenticated users to update student photos
DROP POLICY IF EXISTS "Allow authenticated users to update student photos" ON storage.objects;
CREATE POLICY "Allow authenticated users to update student photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'student-photos');

-- Create policy for anyone to view student photos
DROP POLICY IF EXISTS "Allow public to view student photos" ON storage.objects;
CREATE POLICY "Allow public to view student photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'student-photos');

-- Create policy for authenticated users to delete student photos
DROP POLICY IF EXISTS "Authenticated can delete student photos" ON storage.objects;
CREATE POLICY "Authenticated can delete student photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'student-photos');

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
    reorder_level INTEGER DEFAULT 0,
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
    category TEXT NOT NULL,
    message TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users sms_templates all" ON sms_templates;
CREATE POLICY "School users sms_templates all" ON sms_templates FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

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
    plan TEXT CHECK (plan IN ('free_trial', 'basic', 'premium', 'max', 'starter', 'growth', 'enterprise', 'lifetime')) NOT NULL,
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_payments_transaction ON subscription_payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_school ON subscription_payments(school_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_status ON subscription_payments(payment_status);

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
-- MARKETER COMMISSION SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS marketer_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    marketer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
    earning_type TEXT NOT NULL CHECK (earning_type IN ('onboarding_bonus', 'subscription_commission', 'performance_bonus', 'adjustment', 'digitization_fee')),
    amount NUMERIC(12,2) NOT NULL,
    currency TEXT DEFAULT 'UGX',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'cancelled', 'paid')),
    notes TEXT,
    period_start DATE,
    period_end DATE,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketer_earnings_marketer ON marketer_earnings (marketer_id);
CREATE INDEX IF NOT EXISTS idx_marketer_earnings_status ON marketer_earnings (status);
CREATE INDEX IF NOT EXISTS idx_marketer_earnings_school ON marketer_earnings (school_id);

ALTER TABLE marketer_earnings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "marketer_earnings_super_admin" ON marketer_earnings;
CREATE POLICY "marketer_earnings_super_admin" ON marketer_earnings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin'));

DROP POLICY IF EXISTS "marketer_earnings_self_read" ON marketer_earnings;
CREATE POLICY "marketer_earnings_self_read" ON marketer_earnings FOR SELECT TO authenticated
  USING (marketer_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE TABLE IF NOT EXISTS marketer_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    marketer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    currency TEXT DEFAULT 'UGX',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
    paid_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketer_payouts_marketer ON marketer_payouts (marketer_id);
CREATE INDEX IF NOT EXISTS idx_marketer_payouts_status ON marketer_payouts (status);

ALTER TABLE marketer_payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "marketer_payouts_super_admin" ON marketer_payouts;
CREATE POLICY "marketer_payouts_super_admin" ON marketer_payouts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin'));

DROP POLICY IF EXISTS "marketer_payouts_self_read" ON marketer_payouts;
CREATE POLICY "marketer_payouts_self_read" ON marketer_payouts FOR SELECT TO authenticated
  USING (marketer_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

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

-- ============================================
-- MEAL SERVICE RULES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS meal_service_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'supper')),
        is_enabled BOOLEAN NOT NULL DEFAULT false,
        eligibility TEXT NOT NULL DEFAULT 'all' CHECK (eligibility IN ('all', 'boarding_only')),
        start_time TIME,
        end_time TIME,
        max_servings_per_day SMALLINT NOT NULL DEFAULT 1 CHECK (max_servings_per_day >= 1 AND max_servings_per_day <= 3),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (school_id, meal_type)
);

-- ============================================
-- MEAL SCAN LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS meal_scan_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'supper')),
        service_date DATE NOT NULL DEFAULT (timezone('Africa/Kampala', now()))::date,
        served_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        served_by UUID REFERENCES users(id) ON DELETE SET NULL,
        source TEXT NOT NULL DEFAULT 'scanner',
        notes TEXT,
        UNIQUE (school_id, student_id, meal_type, service_date)
);

CREATE INDEX IF NOT EXISTS idx_meal_scan_logs_school_date ON meal_scan_logs (school_id, service_date DESC);
CREATE INDEX IF NOT EXISTS idx_meal_scan_logs_student_date ON meal_scan_logs (student_id, service_date DESC);

CREATE OR REPLACE FUNCTION touch_meal_service_rules_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_meal_service_rules_updated_at ON meal_service_rules;
CREATE TRIGGER trg_touch_meal_service_rules_updated_at
BEFORE UPDATE ON meal_service_rules
FOR EACH ROW
EXECUTE FUNCTION touch_meal_service_rules_updated_at();

ALTER TABLE meal_service_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_scan_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school users can read meal_service_rules" ON meal_service_rules;
CREATE POLICY "school users can read meal_service_rules"
ON meal_service_rules
FOR SELECT
TO authenticated
USING (school_id = my_school_id());

DROP POLICY IF EXISTS "school admins can write meal_service_rules" ON meal_service_rules;
CREATE POLICY "school admins can write meal_service_rules"
ON meal_service_rules
FOR ALL
TO authenticated
USING (school_id = my_school_id() AND is_school_admin())
WITH CHECK (school_id = my_school_id() AND is_school_admin());

DROP POLICY IF EXISTS "school users can read meal_scan_logs" ON meal_scan_logs;
CREATE POLICY "school users can read meal_scan_logs"
ON meal_scan_logs
FOR SELECT
TO authenticated
USING (school_id = my_school_id());

DROP POLICY IF EXISTS "school users can insert meal_scan_logs" ON meal_scan_logs;
CREATE POLICY "school users can insert meal_scan_logs"
ON meal_scan_logs
FOR INSERT
TO authenticated
WITH CHECK (school_id = my_school_id());

DROP POLICY IF EXISTS "school admins can delete meal_scan_logs" ON meal_scan_logs;
CREATE POLICY "school admins can delete meal_scan_logs"
ON meal_scan_logs
FOR DELETE
TO authenticated
USING (school_id = my_school_id() AND is_school_admin());

CREATE OR REPLACE FUNCTION cleanup_old_meal_scan_logs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM meal_scan_logs
    WHERE service_date < (timezone('Africa/Kampala', now()))::date;
END;
$$;

-- ============================================
-- SCAN EVENT LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS scan_event_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('student_meal', 'staff_attendance')),
    target_id UUID,
    meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'supper')),
    attendance_action TEXT CHECK (attendance_action IN ('check_in', 'check_out')),
    operator_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    scanner_id TEXT,
    source TEXT NOT NULL DEFAULT 'scanner',
    raw_scan_hash TEXT,
    is_signed BOOLEAN NOT NULL DEFAULT false,
    signature_valid BOOLEAN,
    decision TEXT NOT NULL CHECK (decision IN ('allowed', 'blocked')),
    reason_code TEXT NOT NULL,
    reason_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_event_logs_school_created ON scan_event_logs (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_event_logs_target_created ON scan_event_logs (target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_event_logs_reason_code ON scan_event_logs (reason_code);

ALTER TABLE scan_event_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school users can read scan_event_logs" ON scan_event_logs;
CREATE POLICY "school users can read scan_event_logs"
ON scan_event_logs
FOR SELECT
TO authenticated
USING (school_id = my_school_id());

DROP POLICY IF EXISTS "school users can insert scan_event_logs" ON scan_event_logs;
CREATE POLICY "school users can insert scan_event_logs"
ON scan_event_logs
FOR INSERT
TO authenticated
WITH CHECK (school_id = my_school_id());

DROP POLICY IF EXISTS "school admins can delete scan_event_logs" ON scan_event_logs;
CREATE POLICY "school admins can delete scan_event_logs"
ON scan_event_logs
FOR DELETE
TO authenticated
USING (school_id = my_school_id() AND is_school_admin());

-- ============================================
-- GRADING SCHEMES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS grading_schemes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'UNEB',
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    min_score NUMERIC(5,2) NOT NULL,
    max_score NUMERIC(5,2) NOT NULL,
    grade TEXT NOT NULL,
    points INTEGER DEFAULT 0,
    division TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE grading_schemes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users grading_schemes select" ON grading_schemes;
CREATE POLICY "School users grading_schemes select"
ON grading_schemes
FOR SELECT
TO authenticated
USING (school_id = my_school_id());

DROP POLICY IF EXISTS "School users grading_schemes write" ON grading_schemes;
CREATE POLICY "School users grading_schemes write"
ON grading_schemes
FOR ALL
TO authenticated
USING (school_id = my_school_id())
WITH CHECK (school_id = my_school_id());

-- Insert default UNEB grading scheme
INSERT INTO grading_schemes (school_id, name, min_score, max_score, grade, points, division, is_default) VALUES
(NULL, 'UNEB', 80, 100, 'D1', 1, 'Division I', true),
(NULL, 'UNEB', 70, 79, 'D2', 2, 'Division I', false),
(NULL, 'UNEB', 65, 69, 'C3', 3, 'Division II', false),
(NULL, 'UNEB', 60, 64, 'C4', 4, 'Division II', false),
(NULL, 'UNEB', 55, 59, 'C5', 5, 'Division III', false),
(NULL, 'UNEB', 50, 54, 'C6', 6, 'Division III', false),
(NULL, 'UNEB', 45, 49, 'P7', 7, 'Division IV', false),
(NULL, 'UNEB', 40, 44, 'P8', 8, 'Division IV', false),
(NULL, 'UNEB', 0, 39, 'F9', 9, 'Ungraded', false)
ON CONFLICT DO NOTHING;

-- Parent RLS on report_cards
DROP POLICY IF EXISTS "Parents view own children report_cards" ON report_cards;
CREATE POLICY "Parents view own children report_cards"
ON report_cards
FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT ps.student_id
    FROM parent_students ps
    JOIN users u ON u.id = ps.parent_id
    WHERE u.auth_id = auth.uid()
  )
);

-- ============================================================================
-- RLS for tables defined earlier without row-level security
-- These were added in migrations but not backported to schema.sql
-- ============================================================================

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users audit_log select" ON audit_log;
CREATE POLICY "School users audit_log select" ON audit_log FOR SELECT TO authenticated USING (school_id = my_school_id());
DROP POLICY IF EXISTS "School users audit_log insert" ON audit_log;
CREATE POLICY "School users audit_log insert" ON audit_log FOR INSERT TO authenticated WITH CHECK (school_id = my_school_id());

ALTER TABLE homework ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users homework all" ON homework;
CREATE POLICY "School users homework all" ON homework FOR ALL TO authenticated
USING (
  (school_id = my_school_id() AND is_staff_role())
  OR (school_id = my_school_id() AND class_id IS NULL)
  OR class_id IN (SELECT DISTINCT s.class_id FROM students s WHERE s.id IN (SELECT my_student_ids()) AND s.class_id IS NOT NULL)
)
WITH CHECK (school_id = my_school_id() AND is_staff_role());

ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users exams all" ON exams;
CREATE POLICY "School users exams all" ON exams FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

ALTER TABLE exam_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users exam_scores all" ON exam_scores;
CREATE POLICY "School users exam_scores all" ON exam_scores FOR ALL TO authenticated USING (student_id IN (SELECT id FROM students WHERE school_id = my_school_id())) WITH CHECK (student_id IN (SELECT id FROM students WHERE school_id = my_school_id()));

ALTER TABLE dorms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users dorms select" ON dorms;
CREATE POLICY "School users dorms select" ON dorms FOR SELECT TO authenticated USING (school_id = my_school_id());
DROP POLICY IF EXISTS "School admins dorms write" ON dorms;
CREATE POLICY "School admins dorms write" ON dorms FOR ALL TO authenticated USING (school_id = my_school_id() AND (is_school_admin() OR is_school_staff(my_school_id()))) WITH CHECK (school_id = my_school_id() AND (is_school_admin() OR is_school_staff(my_school_id())));

ALTER TABLE dorm_students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users dorm_students all" ON dorm_students;
CREATE POLICY "School users dorm_students all" ON dorm_students FOR ALL TO authenticated USING (dorm_id IN (SELECT id FROM dorms WHERE school_id = my_school_id())) WITH CHECK (dorm_id IN (SELECT id FROM dorms WHERE school_id = my_school_id()));

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users leave_requests all" ON leave_requests;
CREATE POLICY "School users leave_requests all" ON leave_requests FOR ALL TO authenticated USING (school_id = my_school_id() OR EXISTS (SELECT 1 FROM users u WHERE u.id = staff_id AND u.school_id = my_school_id())) WITH CHECK (school_id = my_school_id() OR EXISTS (SELECT 1 FROM users u WHERE u.id = staff_id AND u.school_id = my_school_id()));

ALTER TABLE subject_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users subject_allocations all" ON subject_allocations;
CREATE POLICY "School users subject_allocations all" ON subject_allocations FOR ALL TO authenticated USING (class_id IN (SELECT id FROM classes WHERE school_id = my_school_id())) WITH CHECK (class_id IN (SELECT id FROM classes WHERE school_id = my_school_id()));

ALTER TABLE health_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users health_records all" ON health_records;
CREATE POLICY "School users health_records all" ON health_records FOR ALL TO authenticated USING (student_id IN (SELECT id FROM students WHERE school_id = my_school_id())) WITH CHECK (student_id IN (SELECT id FROM students WHERE school_id = my_school_id()));

ALTER TABLE health_visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users health_visits all" ON health_visits;
CREATE POLICY "School users health_visits all" ON health_visits FOR ALL TO authenticated USING (student_id IN (SELECT id FROM students WHERE school_id = my_school_id())) WITH CHECK (student_id IN (SELECT id FROM students WHERE school_id = my_school_id()));

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users assets all" ON assets;
CREATE POLICY "School users assets all" ON assets FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

ALTER TABLE asset_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users asset_assignments all" ON asset_assignments;
CREATE POLICY "School users asset_assignments all" ON asset_assignments FOR ALL TO authenticated USING (asset_id IN (SELECT id FROM assets WHERE school_id = my_school_id())) WITH CHECK (asset_id IN (SELECT id FROM assets WHERE school_id = my_school_id()));

ALTER TABLE transport_routes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users transport_routes all" ON transport_routes;
CREATE POLICY "School users transport_routes all" ON transport_routes FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

ALTER TABLE transport_students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users transport_students all" ON transport_students;
CREATE POLICY "School users transport_students all" ON transport_students FOR ALL TO authenticated USING (student_id IN (SELECT id FROM students WHERE school_id = my_school_id())) WITH CHECK (student_id IN (SELECT id FROM students WHERE school_id = my_school_id()));

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users budgets all" ON budgets;
CREATE POLICY "School users budgets all" ON budgets FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users expenses all" ON expenses;
CREATE POLICY "School users expenses all" ON expenses FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

ALTER TABLE behavior_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users behavior_logs all" ON behavior_logs;
CREATE POLICY "School users behavior_logs all" ON behavior_logs FOR ALL TO authenticated USING (student_id IN (SELECT id FROM students WHERE school_id = my_school_id())) WITH CHECK (student_id IN (SELECT id FROM students WHERE school_id = my_school_id()));

ALTER TABLE lesson_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School staff lesson_plans all" ON lesson_plans;
CREATE POLICY "School staff lesson_plans all" ON lesson_plans FOR ALL TO authenticated USING (school_id = my_school_id() AND is_school_staff(my_school_id())) WITH CHECK (school_id = my_school_id() AND is_school_staff(my_school_id()));

ALTER TABLE scheme_of_work ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users scheme_of_work all" ON scheme_of_work;
CREATE POLICY "School users scheme_of_work all" ON scheme_of_work FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

ALTER TABLE teacher_timetable ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users teacher_timetable all" ON teacher_timetable;
CREATE POLICY "School users teacher_timetable all" ON teacher_timetable FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM users u WHERE u.id = teacher_timetable.teacher_id AND u.school_id = my_school_id())) WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = teacher_timetable.teacher_id AND u.school_id = my_school_id()));

DROP POLICY IF EXISTS "Parents teacher_timetable select" ON teacher_timetable;
CREATE POLICY "Parents teacher_timetable select" ON teacher_timetable
FOR SELECT TO authenticated
USING (class_id IN (SELECT my_children_class_ids()));

ALTER TABLE dorm_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users dorm_attendance all" ON dorm_attendance;
CREATE POLICY "School users dorm_attendance all" ON dorm_attendance FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

ALTER TABLE homework_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users homework_submissions all" ON homework_submissions;
CREATE POLICY "School users homework_submissions all" ON homework_submissions FOR ALL TO authenticated
USING (
  (school_id = my_school_id() AND is_staff_role())
  OR student_id IN (SELECT my_student_ids())
)
WITH CHECK (school_id = my_school_id() AND is_staff_role());

ALTER TABLE uneb_candidates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users uneb_candidates all" ON uneb_candidates;
CREATE POLICY "School users uneb_candidates all" ON uneb_candidates FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

ALTER TABLE student_promotions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users student_promotions all" ON student_promotions;
CREATE POLICY "School users student_promotions all" ON student_promotions FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

ALTER TABLE payment_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users payment_plans all" ON payment_plans;
CREATE POLICY "School users payment_plans all" ON payment_plans FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

ALTER TABLE payment_plan_installments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users payment_plan_installments all" ON payment_plan_installments;
CREATE POLICY "School users payment_plan_installments all" ON payment_plan_installments FOR ALL TO authenticated USING (plan_id IN (SELECT id FROM payment_plans WHERE school_id = my_school_id())) WITH CHECK (plan_id IN (SELECT id FROM payment_plans WHERE school_id = my_school_id()));

ALTER TABLE leave_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users leave_approvals all" ON leave_approvals;
CREATE POLICY "School users leave_approvals all" ON leave_approvals FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

ALTER TABLE expense_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users expense_approvals all" ON expense_approvals;
CREATE POLICY "School users expense_approvals all" ON expense_approvals FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

ALTER TABLE topic_coverage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users topic_coverage all" ON topic_coverage;
CREATE POLICY "School users topic_coverage all" ON topic_coverage FOR ALL TO authenticated USING (class_id IN (SELECT id FROM classes WHERE school_id = my_school_id())) WITH CHECK (class_id IN (SELECT id FROM classes WHERE school_id = my_school_id()));

-- ============================================
-- INVOICES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    term INTEGER CHECK (term IN (1, 2, 3)) NOT NULL,
    academic_year TEXT NOT NULL,
    total_amount NUMERIC(12,2) NOT NULL,
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    balance NUMERIC(12,2) NOT NULL,
    status TEXT CHECK (status IN ('draft', 'issued', 'paid', 'overdue', 'cancelled')) DEFAULT 'issued',
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_school ON invoices(school_id);
CREATE INDEX IF NOT EXISTS idx_invoices_student ON invoices(student_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users invoices all" ON invoices;
CREATE POLICY "School users invoices all" ON invoices FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- RECEIPTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES fee_payments(id) ON DELETE SET NULL,
    receipt_number TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, receipt_number)
);

CREATE SEQUENCE IF NOT EXISTS receipt_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT 'RCP-' || LPAD(nextval('receipt_number_seq')::TEXT, 6, '0')
$$;

CREATE INDEX IF NOT EXISTS idx_receipts_school ON receipts(school_id);
CREATE INDEX IF NOT EXISTS idx_receipts_student ON receipts(student_id);
CREATE INDEX IF NOT EXISTS idx_receipts_payment ON receipts(payment_id);
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users receipts all" ON receipts;
CREATE POLICY "School users receipts all" ON receipts FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- MODULE CATALOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS module_catalog (
  module_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  annual_price_small NUMERIC(12,2) NOT NULL DEFAULT 0,
  annual_price_medium NUMERIC(12,2) NOT NULL DEFAULT 0,
  annual_price_large NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE module_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read module catalog" ON module_catalog FOR SELECT TO authenticated USING (true);

-- ============================================
-- SCHOOL MODULE ENTITLEMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS school_module_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL REFERENCES module_catalog(module_key) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trial', 'expired', 'canceled', 'pending')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  source TEXT NOT NULL DEFAULT 'purchase',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_school_module_entitlements_school_status ON school_module_entitlements (school_id, status);
CREATE INDEX IF NOT EXISTS idx_school_module_entitlements_module ON school_module_entitlements (module_key);
ALTER TABLE school_module_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School users read own entitlements" ON school_module_entitlements FOR SELECT TO authenticated USING (school_id = my_school_id() OR is_school_admin());
CREATE POLICY "School admins manage entitlements" ON school_module_entitlements FOR ALL TO authenticated USING (school_id = my_school_id() AND is_school_admin()) WITH CHECK (school_id = my_school_id() AND is_school_admin());

-- ============================================
-- SCHOOL MODULE PURCHASES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS school_module_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL REFERENCES module_catalog(module_key) ON DELETE RESTRICT,
  amount_ugx NUMERIC(12,2) NOT NULL DEFAULT 0,
  billing_period TEXT NOT NULL DEFAULT 'annual' CHECK (billing_period IN ('annual')),
  purchase_status TEXT NOT NULL DEFAULT 'pending' CHECK (purchase_status IN ('pending', 'paid', 'failed', 'canceled', 'refunded')),
  payment_provider TEXT,
  payment_reference TEXT,
  purchased_by UUID REFERENCES users(id) ON DELETE SET NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_module_purchases_school_status ON school_module_purchases (school_id, purchase_status);
CREATE INDEX IF NOT EXISTS idx_school_module_purchases_module ON school_module_purchases (module_key);
ALTER TABLE school_module_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School users read own purchases" ON school_module_purchases FOR SELECT TO authenticated USING (school_id = my_school_id() OR is_school_admin());
CREATE POLICY "School admins manage purchases" ON school_module_purchases FOR ALL TO authenticated USING (school_id = my_school_id() AND is_school_admin()) WITH CHECK (school_id = my_school_id() AND is_school_admin());

-- ============================================
-- SUPPORT TICKETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('bug', 'feature_request', 'custom_package', 'onboarding', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School users read own tickets" ON support_tickets FOR SELECT TO authenticated USING (school_id = my_school_id() OR is_school_admin());
CREATE POLICY "School admins create tickets" ON support_tickets FOR INSERT TO authenticated WITH CHECK (school_id = my_school_id());

-- ============================================
-- MOMO DISBURSEMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS momo_disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  parent_phone TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('mtn', 'airtel')),
  amount INTEGER NOT NULL,
  reference TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  external_transaction_id TEXT,
  error_message TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_momo_disbursements_school ON momo_disbursements(school_id);
CREATE INDEX IF NOT EXISTS idx_momo_disbursements_status ON momo_disbursements(status);
ALTER TABLE momo_disbursements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School admins manage disbursements" ON momo_disbursements FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('school_admin', 'admin', 'headmaster', 'bursar'))
);

-- ============================================
-- MODULE HELPER FUNCTIONS
-- ============================================
CREATE OR REPLACE FUNCTION get_module_price_ugx(
  p_module_key TEXT,
  p_size_band TEXT
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
AS $$
  SELECT CASE p_size_band
    WHEN 'large' THEN annual_price_large
    WHEN 'medium' THEN annual_price_medium
    ELSE annual_price_small
  END
  FROM module_catalog
  WHERE module_key = p_module_key
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_module_access_active(
  p_school_id UUID,
  p_module_key TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM school_module_entitlements e
    WHERE e.school_id = p_school_id
      AND e.module_key = p_module_key
      AND e.status IN ('active', 'trial')
      AND e.ends_at >= now()
  );
$$;


-- ============================================================================
-- DRIFT RECONCILIATION: tables defined in migrations/ but missing from this
-- schema file. Added so `supabase db reset` reproduces a complete database.
-- Sources: supabase/migrations/*.sql
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refund_status') THEN
    CREATE TYPE public.refund_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;


CREATE TABLE IF NOT EXISTS public.otps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- One active OTP per phone at a time
  CONSTRAINT otps_unique_phone UNIQUE (phone)
);


CREATE TABLE IF NOT EXISTS public.marketer_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    marketer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
    school_name TEXT NOT NULL,
    contact_name TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    district TEXT,
    status TEXT NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'contacted', 'interested', 'not_interested', 'converted', 'lost')),
    notes TEXT,
    next_follow_up TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS public.marketer_outreach (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    marketer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.marketer_leads(id) ON DELETE SET NULL,
    school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('email', 'sms', 'call', 'whatsapp', 'meeting')),
    recipient_name TEXT,
    recipient_contact TEXT,
    subject TEXT,
    content TEXT,
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'scheduled')),
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS public.marketer_referral_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    marketer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    label TEXT,
    clicks INTEGER NOT NULL DEFAULT 0,
    conversions INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS syllabus_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    syllabus_id UUID NOT NULL REFERENCES syllabus(id) ON DELETE CASCADE,
    term INTEGER NOT NULL CHECK (term IN (1, 2, 3)),
    academic_year TEXT NOT NULL,
    
    -- Timeline specifics
    week_number INTEGER NOT NULL,
    planned_start_date DATE NOT NULL,
    planned_end_date DATE NOT NULL,
    actual_start_date DATE,
    actual_end_date DATE,
    
    -- Progress tracking
    status TEXT CHECK (status IN ('not_started', 'in_progress', 'completed', 'postponed', 'accelerated')) DEFAULT 'not_started',
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    
    -- Teaching metrics
    lessons_planned INTEGER DEFAULT 0,
    lessons_completed INTEGER DEFAULT 0,
    student_comprehension_rating INTEGER CHECK (student_comprehension_rating >= 1 AND student_comprehension_rating <= 5),
    
    -- Notes
    teacher_notes TEXT,
    challenges TEXT,
    adaptations_made TEXT,
    
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(school_id, class_id, subject_id, syllabus_id, term, academic_year, week_number)
);


CREATE TABLE IF NOT EXISTS topic_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    syllabus_id UUID NOT NULL REFERENCES syllabus(id) ON DELETE CASCADE,
    syllabus_timeline_id UUID REFERENCES syllabus_timeline(id) ON DELETE SET NULL,
    
    term INTEGER NOT NULL,
    academic_year TEXT NOT NULL,
    topic TEXT NOT NULL,
    
    -- Performance metrics
    average_score DECIMAL(5, 2),
    student_count INTEGER,
    students_above_75 INTEGER DEFAULT 0,
    students_50_to_75 INTEGER DEFAULT 0,
    students_below_50 INTEGER DEFAULT 0,
    
    -- Mastery levels
    mastery_level TEXT CHECK (mastery_level IN ('beginner', 'developing', 'proficient', 'advanced')) DEFAULT 'developing',
    
    -- Revision needed
    revision_required BOOLEAN DEFAULT false,
    revision_priority TEXT CHECK (revision_priority IN ('low', 'medium', 'high')) DEFAULT 'low',
    
    -- Feedback
    common_misconceptions TEXT,
    differentiation_needed TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS lesson_plan_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    
    name TEXT NOT NULL,
    description TEXT,
    
    -- Template structure (JSON)
    introduction_template TEXT,
    main_content_template TEXT,
    consolidation_template TEXT,
    assessment_template TEXT,
    
    -- Default resources
    default_materials TEXT, -- JSON array
    suggested_duration INTEGER DEFAULT 40, -- minutes
    
    -- AI config
    use_ai_generation BOOLEAN DEFAULT true,
    ai_model TEXT DEFAULT 'openai', -- 'openai', 'claude', 'rules_based'
    
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS auto_planner_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Enable/disable features
    enable_ai_generation BOOLEAN DEFAULT true,
    enable_weekly_distribution BOOLEAN DEFAULT true,
    enable_smart_scheduling BOOLEAN DEFAULT true,
    
    -- Scheduling rules
    lessons_per_week_target INTEGER DEFAULT 2,
    account_for_holidays BOOLEAN DEFAULT true,
    account_for_exams BOOLEAN DEFAULT true,
    
    -- AI preferences
    ai_provider TEXT CHECK (ai_provider IN ('openai', 'claude', 'rules_based')) DEFAULT 'rules_based',
    ai_temperature DECIMAL(3, 2) DEFAULT 0.7, -- 0.0 to 1.0
    
    -- Default lesson structure
    default_lesson_duration INTEGER DEFAULT 40, -- minutes
    include_homework BOOLEAN DEFAULT true,
    include_assessment BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(school_id)
);


CREATE TABLE IF NOT EXISTS lesson_plan_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    syllabus_id UUID REFERENCES syllabus(id) ON DELETE SET NULL,
    
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    term INTEGER NOT NULL,
    academic_year TEXT NOT NULL,
    
    -- Generation details
    topic_count INTEGER DEFAULT 0,
    lessons_generated INTEGER DEFAULT 0,
    
    -- Metadata
    generation_source TEXT CHECK (generation_source IN ('auto', 'ai_enhanced', 'manual_with_suggestions')) DEFAULT 'auto',
    ai_used BOOLEAN DEFAULT false,
    ai_model_used TEXT,
    
    -- Generated lesson plan IDs (JSON array of UUIDs)
    generated_lesson_ids TEXT,
    
    -- Status
    status TEXT CHECK (status IN ('pending', 'completed', 'cancelled')) DEFAULT 'pending',
    error_message TEXT,
    
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);


CREATE TABLE IF NOT EXISTS learning_objectives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    
    topic TEXT NOT NULL,
    objective TEXT NOT NULL,
    
    -- Bloom's taxonomy level
    bloom_level TEXT CHECK (bloom_level IN ('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create')) DEFAULT 'understand',
    
    -- Competencies
    competency TEXT,
    cross_cutting_theme TEXT,
    
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS teaching_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    
    topic TEXT NOT NULL,
    resource_name TEXT NOT NULL,
    resource_type TEXT CHECK (resource_type IN ('video', 'image', 'document', 'link', 'file', 'simulation')) NOT NULL,
    
    -- URL or file reference
    resource_url TEXT,
    resource_file_path TEXT,
    
    -- Metadata
    description TEXT,
    difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    duration_minutes INTEGER,
    
    -- Quality rating
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    used_count INTEGER DEFAULT 0,
    
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS bug_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    page_url TEXT,
    screenshot_url TEXT,
    browser_info TEXT,
    status TEXT CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')) DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS co_curricular_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  activity_name TEXT NOT NULL,
  period TEXT, -- e.g., "2023 Q1"
  score NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


CREATE TABLE IF NOT EXISTS error_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID,
  user_id TEXT,
  user_role TEXT,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  page_url TEXT,
  browser_info TEXT,
  severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS feedbacks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  user_id TEXT,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bug', 'feature_request', 'feedback', 'custom_package')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  page_url TEXT,
  admin_response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);


CREATE TABLE IF NOT EXISTS public.library_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    book_id UUID REFERENCES public.library_books(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    returned_date DATE,
    status TEXT NOT NULL CHECK (status IN ('issued', 'returned', 'overdue')) DEFAULT 'issued',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS plan_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan TEXT NOT NULL CHECK (plan IN ('starter', 'growth', 'enterprise', 'lifetime')),
    feature_key TEXT NOT NULL,
    feature_name TEXT NOT NULL,
    included BOOLEAN DEFAULT TRUE,
    limit_value INTEGER,
    unit TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  fee_payment_id UUID NOT NULL REFERENCES fee_payments(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  reason TEXT,
  status refund_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


CREATE TABLE IF NOT EXISTS report_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_type TEXT NOT NULL DEFAULT 'report_card',
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    event_type TEXT NOT NULL CHECK (event_type IN (
        'login_failed', 'login_success', 'logout', 
        'password_reset_requested', 'password_reset_completed',
        'account_locked', 'account_unlocked', 'password_reset_failed',
        'password_reset_reused', 'password_reset_failed_expired'
    )),
    ip_address TEXT,
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS student_conduct (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  term INTEGER NOT NULL,
  academic_year TEXT NOT NULL,
  punctuality INTEGER DEFAULT 5 CHECK (punctuality BETWEEN 1 AND 5),
  neatness INTEGER DEFAULT 5 CHECK (neatness BETWEEN 1 AND 5),
  honesty INTEGER DEFAULT 5 CHECK (honesty BETWEEN 1 AND 5),
  discipline INTEGER DEFAULT 5 CHECK (discipline BETWEEN 1 AND 5),
  respect INTEGER DEFAULT 5 CHECK (respect BETWEEN 1 AND 5),
  leadership INTEGER DEFAULT 5 CHECK (leadership BETWEEN 1 AND 5),
  cooperation INTEGER DEFAULT 5 CHECK (cooperation BETWEEN 1 AND 5),
  class_teacher_remark TEXT,
  head_teacher_remark TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, term, academic_year)
);


CREATE TABLE IF NOT EXISTS subscription_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    plan TEXT NOT NULL CHECK (plan IN ('starter', 'growth', 'enterprise', 'lifetime')),
    amount_paid INTEGER NOT NULL,
    currency TEXT DEFAULT 'UGX',
    payment_method TEXT CHECK (payment_method IN ('momo', 'bank', 'cash', 'card', 'paypal')),
    transaction_id TEXT,
    payment_status TEXT CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    payment_for_term TEXT,
    student_count INTEGER,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS timetable_constraints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
    day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 7),
    slot_id UUID REFERENCES timetable_slots(id) ON DELETE CASCADE,
    constraint_type TEXT CHECK (constraint_type IN ('unavailable', 'preferred')) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_otps_phone ON public.otps (phone);
CREATE INDEX IF NOT EXISTS idx_otps_expires ON public.otps (expires_at);
CREATE INDEX IF NOT EXISTS idx_marketer_leads_marketer ON public.marketer_leads (marketer_id);
CREATE INDEX IF NOT EXISTS idx_marketer_leads_status ON public.marketer_leads (status);
CREATE INDEX IF NOT EXISTS idx_marketer_leads_created ON public.marketer_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketer_outreach_marketer ON public.marketer_outreach (marketer_id);
CREATE INDEX IF NOT EXISTS idx_marketer_outreach_lead ON public.marketer_outreach (lead_id);
CREATE INDEX IF NOT EXISTS idx_marketer_outreach_sent ON public.marketer_outreach (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketer_referral_codes_marketer ON public.marketer_referral_codes (marketer_id);

ALTER TABLE public.otps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can request OTP" ON public.otps;
CREATE POLICY "Anyone can request OTP" ON public.otps FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Service role can manage OTPs" ON public.otps;
CREATE POLICY "Service role can manage OTPs" ON public.otps FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE public.marketer_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketer_outreach ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketer_referral_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS marketer_leads_self ON public.marketer_leads;
CREATE POLICY marketer_leads_self ON public.marketer_leads FOR ALL USING (marketer_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid() AND role = 'marketer'));
DROP POLICY IF EXISTS marketer_leads_admin ON public.marketer_leads;
CREATE POLICY marketer_leads_admin ON public.marketer_leads FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'super_admin'));
DROP POLICY IF EXISTS marketer_outreach_self ON public.marketer_outreach;
CREATE POLICY marketer_outreach_self ON public.marketer_outreach FOR ALL USING (marketer_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid() AND role = 'marketer'));
DROP POLICY IF EXISTS marketer_outreach_admin ON public.marketer_outreach;
CREATE POLICY marketer_outreach_admin ON public.marketer_outreach FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'super_admin'));
DROP POLICY IF EXISTS marketer_referral_codes_self ON public.marketer_referral_codes;
CREATE POLICY marketer_referral_codes_self ON public.marketer_referral_codes FOR ALL USING (marketer_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid() AND role = 'marketer'));
DROP POLICY IF EXISTS marketer_referral_codes_admin ON public.marketer_referral_codes;
CREATE POLICY marketer_referral_codes_admin ON public.marketer_referral_codes FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'super_admin'));

ALTER TABLE syllabus_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_plan_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_planner_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_plan_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE teaching_resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School staff manage syllabus_timeline" ON syllabus_timeline;
CREATE POLICY "School staff manage syllabus_timeline" ON syllabus_timeline FOR ALL USING (school_id IN (SELECT my_school_id()));
DROP POLICY IF EXISTS "School staff view topic_performance" ON topic_performance;
CREATE POLICY "School staff view topic_performance" ON topic_performance FOR SELECT USING (school_id IN (SELECT my_school_id()));
DROP POLICY IF EXISTS "School staff manage templates" ON lesson_plan_templates;
CREATE POLICY "School staff manage templates" ON lesson_plan_templates FOR ALL USING (school_id IN (SELECT my_school_id()));
DROP POLICY IF EXISTS "School staff manage planner_config" ON auto_planner_config;
CREATE POLICY "School staff manage planner_config" ON auto_planner_config FOR ALL USING (school_id IN (SELECT my_school_id()));
DROP POLICY IF EXISTS "School staff manage generations" ON lesson_plan_generations;
CREATE POLICY "School staff manage generations" ON lesson_plan_generations FOR ALL USING (school_id IN (SELECT my_school_id()));
DROP POLICY IF EXISTS "School staff manage objectives" ON learning_objectives;
CREATE POLICY "School staff manage objectives" ON learning_objectives FOR ALL USING (school_id IN (SELECT my_school_id()));
DROP POLICY IF EXISTS "School staff manage resources" ON teaching_resources;
CREATE POLICY "School staff manage resources" ON teaching_resources FOR ALL USING (school_id IN (SELECT my_school_id()));

ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Bug reports insert" ON bug_reports;
CREATE POLICY "Bug reports insert" ON bug_reports FOR INSERT TO authenticated WITH CHECK (school_id = my_school_id());
DROP POLICY IF EXISTS "Bug reports select" ON bug_reports;
CREATE POLICY "Bug reports select" ON bug_reports FOR SELECT TO authenticated USING (school_id = my_school_id());
DROP POLICY IF EXISTS "Bug reports admin" ON bug_reports;
CREATE POLICY "Bug reports admin" ON bug_reports FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'super_admin'));

ALTER TABLE co_curricular_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users co_curricular all" ON co_curricular_activities;
CREATE POLICY "School users co_curricular all" ON co_curricular_activities FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "error_logs_select" ON error_logs;
CREATE POLICY "error_logs_select" ON error_logs FOR SELECT TO authenticated USING (school_id = my_school_id());
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "feedbacks_school" ON feedbacks;
CREATE POLICY "feedbacks_school" ON feedbacks FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());
ALTER TABLE public.library_issues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "library_issues_all" ON public.library_issues;
CREATE POLICY "library_issues_all" ON public.library_issues FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());
ALTER TABLE plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Schools can view own plan features" ON plan_features;
CREATE POLICY "Schools can view own plan features" ON plan_features FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Schools can view own subscription history" ON subscription_history;
CREATE POLICY "Schools can view own subscription history" ON subscription_history FOR SELECT TO authenticated USING (school_id = my_school_id());
ALTER TABLE refund_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS refund_select ON refund_requests;
CREATE POLICY refund_select ON refund_requests FOR SELECT USING (school_id = my_school_id());
DROP POLICY IF EXISTS refund_insert ON refund_requests;
CREATE POLICY refund_insert ON refund_requests FOR INSERT WITH CHECK (school_id = my_school_id());
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "report_templates_school" ON report_templates;
CREATE POLICY "report_templates_school" ON report_templates FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "security_events_all" ON security_events;
CREATE POLICY "security_events_all" ON security_events FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "security_events_insert" ON security_events;
CREATE POLICY "security_events_insert" ON security_events FOR INSERT TO authenticated WITH CHECK (true);
ALTER TABLE student_conduct ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "student_conduct_school" ON student_conduct;
CREATE POLICY "student_conduct_school" ON student_conduct FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());
ALTER TABLE timetable_constraints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS timetable_constraints_school ON timetable_constraints;
CREATE POLICY timetable_constraints_school ON timetable_constraints FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());


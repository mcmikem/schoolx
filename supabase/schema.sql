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
CREATE TABLE schools (
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
    subscription_plan TEXT CHECK (subscription_plan IN ('free', 'basic', 'premium')) DEFAULT 'free',
    subscription_status TEXT CHECK (subscription_status IN ('active', 'expired', 'trial')) DEFAULT 'trial',
    trial_ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. USERS TABLE (All user types)
-- ============================================
CREATE TABLE users (
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
CREATE TABLE academic_years (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    year TEXT NOT NULL, -- e.g. "2026"
    is_current BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. TERMS
-- ============================================
CREATE TABLE terms (
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
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. "P.5A", "S.2B"
    level TEXT NOT NULL, -- e.g. "P.5", "S.2"
    stream TEXT, -- e.g. "A", "B", "Science", "Arts"
    class_teacher_id UUID REFERENCES users(id),
    max_students INTEGER DEFAULT 60,
    academic_year TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. SUBJECTS
-- ============================================
CREATE TABLE subjects (
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
CREATE TABLE students (
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
CREATE TABLE teacher_subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. ATTENDANCE
-- ============================================
CREATE TABLE attendance (
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
CREATE TABLE grades (
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, subject_id, assessment_type, term, academic_year)
);

-- ============================================
-- 11. FEE STRUCTURE
-- ============================================
CREATE TABLE fee_structure (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. "Tuition", "Development", "Exam Fee"
    amount NUMERIC(12,2) NOT NULL,
    term INTEGER CHECK (term IN (1, 2, 3)) NOT NULL,
    academic_year TEXT NOT NULL,
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 12. FEE PAYMENTS
-- ============================================
CREATE TABLE fee_payments (
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
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT CHECK (event_type IN ('exam', 'meeting', 'holiday', 'event', 'academic')) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 14. MESSAGES (SMS Log)
-- ============================================
CREATE TABLE messages (
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
CREATE TABLE school_settings (
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
CREATE TABLE audit_log (
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

CREATE INDEX idx_audit_school ON audit_log(school_id);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_module ON audit_log(module);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- ============================================
-- 17. PARENT-STUDENT LINK
-- ============================================
CREATE TABLE parent_students (
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

-- Enable RLS on all tables
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structure ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_students ENABLE ROW LEVEL SECURITY;

-- Super Admin can see everything
CREATE POLICY "Super admin full access" ON schools
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.auth_id = auth.uid()
            AND users.role = 'super_admin'
        )
    );

-- School users can only see their own school data
CREATE POLICY "School users access own school" ON students
    FOR ALL USING (
        school_id IN (
            SELECT school_id FROM users WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "School users access own school classes" ON classes
    FOR ALL USING (
        school_id IN (
            SELECT school_id FROM users WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "School users access own school attendance" ON attendance
    FOR ALL USING (
        class_id IN (
            SELECT id FROM classes WHERE school_id IN (
                SELECT school_id FROM users WHERE auth_id = auth.uid()
            )
        )
    );

CREATE POLICY "School users access own school grades" ON grades
    FOR ALL USING (
        class_id IN (
            SELECT id FROM classes WHERE school_id IN (
                SELECT school_id FROM users WHERE auth_id = auth.uid()
            )
        )
    );

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_users_auth_id ON users(auth_id);
CREATE INDEX idx_users_school_id ON users(school_id);
CREATE INDEX idx_students_school_id ON students(school_id);
CREATE INDEX idx_students_class_id ON students(class_id);
CREATE INDEX idx_attendance_student_id ON attendance(student_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_grades_student_id ON grades(student_id);
CREATE INDEX idx_grades_subject_id ON grades(subject_id);
CREATE INDEX idx_fee_payments_student_id ON fee_payments(student_id);
CREATE INDEX idx_classes_school_id ON classes(school_id);

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

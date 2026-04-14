-- ============================================
-- OMUTO - FIXED MIGRATION ORDER
-- Run in Supabase SQL Editor
-- ============================================

-- 1. FIRST: Drop any existing fee_payments if it references non-existent table
DROP TABLE IF EXISTS fee_payments CASCADE;
DROP TABLE IF EXISTS student_fee_terms CASCADE;
DROP TABLE IF EXISTS fee_term_lines CASCADE;
DROP TABLE IF EXISTS fee_terms CASCADE;
DROP TABLE IF EXISTS activity_comments CASCADE;
DROP TABLE IF EXISTS academic_terms CASCADE;
DROP TABLE IF EXISTS student_enrollments CASCADE;

-- 2. STUDENT ENROLLMENTS
CREATE TABLE student_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE INDEX idx_enrollment_student ON student_enrollments(student_id);
CREATE INDEX idx_enrollment_class ON student_enrollments(class_id);
CREATE INDEX idx_enrollment_year ON student_enrollments(academic_year);
CREATE INDEX idx_enrollment_state ON student_enrollments(state);

ALTER TABLE student_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY student_enrollments_select ON student_enrollments FOR SELECT USING (true);
CREATE POLICY student_enrollments_insert ON student_enrollments FOR INSERT WITH CHECK (auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY student_enrollments_update ON student_enrollments FOR UPDATE USING (auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY student_enrollments_delete ON student_enrollments FOR DELETE USING (auth.role() IN ('authenticated', 'service_role'));

-- 3. ACADEMIC TERMS
CREATE TABLE academic_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    term_number INTEGER NOT NULL CHECK (term_number >= 1 AND term_number <= 4),
    academic_year VARCHAR(20) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_current BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, academic_year, term_number)
);

CREATE INDEX idx_academic_terms_school ON academic_terms(school_id);
CREATE INDEX idx_academic_terms_year ON academic_terms(academic_year);

ALTER TABLE academic_terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY academic_terms_select ON academic_terms FOR SELECT USING (true);
CREATE POLICY academic_terms_insert ON academic_terms FOR INSERT WITH CHECK (auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY academic_terms_update ON academic_terms FOR UPDATE USING (auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY academic_terms_delete ON academic_terms FOR DELETE USING (auth.role() = 'service_role');

-- 4. FEE TERMS (must come BEFORE fee_term_lines and student_fee_terms)
CREATE TABLE fee_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL,
    description TEXT,
    term_type VARCHAR(20) DEFAULT 'installments' CHECK (term_type IN ('fixed_days', 'fixed_date', 'installments')),
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

CREATE INDEX idx_fee_terms_school ON fee_terms(school_id);
CREATE INDEX idx_fee_terms_year ON fee_terms(academic_year);

ALTER TABLE fee_terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY fee_terms_select ON fee_terms FOR SELECT USING (true);
CREATE POLICY fee_terms_insert ON fee_terms FOR INSERT WITH CHECK (auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY fee_terms_update ON fee_terms FOR UPDATE USING (auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY fee_terms_delete ON fee_terms FOR DELETE USING (auth.role() = 'service_role');

-- 5. FEE TERM LINES (depends on fee_terms)
CREATE TABLE fee_term_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    term_id UUID NOT NULL REFERENCES fee_terms(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,
    due_days INTEGER,
    due_date DATE,
    amount_percentage DECIMAL(5, 2) NOT NULL CHECK (amount_percentage > 0 AND amount_percentage <= 100),
    amount DECIMAL(12, 2),
    is_optional BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fee_term_lines_term ON fee_term_lines(term_id);

ALTER TABLE fee_term_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY fee_term_lines_select ON fee_term_lines FOR SELECT USING (true);
CREATE POLICY fee_term_lines_insert ON fee_term_lines FOR INSERT WITH CHECK (auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY fee_term_lines_update ON fee_term_lines FOR UPDATE USING (auth.role() IN ('authenticated', 'service_role'));

-- 6. STUDENT FEE TERMS (depends on fee_terms)
CREATE TABLE student_fee_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE INDEX idx_student_fee_terms_student ON student_fee_terms(student_id);

ALTER TABLE student_fee_terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY student_fee_terms_select ON student_fee_terms FOR SELECT USING (true);
CREATE POLICY student_fee_terms_insert ON student_fee_terms FOR INSERT WITH CHECK (auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY student_fee_terms_update ON student_fee_terms FOR UPDATE USING (auth.role() IN ('authenticated', 'service_role'));

-- 7. FEE PAYMENTS (depends on student_fee_terms - last!)
CREATE TABLE fee_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_fee_term_id UUID NOT NULL REFERENCES student_fee_terms(id) ON DELETE CASCADE,
    installment_number INTEGER,
    amount DECIMAL(12, 2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method VARCHAR(50),
    transaction_reference VARCHAR(100),
    notes TEXT,
    recorded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fee_payments_student_term ON fee_payments(student_fee_term_id);

ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY fee_payments_select ON fee_payments FOR SELECT USING (true);
CREATE POLICY fee_payments_insert ON fee_payments FOR INSERT WITH CHECK (auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY fee_payments_update ON fee_payments FOR UPDATE USING (auth.role() IN ('authenticated', 'service_role'));

-- 8. ACTIVITY COMMENTS (no dependencies)
CREATE TABLE activity_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE INDEX idx_activity_comments_entity ON activity_comments(entity_type, entity_id);
CREATE INDEX idx_activity_comments_author ON activity_comments(author_id);
CREATE INDEX idx_activity_comments_parent ON activity_comments(parent_id);

ALTER TABLE activity_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY activity_comments_select ON activity_comments FOR SELECT USING (is_internal = false OR auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY activity_comments_insert ON activity_comments FOR INSERT WITH CHECK (author_id IS NOT NULL OR auth.role() = 'service_role');
CREATE POLICY activity_comments_update ON activity_comments FOR UPDATE USING (author_id = auth.uid() OR auth.role() IN ('service_role', 'school_admin', 'headmaster'));

-- 9. FUNCTION FOR FEE TERM CALCULATION (must be before trigger)
CREATE OR REPLACE FUNCTION calculate_fee_term_amounts()
RETURNS TRIGGER AS $$
DECLARE total DECIMAL(12, 2);
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        SELECT ft.total_amount INTO total FROM fee_terms ft WHERE ft.id = NEW.term_id;
        NEW.amount = (total * NEW.amount_percentage / 100);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_fee_term_line_amount
    BEFORE INSERT OR UPDATE ON fee_term_lines
    FOR EACH ROW EXECUTE FUNCTION calculate_fee_term_amounts();

-- 10. FUNCTION FOR CURRENT TERM
CREATE OR REPLACE FUNCTION set_current_term(p_term_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE academic_terms SET is_current = false 
    WHERE school_id = (SELECT school_id FROM academic_terms WHERE id = p_term_id);
    UPDATE academic_terms SET is_current = true WHERE id = p_term_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VERIFY: Run this to see all tables
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' ORDER BY table_name;
-- ============================================
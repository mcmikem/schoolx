-- Fee Payment Terms with Installments
-- Similar to OpenEduCat's op_fees_terms model

-- Fee Terms: Main definition of payment structure
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

-- Fee Term Lines: Individual installments with due dates and percentages
CREATE TABLE IF NOT EXISTS fee_term_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    term_id UUID NOT NULL REFERENCES fee_terms(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,
    due_days INTEGER,  -- Days from term start
    due_date DATE,     -- Or specific date
    amount_percentage DECIMAL(5, 2) NOT NULL CHECK (amount_percentage > 0 AND amount_percentage <= 100),
    amount DECIMAL(12, 2),  -- Calculated amount
    is_optional BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student Fee Term Assignments: Link students to specific fee terms
CREATE TABLE IF NOT EXISTS student_fee_terms (
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

-- Payment Tracking: Individual payments against fee terms
CREATE TABLE IF NOT EXISTS fee_payments (
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fee_terms_school ON fee_terms(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_terms_year ON fee_terms(academic_year);
CREATE INDEX IF NOT EXISTS idx_fee_term_lines_term ON fee_term_lines(term_id);
CREATE INDEX IF NOT EXISTS idx_student_fee_terms_student ON student_fee_terms(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_student_term ON fee_payments(student_fee_term_id);

-- Triggers for updated_at
CREATE TRIGGER set_fee_terms_updated
    BEFORE UPDATE ON fee_terms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_student_fee_terms_updated
    BEFORE UPDATE ON student_fee_terms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE fee_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_term_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_fee_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (simplified - should be more restrictive in production)
CREATE POLICY fee_terms_select ON fee_terms FOR SELECT USING (true);
CREATE POLICY fee_terms_insert ON fee_terms FOR INSERT WITH CHECK (auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY fee_terms_update ON fee_terms FOR UPDATE USING (auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY fee_terms_delete ON fee_terms FOR DELETE USING (auth.role() = 'service_role');

CREATE POLICY fee_term_lines_select ON fee_term_lines FOR SELECT USING (true);
CREATE POLICY fee_term_lines_insert ON fee_term_lines FOR INSERT WITH CHECK (auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY fee_term_lines_update ON fee_term_lines FOR UPDATE USING (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY student_fee_terms_select ON student_fee_terms FOR SELECT USING (true);
CREATE POLICY student_fee_terms_insert ON student_fee_terms FOR INSERT WITH CHECK (auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY student_fee_terms_update ON student_fee_terms FOR UPDATE USING (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY fee_payments_select ON fee_payments FOR SELECT USING (true);
CREATE POLICY fee_payments_insert ON fee_payments FOR INSERT WITH CHECK (auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY fee_payments_update ON fee_payments FOR UPDATE USING (auth.role() IN ('authenticated', 'service_role'));

-- Function to calculate fee term lines amounts from percentage
CREATE OR REPLACE FUNCTION calculate_fee_term_amounts()
RETURNS TRIGGER AS $$
DECLARE
    total DECIMAL(12, 2);
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        SELECT ft.total_amount INTO total 
        FROM fee_terms ft 
        WHERE ft.id = NEW.term_id;
        
        NEW.amount = (total * NEW.amount_percentage / 100);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_fee_term_line_amount
    BEFORE INSERT OR UPDATE ON fee_term_lines
    FOR EACH ROW
    EXECUTE FUNCTION calculate_fee_term_amounts();

COMMENT ON TABLE fee_terms IS 'Fee payment terms defining installment structure';
COMMENT ON TABLE fee_term_lines IS 'Individual installments with due dates and amounts';
COMMENT ON TABLE student_fee_terms IS 'Student-specific fee term assignments with balances';
COMMENT ON TABLE fee_payments IS 'Individual payments against fee terms';
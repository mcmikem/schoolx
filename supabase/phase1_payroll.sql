-- ============================================
-- STAFF SALARIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS staff_salaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- ============================================
-- SALARY PAYMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS salary_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
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

-- ============================================
-- STAFF PERFORMANCE REVIEWS
-- ============================================
CREATE TABLE IF NOT EXISTS staff_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- RLS POLICIES
ALTER TABLE staff_salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_reviews ENABLE ROW LEVEL SECURITY;

-- Admins can manage everything in their school
CREATE POLICY "Admins can manage staff salaries" ON staff_salaries
    FOR ALL USING (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid() AND role IN ('school_admin', 'super_admin')));

CREATE POLICY "Admins can manage salary payments" ON salary_payments
    FOR ALL USING (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid() AND role IN ('school_admin', 'super_admin')));

CREATE POLICY "Admins can manage staff reviews" ON staff_reviews
    FOR ALL USING (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid() AND role IN ('school_admin', 'super_admin')));

-- Staff can view their own salaries/payments/reviews
CREATE POLICY "Staff can view their own salary" ON staff_salaries
    FOR SELECT USING (staff_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Staff can view their own payments" ON salary_payments
    FOR SELECT USING (staff_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Staff can view their own reviews" ON staff_reviews
    FOR SELECT USING (staff_id IN (SELECT id FROM users WHERE auth_id = auth.uid() AND status = 'shared'));

-- Migration: Create missing tables (timetable_slots, staff_reviews, leave_requests)
-- and apply RLS policies using my_school_id()

-- ─── timetable_slots ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS timetable_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_lesson BOOLEAN DEFAULT true,
    order_number INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS timetable_constraints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
    day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 7),
    slot_id UUID REFERENCES timetable_slots(id) ON DELETE CASCADE,
    constraint_type TEXT CHECK (constraint_type IN ('unavailable', 'preferred')) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE timetable_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_constraints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage timetable slots" ON timetable_slots;
DROP POLICY IF EXISTS "School users can view timetable slots" ON timetable_slots;
DROP POLICY IF EXISTS timetable_slots_school ON timetable_slots;

CREATE POLICY timetable_slots_school ON timetable_slots
  FOR ALL
  USING  (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());

DROP POLICY IF EXISTS timetable_constraints_school ON timetable_constraints;

CREATE POLICY timetable_constraints_school ON timetable_constraints
  FOR ALL
  USING  (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());

-- ─── staff_salaries & staff_reviews ──────────────────────────────────────────
-- Note: academic_years table must exist
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

CREATE TABLE IF NOT EXISTS salary_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

ALTER TABLE staff_salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage staff salaries" ON staff_salaries;
DROP POLICY IF EXISTS "Staff can view their own salary" ON staff_salaries;
DROP POLICY IF EXISTS staff_salaries_school ON staff_salaries;

CREATE POLICY staff_salaries_school ON staff_salaries
  FOR ALL
  USING  (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());

DROP POLICY IF EXISTS "Admins can manage salary payments" ON salary_payments;
DROP POLICY IF EXISTS "Staff can view their own payments" ON salary_payments;
DROP POLICY IF EXISTS salary_payments_school ON salary_payments;

CREATE POLICY salary_payments_school ON salary_payments
  FOR ALL
  USING  (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());

DROP POLICY IF EXISTS "Admins can manage staff reviews" ON staff_reviews;
DROP POLICY IF EXISTS "Staff can view their own reviews" ON staff_reviews;
DROP POLICY IF EXISTS staff_reviews_school ON staff_reviews;

CREATE POLICY staff_reviews_school ON staff_reviews
  FOR ALL
  USING  (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());

-- ─── leave_requests RLS fix (table already exists in schema) ─────────────────
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leave_requests_school ON leave_requests;
DROP POLICY IF EXISTS "Demo leave_requests read anon" ON leave_requests;

CREATE POLICY leave_requests_school ON leave_requests
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = leave_requests.staff_id
      AND u.school_id = my_school_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = leave_requests.staff_id
      AND u.school_id = my_school_id()
  ));

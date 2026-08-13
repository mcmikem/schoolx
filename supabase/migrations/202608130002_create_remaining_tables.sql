-- ============================================================
-- 202608130002_create_remaining_tables.sql
-- Creates tables that exist in supabase/schema.sql and are
-- referenced by the app but were missing from the production
-- database (gucxpmgwvnbqykevucbi).
--
-- Scope (from students-section dependency map):
--   canteen_items, canteen_sales, dropout_interventions,
--   grading_schemes, lesson_plan_generations, notice_acknowledgments,
--   payroll_deductions, payroll_records, payroll_summaries,
--   promotion_history, receipts, sms_quota, sms_usage, staff,
--   syllabus_timeline, auto_planner_config, payments
-- Plus the missing `increment_sms_usage` RPC.
--
-- NOT created here:
--   * grading_scales  - never defined anywhere; the real grading
--                       table is `grading_schemes`. GoLiveGate.tsx
--                       was fixed to query grading_schemes instead.
--   * exchange_rates etc. of the disabled 202606270001 migration.
-- ============================================================

-- ============================================
-- PAYMENTS (manual subscription invoices)
-- Modelled on subscription_payments; used by
-- src/app/api/payment/invoices/route.ts (admin-only billing).
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    plan TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    currency TEXT DEFAULT 'UGX',
    provider TEXT NOT NULL DEFAULT 'manual',
    transaction_id TEXT,
    payment_status TEXT NOT NULL DEFAULT 'pending',
    invoice_url TEXT,
    receipt_url TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_school ON payments(school_id);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users payments all" ON payments;
CREATE POLICY "School users payments all" ON payments FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- CANTEEN ITEMS
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
CREATE INDEX IF NOT EXISTS idx_canteen_items_school ON canteen_items(school_id);
ALTER TABLE canteen_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users canteen_items all" ON canteen_items;
CREATE POLICY "School users canteen_items all" ON canteen_items FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- CANTEEN SALES
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
CREATE INDEX IF NOT EXISTS idx_canteen_sales_school ON canteen_sales(school_id);
ALTER TABLE canteen_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School users canteen_sales all" ON canteen_sales;
CREATE POLICY "School users canteen_sales all" ON canteen_sales FOR ALL TO authenticated USING (school_id = my_school_id()) WITH CHECK (school_id = my_school_id());

-- ============================================
-- DROPOUT INTERVENTIONS
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
-- GRADING SCHEMES
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

-- Insert default UNEB grading scheme for existing schools
-- (schema.sql seeded a NULL school_id which violates NOT NULL)
INSERT INTO grading_schemes (school_id, name, min_score, max_score, grade, points, division, is_default)
SELECT s.id, 'UNEB', 80, 100, 'D1', 1, 'Division I', true FROM schools s
ON CONFLICT DO NOTHING;
INSERT INTO grading_schemes (school_id, name, min_score, max_score, grade, points, division, is_default)
SELECT s.id, 'UNEB', 70, 79, 'D2', 2, 'Division I', false FROM schools s
ON CONFLICT DO NOTHING;
INSERT INTO grading_schemes (school_id, name, min_score, max_score, grade, points, division, is_default)
SELECT s.id, 'UNEB', 65, 69, 'C3', 3, 'Division II', false FROM schools s
ON CONFLICT DO NOTHING;
INSERT INTO grading_schemes (school_id, name, min_score, max_score, grade, points, division, is_default)
SELECT s.id, 'UNEB', 60, 64, 'C4', 4, 'Division II', false FROM schools s
ON CONFLICT DO NOTHING;
INSERT INTO grading_schemes (school_id, name, min_score, max_score, grade, points, division, is_default)
SELECT s.id, 'UNEB', 55, 59, 'C5', 5, 'Division III', false FROM schools s
ON CONFLICT DO NOTHING;
INSERT INTO grading_schemes (school_id, name, min_score, max_score, grade, points, division, is_default)
SELECT s.id, 'UNEB', 50, 54, 'C6', 6, 'Division III', false FROM schools s
ON CONFLICT DO NOTHING;
INSERT INTO grading_schemes (school_id, name, min_score, max_score, grade, points, division, is_default)
SELECT s.id, 'UNEB', 45, 49, 'P7', 7, 'Division IV', false FROM schools s
ON CONFLICT DO NOTHING;
INSERT INTO grading_schemes (school_id, name, min_score, max_score, grade, points, division, is_default)
SELECT s.id, 'UNEB', 40, 44, 'P8', 8, 'Division IV', false FROM schools s
ON CONFLICT DO NOTHING;
INSERT INTO grading_schemes (school_id, name, min_score, max_score, grade, points, division, is_default)
SELECT s.id, 'UNEB', 0, 39, 'F9', 9, 'Ungraded', false FROM schools s
ON CONFLICT DO NOTHING;

-- ============================================
-- LESSON PLAN GENERATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS lesson_plan_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    syllabus_id UUID REFERENCES syllabus(id) ON DELETE SET NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    term INTEGER NOT NULL,
    academic_year TEXT NOT NULL,
    topic_count INTEGER DEFAULT 0,
    lessons_generated INTEGER DEFAULT 0,
    generation_source TEXT CHECK (generation_source IN ('auto', 'ai_enhanced', 'manual_with_suggestions')) DEFAULT 'auto',
    ai_used BOOLEAN DEFAULT false,
    ai_model_used TEXT,
    generated_lesson_ids TEXT,
    status TEXT CHECK (status IN ('pending', 'completed', 'cancelled')) DEFAULT 'pending',
    error_message TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
ALTER TABLE lesson_plan_generations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School staff manage generations" ON lesson_plan_generations;
CREATE POLICY "School staff manage generations" ON lesson_plan_generations FOR ALL USING (school_id IN (SELECT my_school_id()));

-- ============================================
-- NOTICE ACKNOWLEDGMENTS
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
-- Read: any school user may view acknowledgments for their school's notices.
-- Write: only the acknowledging user may insert/update their own acknowledgment.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'School users notice_acknowledgments read'
      AND tablename = 'notice_acknowledgments'
  ) THEN
    CREATE POLICY "School users notice_acknowledgments read"
    ON notice_acknowledgments
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM notices
        WHERE notices.id = notice_acknowledgments.notice_id
          AND notices.school_id = my_school_id()
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users acknowledge own notices'
      AND tablename = 'notice_acknowledgments'
  ) THEN
    CREATE POLICY "Users acknowledge own notices"
    ON notice_acknowledgments
    FOR INSERT
    TO authenticated
    WITH CHECK (
      user_id IN (
        SELECT id FROM users WHERE auth_id = auth.uid()
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users update own acknowledgments'
      AND tablename = 'notice_acknowledgments'
  ) THEN
    CREATE POLICY "Users update own acknowledgments"
    ON notice_acknowledgments
    FOR UPDATE
    TO authenticated
    USING (
      user_id IN (
        SELECT id FROM users WHERE auth_id = auth.uid()
      )
    );
  END IF;
END $$;

-- ============================================
-- PAYROLL DEDUCTIONS
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
-- PAYROLL RECORDS
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
-- PAYROLL SUMMARIES
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
-- PROMOTION HISTORY
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
-- RECEIPTS
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
-- SMS QUOTA
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
-- SMS USAGE
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
-- SMS USAGE INCREMENT RPC (schema.sql canonical)
-- ============================================
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

-- ============================================
-- STAFF
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
-- SYLLABUS TIMELINE
-- ============================================
CREATE TABLE IF NOT EXISTS syllabus_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    syllabus_id UUID NOT NULL REFERENCES syllabus(id) ON DELETE CASCADE,
    term INTEGER NOT NULL CHECK (term IN (1, 2, 3)),
    academic_year TEXT NOT NULL,
    week_number INTEGER NOT NULL,
    planned_start_date DATE NOT NULL,
    planned_end_date DATE NOT NULL,
    actual_start_date DATE,
    actual_end_date DATE,
    status TEXT CHECK (status IN ('not_started', 'in_progress', 'completed', 'postponed', 'accelerated')) DEFAULT 'not_started',
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    lessons_planned INTEGER DEFAULT 0,
    lessons_completed INTEGER DEFAULT 0,
    student_comprehension_rating INTEGER CHECK (student_comprehension_rating >= 1 AND student_comprehension_rating <= 5),
    teacher_notes TEXT,
    challenges TEXT,
    adaptations_made TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, class_id, subject_id, syllabus_id, term, academic_year, week_number)
);
ALTER TABLE syllabus_timeline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School staff manage syllabus_timeline" ON syllabus_timeline;
CREATE POLICY "School staff manage syllabus_timeline" ON syllabus_timeline FOR ALL USING (school_id IN (SELECT my_school_id()));

-- ============================================
-- AUTO PLANNER CONFIG
-- ============================================
CREATE TABLE IF NOT EXISTS auto_planner_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    enable_ai_generation BOOLEAN DEFAULT true,
    enable_weekly_distribution BOOLEAN DEFAULT true,
    enable_smart_scheduling BOOLEAN DEFAULT true,
    lessons_per_week_target INTEGER DEFAULT 2,
    account_for_holidays BOOLEAN DEFAULT true,
    account_for_exams BOOLEAN DEFAULT true,
    ai_provider TEXT CHECK (ai_provider IN ('openai', 'claude', 'rules_based')) DEFAULT 'rules_based',
    ai_temperature DECIMAL(3, 2) DEFAULT 0.7,
    default_lesson_duration INTEGER DEFAULT 40,
    include_homework BOOLEAN DEFAULT true,
    include_assessment BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id)
);
ALTER TABLE auto_planner_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School staff manage planner_config" ON auto_planner_config;
CREATE POLICY "School staff manage planner_config" ON auto_planner_config FOR ALL USING (school_id IN (SELECT my_school_id()));
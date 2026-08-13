-- ============================================================
-- Create missing base tables (schema.sql parity)
-- ------------------------------------------------------------
-- These tables exist in schema.sql (canonical source of truth)
-- but were NEVER migrated to prod. Prod migration history is
-- out of sync (many tables exist only in schema.sql).
--
-- Why backdated to 202606120000:
--   * 202606130000_critical_schema_fixes.sql creates indexes on
--     student_fees + student_grades -> tables MUST exist first
--   * 202611010007_parent_portal_rls_hardening.sql creates
--     policies on report_cards + canteen_orders
--
-- All definitions below mirror schema.sql byte-for-byte.
-- ============================================================

-- ------------------------------------------------------------
-- STUDENT FEES (core financial rollup; indexed by 202606130000)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- STUDENT GRADES (rollup used by report cards; indexed by 202606130000)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- REPORT CARDS (policy also added by 202611010007 hardening)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- CANTEEN ORDERS (policy also added by 202611010007 hardening)
-- ------------------------------------------------------------
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
CREATE POLICY "School users canteen_orders all" ON canteen_orders FOR ALL TO authenticated USING (
  (school_id = my_school_id() AND is_staff_role())
  OR student_id IN (SELECT my_student_ids())
) WITH CHECK (
  (school_id = my_school_id() AND is_staff_role())
  OR (school_id = my_school_id() AND student_id IS NOT NULL AND student_id IN (SELECT my_student_ids()))
);
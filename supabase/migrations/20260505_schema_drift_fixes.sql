-- Schema drift fixes: missing columns, tables, and RLS policies
-- Run this against your Supabase database to resolve 400/403 errors

-- ============================================================
-- 1. students: missing optional columns
-- ============================================================
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS blood_type TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS religion TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS nationality TEXT DEFAULT 'Ugandan';
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS passport_photo_url TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS transfer_from TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS transfer_to TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS transfer_reason TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS dropout_reason TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS dropout_date DATE;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS repeating BOOLEAN DEFAULT false;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS last_attendance_date DATE;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS consecutive_absent_days INTEGER DEFAULT 0;

-- ============================================================
-- 2. fee_payments: add deleted_at for soft-delete support
-- ============================================================
ALTER TABLE public.fee_payments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================
-- 3. expenses: ensure table exists with status column
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    budget_id UUID,
    category TEXT,
    description TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    vendor TEXT,
    receipt_number TEXT,
    status TEXT DEFAULT 'pending',
    approved_by UUID,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add status column if table already existed without it
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Enable RLS on expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users expenses all" ON public.expenses;
CREATE POLICY "School users expenses all"
ON public.expenses
FOR ALL
TO authenticated
USING (school_id = my_school_id())
WITH CHECK (school_id = my_school_id());

-- ============================================================
-- 4. leave_requests: ensure table exists
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add status column if table already existed without it
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Enable RLS on leave_requests
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users leave_requests all" ON public.leave_requests;
CREATE POLICY "School users leave_requests all"
ON public.leave_requests
FOR ALL
TO authenticated
USING (school_id = my_school_id())
WITH CHECK (school_id = my_school_id());

-- ============================================================
-- 5. classes: ensure RLS write policy covers upsert
-- ============================================================
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users classes select" ON public.classes;
CREATE POLICY "School users classes select"
ON public.classes
FOR SELECT
TO authenticated
USING (school_id = my_school_id());

DROP POLICY IF EXISTS "School users classes write" ON public.classes;
CREATE POLICY "School users classes write"
ON public.classes
FOR ALL
TO authenticated
USING (school_id = my_school_id())
WITH CHECK (school_id = my_school_id());

-- ============================================================
-- 6. schools: add feature_stage if missing
-- ============================================================
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS feature_stage TEXT DEFAULT 'core';

-- ============================================================
-- 7. fee_structure: add category column if missing
-- ============================================================
ALTER TABLE public.fee_structure ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'tuition';

-- ============================================================
-- 8. academic_terms: ensure table exists (some deployments may only have the "terms" table)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academic_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    code TEXT NOT NULL DEFAULT '',
    term_number INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    academic_year TEXT NOT NULL,
    is_current BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, term_number, academic_year)
);

ALTER TABLE public.academic_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users academic_terms all" ON public.academic_terms;
CREATE POLICY "School users academic_terms all"
ON public.academic_terms
FOR ALL
TO authenticated
USING (school_id = my_school_id())
WITH CHECK (school_id = my_school_id());

CREATE INDEX IF NOT EXISTS idx_academic_terms_school ON public.academic_terms(school_id);

-- ============================================================
-- 9. Indexes for new columns
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_expenses_school_status ON public.expenses(school_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_school_status ON public.leave_requests(school_id, status);
CREATE INDEX IF NOT EXISTS idx_fee_payments_deleted_at ON public.fee_payments(deleted_at) WHERE deleted_at IS NULL;

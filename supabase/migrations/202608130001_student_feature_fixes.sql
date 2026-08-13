-- ============================================================
-- Student Feature Fixes: registration, attendance, academics
-- ------------------------------------------------------------
-- Ground truth verified against prod (gucxpmgwvnbqykevucbi):
--   * students.uneb_number does NOT exist (prod uses uneab_number)
--   * grades has NO school_id column
--   * attendance has NO school_id column (has period_number)
--   * student_grades + report_cards are created by the BACKDATED
--     migration 202606120000_create_missing_schema_tables.sql
--     (they are indexed/policied by migrations that run earlier)
--   * period_attendance, student_comments, term_archives are
--     created HERE (no earlier migration references them)
--   * students RLS was broken by earlier migrations:
--       students_select USING (true)          -> cross-tenant leak
--       students_update USING (auth.role()...)-> always FALSE,
--          so updates silently fail for every role
-- ============================================================

-- ------------------------------------------------------------
-- 1. PERIOD ATTENDANCE (schema.sql lines 1009-1032)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.period_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    period TEXT NOT NULL,
    status TEXT NOT NULL,
    recorded_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, date, period)
);
ALTER TABLE public.period_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users period_attendance all" ON public.period_attendance;
DROP POLICY IF EXISTS "School users period_attendance select" ON public.period_attendance;
DROP POLICY IF EXISTS "School users period_attendance write" ON public.period_attendance;
CREATE POLICY "School users period_attendance select" ON public.period_attendance
FOR SELECT TO authenticated
USING (
  (school_id = my_school_id() AND is_staff_role())
  OR student_id IN (SELECT my_student_ids())
);
CREATE POLICY "School users period_attendance write" ON public.period_attendance
FOR ALL TO authenticated
USING (school_id = my_school_id() AND is_staff_role())
WITH CHECK (school_id = my_school_id() AND is_staff_role());

-- ------------------------------------------------------------
-- 2. STUDENT COMMENTS (report-card comments; comments page uses
--    onConflict 'student_id,subject_id' — covered by UNIQUE)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, subject_id)
);
ALTER TABLE public.student_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users student_comments select" ON public.student_comments;
DROP POLICY IF EXISTS "School users student_comments write" ON public.student_comments;
CREATE POLICY "School users student_comments select" ON public.student_comments
FOR SELECT TO authenticated
USING (
  (student_id IN (SELECT id FROM students WHERE school_id = my_school_id()) AND is_staff_role())
  OR student_id IN (SELECT my_student_ids())
);
CREATE POLICY "School users student_comments write" ON public.student_comments
FOR ALL TO authenticated
USING (student_id IN (SELECT id FROM students WHERE school_id = my_school_id()) AND is_staff_role())
WITH CHECK (student_id IN (SELECT id FROM students WHERE school_id = my_school_id()) AND is_staff_role());

-- ------------------------------------------------------------
-- 3. TERM ARCHIVES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.term_archives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
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
ALTER TABLE public.term_archives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users term_archives all" ON public.term_archives;
DROP POLICY IF EXISTS "School users term_archives select" ON public.term_archives;
DROP POLICY IF EXISTS "School users term_archives write" ON public.term_archives;
CREATE POLICY "School users term_archives select" ON public.term_archives
FOR SELECT TO authenticated
USING (school_id = my_school_id() AND is_staff_role());
CREATE POLICY "School users term_archives write" ON public.term_archives
FOR ALL TO authenticated
USING (school_id = my_school_id() AND is_staff_role())
WITH CHECK (school_id = my_school_id() AND is_staff_role());

-- ------------------------------------------------------------
-- 4. FIX students RLS (remove cross-tenant leak + broken update)
--    Replaces policies created by 20260520064759 / 202606010002
-- ------------------------------------------------------------
DROP POLICY IF EXISTS students_select ON students;
DROP POLICY IF EXISTS students_update ON students;

DROP POLICY IF EXISTS "School users students select" ON students;
DROP POLICY IF EXISTS "School users students insert" ON students;
DROP POLICY IF EXISTS "School users students update" ON students;
DROP POLICY IF EXISTS "School users students delete" ON students;

CREATE POLICY "School users students select" ON students
FOR SELECT TO authenticated
USING (
  (school_id = my_school_id() AND is_staff_role())
  OR id IN (SELECT my_student_ids())
);

CREATE POLICY "School users students insert" ON students
FOR INSERT TO authenticated
WITH CHECK (school_id = my_school_id() AND is_staff_role());

CREATE POLICY "School users students update" ON students
FOR UPDATE TO authenticated
USING (school_id = my_school_id() AND is_staff_role())
WITH CHECK (school_id = my_school_id() AND is_staff_role());

CREATE POLICY "School users students delete" ON students
FOR DELETE TO authenticated
USING (school_id = my_school_id() AND is_staff_role());
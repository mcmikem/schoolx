-- Fix stacked USING(true) policies that are OR'd with properly-scoped policies.
-- When a table has BOTH a USING(true) policy AND a scoped policy, Postgres OR's
-- them: any authenticated user can read all rows across all tenants.
-- This migration drops only the permissive named policies; the scoped ones remain.

-- ============================================================
-- classes: drop the old "Users can view classes" USING(true) policy.
-- The scoped policy "School users classes select" from 20260505_schema_drift_fixes
-- already restricts reads to school_id = my_school_id().
-- ============================================================
DROP POLICY IF EXISTS "Users can view classes" ON public.classes;

-- ============================================================
-- syllabus: drop the old "Users can view syllabus" USING(true) policy.
-- The scoped "syllabus_select" from 202604210001_eliminate_all_recursive_rls
-- already restricts to school_id = my_school_id().
-- ============================================================
DROP POLICY IF EXISTS "Users can view syllabus" ON public.syllabus;

-- ============================================================
-- academic_terms: drop the old "academic_terms_select" USING(true) policy.
-- The "School users academic_terms all" policy from 20260505_schema_drift_fixes
-- already restricts to school_id = my_school_id() FOR ALL.
-- ============================================================
DROP POLICY IF EXISTS academic_terms_select ON public.academic_terms;

-- Fix client-side writes that RLS silently blocks
--
-- Found by probing every table the browser writes to: an INSERT of a valid row
-- scoped to the caller's own school was rejected with 42501 for these tables.
-- The failures were invisible in the UI because the affected handlers either log
-- and continue or surface a generic message.
--
-- Two distinct causes:
--
--   1. Policies written against the anti-pattern this project documents as
--      forbidden -- a nested SELECT over a table that is itself RLS-protected,
--      or over auth.users. The subquery cannot see the row under the caller's
--      policies, so the check is always false and every insert is rejected.
--        courses     -> school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
--        suggestions -> school_id IN (SELECT school_id FROM auth.users WHERE id = auth.uid())
--
--   2. No INSERT policy at all, while the table has SELECT/UPDATE/DELETE ones,
--      so the browser can read and edit automation but not create it.
--        school_workflows, syllabus
--
-- All replacements use my_school_id() / is_school_admin(), which are
-- SECURITY DEFINER and therefore not subject to the caller's RLS. Predicates
-- mirror the policies already on each table so no access is widened beyond what
-- the existing rules intend.

-- ─── courses ─────────────────────────────────────────────────────────────────
-- Preserves the original intent (any member of the school may add a course)
-- while removing the self-defeating subquery.
DROP POLICY IF EXISTS "courses_insert" ON public.courses;
CREATE POLICY "courses_insert" ON public.courses
  FOR INSERT TO authenticated
  WITH CHECK (school_id = my_school_id());

-- ─── suggestions ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "suggestions_insert_policy" ON public.suggestions;
DROP POLICY IF EXISTS "Schools manage suggestions" ON public.suggestions;
CREATE POLICY "suggestions_insert" ON public.suggestions
  FOR INSERT TO authenticated
  WITH CHECK (school_id = my_school_id());

-- ─── school_workflows ────────────────────────────────────────────────────────
-- UPDATE and DELETE here already require is_school_admin; creating a workflow is
-- the same class of action, so INSERT requires it too.
DROP POLICY IF EXISTS "school_workflows_insert" ON public.school_workflows;
CREATE POLICY "school_workflows_insert" ON public.school_workflows
  FOR INSERT TO authenticated
  WITH CHECK (school_id = my_school_id() AND is_school_admin(my_school_id()));

-- ─── syllabus ────────────────────────────────────────────────────────────────
-- The other operations on this table are scoped only by school.
DROP POLICY IF EXISTS "syllabus_insert" ON public.syllabus;
CREATE POLICY "syllabus_insert" ON public.syllabus
  FOR INSERT TO authenticated
  WITH CHECK (school_id = my_school_id());

-- ─── error_logs ──────────────────────────────────────────────────────────────
-- src/lib/error-logger.ts reports client errors straight from the browser, which
-- RLS rejected, so client-side errors were never recorded. Append-only and
-- harmless; reading stays restricted to the existing super-admin SELECT policy.
DROP POLICY IF EXISTS "System inserts error logs" ON public.error_logs;
CREATE POLICY "error_logs_insert" ON public.error_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

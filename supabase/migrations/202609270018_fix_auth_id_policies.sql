-- Repair the last 13 policies that can never match a real user
--
-- These compare `users.id` to `auth.uid()`. `users.id` is the profile row's own
-- primary key; the Supabase auth UUID lives in `users.auth_id`. The comparison is
-- therefore false for every signed-in user, so the policies silently blocked
-- access rather than granting it.
--
-- Found by scanning the live catalog: 13 policies across 5 tables.
--
--   classes            ALL            reads AND writes
--   courses            SELECT/UPDATE/DELETE
--   momo_disbursements ALL            reads AND writes
--   syllabus           ALL + SELECT/UPDATE/DELETE
--   topic_coverage     SELECT/INSERT/UPDATE/DELETE
--
-- Impact was not subtle. Verified directly: a course row the service role could
-- read was invisible to a signed-in headmaster of that same school, which means
-- class and course lists render empty in the browser.
--
-- Replacements use my_school_id(), which is SECURITY DEFINER and reads
-- public.users by auth_id, so it is not subject to the caller's RLS. Each
-- table's write policies keep the staff/admin restriction its name implies.

-- ─── classes ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage classes" ON public.classes;
CREATE POLICY "classes_select" ON public.classes
  FOR SELECT TO authenticated
  USING (school_id = my_school_id());
CREATE POLICY "classes_insert" ON public.classes
  FOR INSERT TO authenticated
  WITH CHECK (school_id = my_school_id() AND is_staff_role());
CREATE POLICY "classes_update" ON public.classes
  FOR UPDATE TO authenticated
  USING (school_id = my_school_id() AND is_school_admin(my_school_id()));
CREATE POLICY "classes_delete" ON public.classes
  FOR DELETE TO authenticated
  USING (school_id = my_school_id() AND is_school_admin(my_school_id()));

-- ─── courses ─────────────────────────────────────────────────────────────────
-- INSERT already added in 202609270001; these complete the table so the browser
-- can read back what it wrote.
DROP POLICY IF EXISTS "courses_select" ON public.courses;
DROP POLICY IF EXISTS "courses_update" ON public.courses;
DROP POLICY IF EXISTS "courses_delete" ON public.courses;
CREATE POLICY "courses_select" ON public.courses
  FOR SELECT TO authenticated
  USING (school_id = my_school_id());
CREATE POLICY "courses_update" ON public.courses
  FOR UPDATE TO authenticated
  USING (school_id = my_school_id() AND is_school_admin(my_school_id()));
CREATE POLICY "courses_delete" ON public.courses
  FOR DELETE TO authenticated
  USING (school_id = my_school_id() AND is_school_admin(my_school_id()));

-- ─── momo_disbursements ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "School admins can manage disbursements" ON public.momo_disbursements;
CREATE POLICY "momo_disbursements_select" ON public.momo_disbursements
  FOR SELECT TO authenticated
  USING (school_id = my_school_id());
CREATE POLICY "momo_disbursements_insert" ON public.momo_disbursements
  FOR INSERT TO authenticated
  WITH CHECK (school_id = my_school_id() AND is_school_admin(my_school_id()));
CREATE POLICY "momo_disbursements_update" ON public.momo_disbursements
  FOR UPDATE TO authenticated
  USING (school_id = my_school_id() AND is_school_admin(my_school_id()));
CREATE POLICY "momo_disbursements_delete" ON public.momo_disbursements
  FOR DELETE TO authenticated
  USING (school_id = my_school_id() AND is_school_admin(my_school_id()));

-- ─── syllabus ────────────────────────────────────────────────────────────────
-- INSERT already added in 202609270001.
DROP POLICY IF EXISTS "Teachers can manage syllabus" ON public.syllabus;
DROP POLICY IF EXISTS "syllabus_select" ON public.syllabus;
DROP POLICY IF EXISTS "syllabus_update" ON public.syllabus;
DROP POLICY IF EXISTS "syllabus_delete" ON public.syllabus;
CREATE POLICY "syllabus_select" ON public.syllabus
  FOR SELECT TO authenticated
  USING (school_id = my_school_id());
CREATE POLICY "syllabus_update" ON public.syllabus
  FOR UPDATE TO authenticated
  USING (school_id = my_school_id() AND is_staff_role());
CREATE POLICY "syllabus_delete" ON public.syllabus
  FOR DELETE TO authenticated
  USING (school_id = my_school_id() AND is_school_admin(my_school_id()));

-- ─── topic_coverage ──────────────────────────────────────────────────────────
-- This table has no school_id; it is scoped through class_id. A subquery over
-- `classes` would be evaluated under the caller's RLS, so a SECURITY DEFINER
-- helper is used instead -- the same approach my_school_id() already takes.
CREATE OR REPLACE FUNCTION public.my_class_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.classes WHERE school_id = my_school_id();
$$;

REVOKE ALL ON FUNCTION public.my_class_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_class_ids() TO authenticated;

DROP POLICY IF EXISTS "topic_coverage_select" ON public.topic_coverage;
DROP POLICY IF EXISTS "topic_coverage_insert" ON public.topic_coverage;
DROP POLICY IF EXISTS "topic_coverage_update" ON public.topic_coverage;
DROP POLICY IF EXISTS "topic_coverage_delete" ON public.topic_coverage;
CREATE POLICY "topic_coverage_select" ON public.topic_coverage
  FOR SELECT TO authenticated
  USING (class_id IN (SELECT id FROM my_class_ids()));
CREATE POLICY "topic_coverage_insert" ON public.topic_coverage
  FOR INSERT TO authenticated
  WITH CHECK (class_id IN (SELECT id FROM my_class_ids()) AND is_staff_role());
CREATE POLICY "topic_coverage_update" ON public.topic_coverage
  FOR UPDATE TO authenticated
  USING (class_id IN (SELECT id FROM my_class_ids()) AND is_staff_role());
CREATE POLICY "topic_coverage_delete" ON public.topic_coverage
  FOR DELETE TO authenticated
  USING (class_id IN (SELECT id FROM my_class_ids()) AND is_school_admin(my_school_id()));

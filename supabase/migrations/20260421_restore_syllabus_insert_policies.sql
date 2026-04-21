-- Restore INSERT policies for syllabus and topic_coverage.
-- The 20260421_eliminate_all_recursive_rls migration dropped syllabus_insert
-- and topic_coverage_insert without recreating them, causing NCDC auto-populate
-- and manual topic adds to silently fail for all authenticated users.

DROP POLICY IF EXISTS "syllabus_insert" ON public.syllabus;
CREATE POLICY "syllabus_insert" ON public.syllabus
  FOR INSERT
  WITH CHECK (school_id = my_school_id());

DROP POLICY IF EXISTS "topic_coverage_insert" ON public.topic_coverage;
CREATE POLICY "topic_coverage_insert" ON public.topic_coverage
  FOR INSERT
  WITH CHECK (
    class_id IN (
      SELECT id FROM classes WHERE school_id = my_school_id()
    )
  );

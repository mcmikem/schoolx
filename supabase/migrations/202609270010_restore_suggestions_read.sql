-- Restore read access to suggestions
--
-- The previous SELECT policy was:
--
--   CREATE POLICY suggestions_select_policy ON suggestions
--     FOR SELECT USING (school_id IN (
--       SELECT suggestions.school_id FROM auth.users WHERE users.id = auth.uid()
--     ));
--
-- auth.users has no school_id column, so the expression could not be evaluated.
-- Every read failed outright with 42501 "permission denied for table users",
-- and because the same broken expression also backed the write path, creating a
-- suggestion failed too. The table was unusable for every school, not just some.
--
-- Replaced with my_school_id(), which is SECURITY DEFINER and reads
-- public.users by auth_id -- the column that actually holds the auth UUID.
-- This mirrors the policy added for writes in 202609270001.

DROP POLICY IF EXISTS "suggestions_select_policy" ON public.suggestions;
CREATE POLICY "suggestions_select" ON public.suggestions
  FOR SELECT TO authenticated
  USING (school_id = my_school_id());

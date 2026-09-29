-- Close the last policy gaps found by reconciling live policies against the
-- operations the browser performs
--
-- A scan of all 111 tables the browser touches (excluding /api routes, which run
-- on the service role and are unaffected by RLS) found only three genuine
-- omissions, each a DELETE the app performs from the browser with no policy to
-- allow it:
--
--   fee_term_lines          editing a fee term deletes its old lines first
--   automated_message_logs  clearing message logs
--   activity_comments       deleting a comment
--
-- Reads and other writes on these tables already had policies, so the failure was
-- narrow and quiet: the delete simply did nothing.
--
-- Two of these tables do NOT have a school_id column in the live database, which
-- schema.sql gets wrong:
--
--   activity_comments  id, entity_type, entity_id, author_id, author_name, ...
--   fee_term_lines     id, term_id, installment_number, due_days, ...
--
-- so they are scoped through their parent instead, via SECURITY DEFINER helpers
-- in the same spirit as my_school_id(). A subquery over fee_terms would be
-- evaluated under the caller's RLS and fail the same way the broken policies did.
--
-- automated_message_logs keeps its own school_id and is gated on staff.
-- webhook_events was also flagged but is only written from API routes on the
-- service role, so it needs no client policy.

CREATE OR REPLACE FUNCTION public.my_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.my_fee_term_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.fee_terms WHERE school_id = my_school_id();
$$;

REVOKE ALL ON FUNCTION public.my_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_user_id() TO authenticated;
REVOKE ALL ON FUNCTION public.my_fee_term_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_fee_term_ids() TO authenticated;

-- A comment can only be deleted by the person who wrote it. There is no school
-- column on this table and entity_id is polymorphic, so scoping to the author is
-- the only check that can be made soundly.
DROP POLICY IF EXISTS "activity_comments_delete" ON public.activity_comments;
CREATE POLICY "activity_comments_delete" ON public.activity_comments
  FOR DELETE TO authenticated
  USING (author_id = my_user_id());

DROP POLICY IF EXISTS "fee_term_lines_delete" ON public.fee_term_lines;
CREATE POLICY "fee_term_lines_delete" ON public.fee_term_lines
  FOR DELETE TO authenticated
  USING (term_id IN (SELECT id FROM my_fee_term_ids()));

DROP POLICY IF EXISTS "automated_message_logs_delete" ON public.automated_message_logs;
CREATE POLICY "automated_message_logs_delete" ON public.automated_message_logs
  FOR DELETE TO authenticated
  USING (school_id = my_school_id() AND is_school_staff(school_id));

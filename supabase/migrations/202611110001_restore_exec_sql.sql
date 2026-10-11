-- Restore the exec_sql diagnostic RPC that scripts/apply-migration.sh and
-- scripts/run-critical-fix.sh have always assumed exists. It was created
-- ad-hoc on the database at some point and later dropped; without it there
-- is no way to run inspection queries (pg_policies, catalog) through
-- PostgREST.
--
-- Locked to service_role only: anon/authenticated can never reach it, so it
-- is not a privilege-escalation surface — the service key already bypasses
-- RLS entirely. SELECT-only by construction (the wrapped query must be a
-- row-returning statement).
CREATE OR REPLACE FUNCTION public.exec_sql(query text)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY EXECUTE 'SELECT to_jsonb(q) FROM (' || query || ') q';
END;
$$;

REVOKE ALL ON FUNCTION public.exec_sql(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.exec_sql(text) FROM anon;
REVOKE ALL ON FUNCTION public.exec_sql(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;

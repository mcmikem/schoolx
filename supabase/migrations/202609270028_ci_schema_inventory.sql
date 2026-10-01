-- Inventory of the live schema, for scripts/check-schema-drift.mjs
--
-- PostgREST cannot read pg_policies or information_schema, so the drift check has
-- no way to see what the database actually looks like. This exposes the two
-- things that matter as a single call the script can make with the service role.
--
-- Restricted to service_role on purpose: it is a CI/diagnostic aid, not
-- something the browser should ever reach.

CREATE OR REPLACE FUNCTION public.ci_schema_inventory()
RETURNS TABLE(kind text, tbl text, detail text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- columns, one row per column
  SELECT 'column', c.relname::text, a.attname::text
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  WHERE c.relkind IN ('r','p')

  UNION ALL

  -- tables
  SELECT 'table', c.relname::text, ''
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  WHERE c.relkind IN ('r','p')

  UNION ALL

  -- policies, with the command and the predicate so the check can spot
  -- predicates that reference a column the table does not have
  SELECT 'policy', p.tablename::text,
         p.policyname::text || ' [' || p.cmd::text || '] ' || coalesce(p.qual, p.with_check, '')
  FROM pg_policies p
  WHERE p.schemaname = 'public'
$$;

REVOKE ALL ON FUNCTION public.ci_schema_inventory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ci_schema_inventory() TO service_role;

COMMENT ON FUNCTION public.ci_schema_inventory() IS
  'Read-only schema inventory for the drift check. service_role only.';
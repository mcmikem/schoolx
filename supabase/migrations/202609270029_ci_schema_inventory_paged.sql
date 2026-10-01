-- Paginated form of ci_schema_inventory
--
-- PostgREST ignores the Range header on an RPC POST and caps every response at
-- the instance max-rows limit, so the full inventory cannot be fetched in one
-- call. Give the function an explicit kind filter and window instead.
--
-- The first version returned everything and silently truncated at 1000 rows,
-- which is exactly the kind of quiet gap this check exists to prevent.

CREATE OR REPLACE FUNCTION public.ci_schema_inventory(
  p_kind text DEFAULT NULL,
  p_limit integer DEFAULT 1000,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(kind text, tbl text, detail text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH inv AS (
    SELECT 'column'::text AS kind, c.relname::text AS tbl, a.attname::text AS detail
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    WHERE c.relkind IN ('r','p')

    UNION ALL

    SELECT 'table', c.relname::text, ''
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    WHERE c.relkind IN ('r','p')

    UNION ALL

    SELECT 'policy', p.tablename::text,
           p.policyname::text || ' [' || p.cmd::text || '] ' || coalesce(p.qual, p.with_check, '')
    FROM pg_policies p
    WHERE p.schemaname = 'public'
  )
  SELECT inv.kind, inv.tbl, inv.detail
  FROM inv
  WHERE p_kind IS NULL OR inv.kind = p_kind
  ORDER BY inv.kind, inv.tbl, inv.detail
  LIMIT greatest(1, least(p_limit, 1000))
  OFFSET greatest(0, p_offset)
$$;

COMMENT ON FUNCTION public.ci_schema_inventory(text, integer, integer) IS
  'Read-only schema inventory for the drift check. service_role only.';
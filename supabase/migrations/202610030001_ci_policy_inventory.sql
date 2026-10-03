-- Read-only inventory of RLS policies.
--
-- ci_schema_inventory already returns policies, but only as
--   policyname [CMD] coalesce(qual, with_check)
-- which is not enough to fix one safely: the `roles` array and the
-- with_check expression are both needed, because for INSERT the predicate that
-- actually governs the new row is with_check, and a policy that only applies to
-- `anon` or to `service_role` must not be treated as an app-facing grant.
--
-- Without this, the safest-looking edit is the wrong one.

CREATE OR REPLACE FUNCTION public.ci_policy_inventory(p_table text DEFAULT NULL)
RETURNS TABLE(
  tbl text,
  policy text,
  cmd text,
  roles text[],
  permissive text,
  using_expr text,
  check_expr text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p.tablename::text,
    p.policyname::text,
    p.cmd::text,
    p.roles::name[]::text[],
    p.permissive::text,
    p.qual::text,
    p.with_check::text
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND (p_table IS NULL OR p.tablename = p_table)
  ORDER BY p.tablename, p.cmd, p.policyname
$$;

REVOKE ALL ON FUNCTION public.ci_policy_inventory(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ci_policy_inventory(text) TO service_role;
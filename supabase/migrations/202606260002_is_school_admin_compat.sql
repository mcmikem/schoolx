-- Compatibility wrapper for legacy policies/functions expecting is_school_admin() without arguments.
-- Keep this in migrations so fresh environments match production hotfix behavior.
CREATE OR REPLACE FUNCTION public.is_school_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_school_admin(public.my_school_id());
$$;

GRANT EXECUTE ON FUNCTION public.is_school_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_school_admin() TO service_role;

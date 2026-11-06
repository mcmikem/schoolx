-- ============================================================================
-- get_profile_with_school v2 — optimized + includes roles in one round-trip
-- ============================================================================
-- Adds:
--   1. roles: aggregated from user_roles (eliminates a separate PostgREST call)
--   2. Only needed columns (reduces payload size)
--   3. SECURITY DEFINER preserved
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_profile_with_school(p_auth_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user JSONB;
  v_school JSONB;
  v_school_id UUID;
  v_roles TEXT[];
BEGIN
  IF p_auth_id IS NULL THEN
    RETURN jsonb_build_object('user', NULL, 'school', NULL);
  END IF;

  SELECT
    jsonb_build_object(
      'id', u.id,
      'auth_id', u.auth_id,
      'full_name', u.full_name,
      'role', u.role,
      'email', u.email,
      'phone', u.phone,
      'school_id', u.school_id,
      'is_active', u.is_active,
      'created_at', u.created_at,
      'password_reset_required', u.password_reset_required,
      'preferred_dashboard', u.preferred_dashboard,
      'roles', COALESCE(
        (SELECT array_agg(ur.role ORDER BY ur.created_at)::text[]
         FROM public.user_roles ur
         WHERE ur.user_id = u.id),
        ARRAY[u.role]::text[]
      )
    ) INTO v_user
    FROM public.users u
   WHERE u.auth_id = p_auth_id
   LIMIT 1;

  IF v_user IS NULL THEN
    RETURN jsonb_build_object('user', NULL, 'school', NULL);
  END IF;

  v_school_id := (v_user ->> 'school_id')::UUID;

  IF v_school_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'school_code', s.school_code,
      'subscription_status', s.subscription_status,
      'subscription_plan', s.subscription_plan,
      'billing_mode', s.billing_mode,
      'feature_stage', s.feature_stage,
      'school_size_band', s.school_size_band,
      'trial_ends_at', s.trial_ends_at,
      'is_tester', s.is_tester,
      'logo_url', s.logo_url,
      'primary_color', s.primary_color,
      'phone', s.phone,
      'email', s.email
    ) INTO v_school
      FROM public.schools s
     WHERE s.id = v_school_id
     LIMIT 1;
  END IF;

  RETURN jsonb_build_object('user', v_user, 'school', v_school);
END;
$$;

REVOKE ALL ON FUNCTION public.get_profile_with_school(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_with_school(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_profile_with_school(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_with_school(UUID) TO anon;

-- ============================================================================
-- get_profile_with_school — one round-trip for the login profile fetch
-- ============================================================================
-- GET /api/auth/me/ fetched the user row and then the school row as two
-- sequential PostgREST calls. With the database hosted in a different region
-- from most users, each call is a full network round-trip, so login paid the
-- latency twice for data it already had the key for.
--
-- users.school_id has no foreign key to schools.id (there is an unrelated
-- schools_onboarded_by_fkey that also makes PostgREST refuse to embed), so
-- the join has to happen server-side.
--
-- Returns the same shape the route already produces, so the client is
-- unaffected: { "user": {...}|null, "school": {...}|null }.
-- SECURITY DEFINER so it can read the rows regardless of RLS; it is callable
-- only with an auth_id, which the route takes from a verified access token.
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
BEGIN
  IF p_auth_id IS NULL THEN
    RETURN jsonb_build_object('user', NULL, 'school', NULL);
  END IF;

  SELECT to_jsonb(u) INTO v_user
    FROM public.users u
   WHERE u.auth_id = p_auth_id
   LIMIT 1;

  IF v_user IS NULL THEN
    RETURN jsonb_build_object('user', NULL, 'school', NULL);
  END IF;

  v_school_id := (v_user ->> 'school_id')::UUID;

  IF v_school_id IS NOT NULL THEN
    SELECT to_jsonb(s) INTO v_school
      FROM public.schools s
     WHERE s.id = v_school_id
     LIMIT 1;
  END IF;

  RETURN jsonb_build_object('user', v_user, 'school', v_school);
END;
$$;

REVOKE ALL ON FUNCTION public.get_profile_with_school(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_with_school(UUID) TO service_role;

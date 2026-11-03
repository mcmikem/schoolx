-- Atomic distributed rate limiting for serverless instances.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key TEXT,
  p_limit INTEGER,
  p_window_ms INTEGER
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, reset_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start TIMESTAMPTZ := clock_timestamp() - make_interval(secs => greatest(p_window_ms, 1)::numeric / 1000);
  v_reset TIMESTAMPTZ := clock_timestamp() + make_interval(secs => greatest(p_window_ms, 1)::numeric / 1000);
  v_hits INTEGER;
BEGIN
  IF p_key IS NULL OR length(p_key) = 0 OR p_limit < 1 OR p_window_ms < 1 THEN
    RETURN QUERY SELECT false, 0, v_reset;
    RETURN;
  END IF;

  -- Transaction-scoped advisory locking makes count + insert one operation
  -- across all application instances.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_key, 0));
  DELETE FROM public.rate_limit_log WHERE key = p_key AND created_at < v_start;
  SELECT count(*)::INTEGER INTO v_hits
    FROM public.rate_limit_log
   WHERE key = p_key AND created_at >= v_start;

  IF v_hits >= p_limit THEN
    RETURN QUERY SELECT false, 0, v_reset;
    RETURN;
  END IF;

  INSERT INTO public.rate_limit_log(key, created_at) VALUES (p_key, clock_timestamp());
  RETURN QUERY SELECT true, p_limit - v_hits - 1, v_reset;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

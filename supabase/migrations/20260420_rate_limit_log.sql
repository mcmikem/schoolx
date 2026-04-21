-- Rate limit log table for serverless-safe rate limiting
-- Used by api-utils.ts rateLimitAsync() as primary store (falls back to in-memory)
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id          BIGSERIAL PRIMARY KEY,
  key         TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_log_key_created ON rate_limit_log (key, created_at);

-- Auto-purge rows older than 1 hour to prevent unbounded growth
-- Requires pg_cron; if not available, a daily cleanup job can be added manually.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'purge-rate-limit-log',
      '*/30 * * * *',
      $cron$DELETE FROM rate_limit_log WHERE created_at < now() - interval '1 hour'$cron$
    );
  END IF;
END $$;

-- No RLS needed — this table is only accessed via service role key in API routes.
-- Ensure service role access only:
ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct user access" ON rate_limit_log AS RESTRICTIVE TO authenticated USING (false);

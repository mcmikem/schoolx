-- Crash-safe registration cleanup.
-- The /api/register route creates an auth user, school, admin profile, then seeds
-- curriculum. If a serverless instance dies mid-flow, the in-route rollback queue
-- cannot run, leaving an orphaned school (no user rows). Sweep those every 30
-- minutes: schools created 2-48h ago that never got an admin user and never paid.
-- Users/classes/subjects cascade-delete with the school.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'sweep-orphan-registrations',
      '*/30 * * * *',
      $cron$DELETE FROM schools
      WHERE created_at < now() - interval '2 hours'
        AND created_at > now() - interval '48 hours'
        AND subscription_status = 'trial'
        AND last_payment_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM users WHERE users.school_id = schools.id)$cron$
    );
  END IF;
END $$;

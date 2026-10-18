-- ============================================================================
-- events.audience
-- ============================================================================
-- The calendar screen filters events by who they are for: personal, school, or
-- parents. It has always selected that column, and the column has never
-- existed -- so every calendar load failed with
--
--   400 column events.audience does not exist
--
-- and the school calendar rendered empty. The app was ahead of the database,
-- not the other way round: the filter state, the create form and the event
-- type all already treat audience as a normal part of an event.
--
-- Defaults to 'school', which is what the create form already defaults to, so
-- existing events read as school events rather than disappearing from the
-- default view.
-- ============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'school';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_audience_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_audience_check
      CHECK (audience IN ('personal', 'school', 'parents'));
  END IF;
END $$;

COMMENT ON COLUMN public.events.audience IS
  'Who an event is for: personal, school or parents.';

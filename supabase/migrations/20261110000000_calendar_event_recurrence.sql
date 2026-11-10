ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS recurrence_frequency TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recurrence_until DATE;

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_recurrence_frequency_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_recurrence_frequency_check
  CHECK (recurrence_frequency IN ('none', 'weekly', 'monthly'));

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_recurrence_bounds_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_recurrence_bounds_check
  CHECK (
    (recurrence_frequency = 'none' AND recurrence_until IS NULL)
    OR (
      recurrence_frequency IN ('weekly', 'monthly')
      AND recurrence_until > start_date
      AND recurrence_until <= (start_date + INTERVAL '5 years')::date
    )
  );

COMMENT ON COLUMN public.events.recurrence_frequency IS
  'Calendar display recurrence: none, weekly, or monthly. Edits and deletes apply to the whole series.';
COMMENT ON COLUMN public.events.recurrence_until IS
  'Inclusive last date for the recurring series; recurrence is bounded to five years.';

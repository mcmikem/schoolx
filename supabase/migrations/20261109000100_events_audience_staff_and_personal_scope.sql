-- Calendar events can be private to their author, visible to staff, or
-- published to the whole school/parents. Personal events must not be visible
-- just because another staff member shares the same school or device.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'school';

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_audience_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_audience_check
  CHECK (audience IN ('personal', 'staff', 'school', 'parents'));

COMMENT ON COLUMN public.events.audience IS
  'Who an event is for: personal, staff, school or parents.';

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users events select" ON public.events;
DROP POLICY IF EXISTS "School users events write" ON public.events;
DROP POLICY IF EXISTS "events_insert_scoped" ON public.events;
DROP POLICY IF EXISTS "events_update_scoped" ON public.events;
DROP POLICY IF EXISTS "events_delete_scoped" ON public.events;

CREATE POLICY "School users events select"
ON public.events FOR SELECT TO authenticated
USING (
  school_id = my_school_id()
  AND (
    audience IN ('school', 'parents')
    OR (audience = 'staff' AND is_school_staff(my_school_id()))
    OR (audience = 'personal' AND created_by = my_user_id())
  )
);

CREATE POLICY "events_insert_scoped"
ON public.events FOR INSERT TO authenticated
WITH CHECK (
  school_id = my_school_id()
  AND is_school_staff(my_school_id())
  AND (audience <> 'personal' OR created_by = my_user_id())
);

CREATE POLICY "events_update_scoped"
ON public.events FOR UPDATE TO authenticated
USING (
  school_id = my_school_id()
  AND is_school_staff(my_school_id())
  AND (audience <> 'personal' OR created_by = my_user_id())
)
WITH CHECK (
  school_id = my_school_id()
  AND is_school_staff(my_school_id())
  AND (audience <> 'personal' OR created_by = my_user_id())
);

CREATE POLICY "events_delete_scoped"
ON public.events FOR DELETE TO authenticated
USING (
  school_id = my_school_id()
  AND is_school_staff(my_school_id())
  AND (audience <> 'personal' OR created_by = my_user_id())
);

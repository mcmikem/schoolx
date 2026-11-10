-- Calendar records use explicit school-local times and can target one class.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS all_day BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time TIME,
  ADD COLUMN IF NOT EXISTS time_zone TEXT NOT NULL DEFAULT 'Africa/Kampala',
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id);

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_audience_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_audience_check
  CHECK (audience IN ('personal', 'staff', 'school', 'parents', 'class'));

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_class_audience_class_id_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_class_audience_class_id_check
  CHECK (audience <> 'class' OR class_id IS NOT NULL);

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_time_range_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_time_range_check
  CHECK (
    all_day
    OR (
      start_time IS NOT NULL
      AND end_time IS NOT NULL
      AND (end_date > start_date OR end_time > start_time)
    )
  );

CREATE INDEX IF NOT EXISTS idx_events_class_date
  ON public.events (class_id, start_date)
  WHERE audience = 'class';

COMMENT ON COLUMN public.events.all_day IS 'True when the event has no specific start or end time.';
COMMENT ON COLUMN public.events.start_time IS 'School-local start time; null for all-day events.';
COMMENT ON COLUMN public.events.end_time IS 'School-local end time; null for all-day events.';
COMMENT ON COLUMN public.events.time_zone IS 'IANA timezone used to interpret the event times.';
COMMENT ON COLUMN public.events.location IS 'Optional event venue or location.';
COMMENT ON COLUMN public.events.class_id IS 'Required when audience is class; the selected class can see the event.';

DROP POLICY IF EXISTS "School users events select" ON public.events;
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
    OR (
      audience = 'class'
      AND (
        is_school_staff(my_school_id())
        OR EXISTS (
          SELECT 1
          FROM public.parent_students ps
          JOIN public.students st ON st.id = ps.student_id
          WHERE ps.parent_id = my_user_id()
            AND st.school_id = events.school_id
            AND st.class_id = events.class_id
        )
        OR EXISTS (
          SELECT 1 FROM public.students st
          WHERE st.user_id = my_user_id()
            AND st.school_id = events.school_id
            AND st.class_id = events.class_id
        )
      )
    )
  )
);

CREATE POLICY "events_insert_scoped"
ON public.events FOR INSERT TO authenticated
WITH CHECK (
  school_id = my_school_id()
  AND is_school_staff(my_school_id())
  AND (audience <> 'personal' OR created_by = my_user_id())
  AND (
    audience <> 'class'
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = events.class_id AND c.school_id = events.school_id
    )
  )
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
  AND (
    audience <> 'class'
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = events.class_id AND c.school_id = events.school_id
    )
  )
);

CREATE POLICY "events_delete_scoped"
ON public.events FOR DELETE TO authenticated
USING (
  school_id = my_school_id()
  AND is_school_staff(my_school_id())
  AND (audience <> 'personal' OR created_by = my_user_id())
);

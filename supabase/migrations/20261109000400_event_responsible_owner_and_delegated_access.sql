-- Assign a responsible staff member and allow scoped editing/cancellation.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS responsible_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_responsible_date
  ON public.events (responsible_user_id, start_date)
  WHERE responsible_user_id IS NOT NULL;

COMMENT ON COLUMN public.events.responsible_user_id IS
  'Staff member responsible for this event; grants event-specific read/edit/delete access.';

DROP POLICY IF EXISTS "School users events select" ON public.events;
DROP POLICY IF EXISTS "events_insert_scoped" ON public.events;
DROP POLICY IF EXISTS "events_update_scoped" ON public.events;
DROP POLICY IF EXISTS "events_delete_scoped" ON public.events;
-- PostgreSQL ORs permissive policies; remove the old school-wide FOR ALL
-- policy so it cannot bypass audience/class/owner checks below.
DROP POLICY IF EXISTS "School users events write" ON public.events;

CREATE POLICY "School users events select"
ON public.events FOR SELECT TO authenticated
USING (
  school_id = my_school_id()
  AND (
    is_school_admin(my_school_id())
    OR
    responsible_user_id = my_user_id()
    OR audience IN ('school', 'parents')
    OR (audience = 'staff' AND is_school_staff(my_school_id()))
    OR (audience = 'personal' AND created_by = my_user_id())
    OR (
      audience = 'class'
      AND (
        is_school_admin(my_school_id())
        OR (
          is_school_staff(my_school_id())
          AND class_id IN (SELECT public.my_assigned_class_ids())
        )
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
    responsible_user_id IS NULL
    OR responsible_user_id = my_user_id()
    OR (
      is_school_admin(my_school_id())
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = events.responsible_user_id
          AND u.school_id = events.school_id
          AND u.is_active = TRUE
          AND u.role NOT IN ('parent', 'student')
      )
    )
  )
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
  AND (
    is_school_admin(my_school_id())
    OR created_by = my_user_id()
    OR responsible_user_id = my_user_id()
  )
)
WITH CHECK (
  school_id = my_school_id()
  AND (
    is_school_admin(my_school_id())
    OR created_by = my_user_id()
    OR responsible_user_id = my_user_id()
  )
  AND (
    responsible_user_id IS NULL
    OR responsible_user_id = my_user_id()
    OR (
      is_school_admin(my_school_id())
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = events.responsible_user_id
          AND u.school_id = events.school_id
          AND u.is_active = TRUE
          AND u.role NOT IN ('parent', 'student')
      )
    )
  )
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
  AND (
    is_school_admin(my_school_id())
    OR created_by = my_user_id()
    OR responsible_user_id = my_user_id()
  )
);

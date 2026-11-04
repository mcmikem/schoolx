-- Authoritative, transactional timetable approval.
CREATE OR REPLACE FUNCTION public.approve_timetable_entries(
  p_school_id UUID,
  p_academic_year TEXT,
  p_rows JSONB,
  p_actor_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
  inserted_count INTEGER := 0;
  actor_name TEXT;
BEGIN
  IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'placements must be a non-empty array' USING ERRCODE = '22023';
  END IF;

  SELECT full_name INTO actor_name
    FROM public.users
   WHERE id = p_actor_id AND school_id = p_school_id AND is_active = true;
  IF actor_name IS NULL THEN
    RAISE EXCEPTION 'actor is not active in the requested school' USING ERRCODE = '42501';
  END IF;

  -- Serialize approvals for one school/year. The API still performs friendly
  -- pre-checks, but this lock and the checks below are the integrity boundary.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_school_id::text || ':' || p_academic_year, 0));

  FOR item IN
    SELECT * FROM jsonb_to_recordset(p_rows) AS x(
      teacher_id UUID,
      class_id UUID,
      subject_id UUID,
      day_of_week INTEGER,
      period_number INTEGER,
      start_time TIME,
      end_time TIME,
      room TEXT
    )
  LOOP
    IF item.day_of_week NOT BETWEEN 1 AND 7 OR item.period_number < 1
       OR item.start_time IS NULL OR item.end_time IS NULL THEN
      RAISE EXCEPTION 'invalid timetable placement' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = item.class_id AND school_id = p_school_id) THEN
      RAISE EXCEPTION 'class is outside the requested school' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = item.teacher_id AND school_id = p_school_id AND is_active = true) THEN
      RAISE EXCEPTION 'teacher is outside the requested school' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.subjects WHERE id = item.subject_id AND school_id = p_school_id) THEN
      RAISE EXCEPTION 'subject is outside the requested school' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.timetable_constraints c
      JOIN public.timetable_slots s ON s.id = c.slot_id
      WHERE c.school_id = p_school_id
        AND c.teacher_id = item.teacher_id
        AND c.day_of_week = item.day_of_week
        AND s.order_number = item.period_number
    ) THEN
      RAISE EXCEPTION 'teacher is unavailable for one placement' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.teacher_timetable t
      WHERE t.academic_year = p_academic_year
        AND (
          (t.teacher_id = item.teacher_id AND t.day_of_week = item.day_of_week AND t.period_number = item.period_number)
          OR (t.class_id = item.class_id AND t.day_of_week = item.day_of_week AND t.period_number = item.period_number)
          OR (item.room IS NOT NULL AND btrim(item.room) <> '' AND t.room = btrim(item.room)
              AND t.day_of_week = item.day_of_week AND t.period_number = item.period_number)
        )
    ) THEN
      RAISE EXCEPTION 'teacher, class, or room conflict detected' USING ERRCODE = '23505';
    END IF;

    INSERT INTO public.teacher_timetable(
      teacher_id, class_id, subject_id, day_of_week, period_number,
      start_time, end_time, room, academic_year
    ) VALUES (
      item.teacher_id, item.class_id, item.subject_id, item.day_of_week,
      item.period_number, item.start_time, item.end_time, NULLIF(btrim(item.room), ''),
      p_academic_year
    );
    inserted_count := inserted_count + 1;
  END LOOP;

  INSERT INTO public.audit_log(school_id, user_id, user_name, action, module, description, new_value)
  VALUES (
    p_school_id, p_actor_id, actor_name, 'create', 'timetable',
    format('Approved generated timetable (%s lessons, %s)', inserted_count, p_academic_year),
    jsonb_build_object('academicYear', p_academic_year, 'inserted', inserted_count)
  );
  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_timetable_entries(UUID, TEXT, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_timetable_entries(UUID, TEXT, JSONB, UUID) TO service_role;

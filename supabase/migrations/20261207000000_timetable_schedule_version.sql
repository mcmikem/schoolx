-- Versioned, transactional bell-schedule replacement + generator preview storage.
-- Part of the timetable design (docs/timetable-design.md, Phase 2 / Phase 4).

CREATE TABLE IF NOT EXISTS public.timetable_schedule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  slot_hash TEXT NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS timetable_schedule_versions_unique
  ON public.timetable_schedule_versions (school_id, academic_year, version);

-- Exactly one current version per school/year.
CREATE UNIQUE INDEX IF NOT EXISTS timetable_schedule_versions_current
  ON public.timetable_schedule_versions (school_id, academic_year)
  WHERE is_current = true;

ALTER TABLE public.timetable_schedule_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School members read schedule versions" ON public.timetable_schedule_versions;
CREATE POLICY "School members read schedule versions"
  ON public.timetable_schedule_versions
  FOR SELECT TO authenticated
  USING (school_id = public.my_school_id());

CREATE TABLE IF NOT EXISTS public.timetable_generation_previews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,
  schedule_version INTEGER NOT NULL,
  assignment_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at TIMESTAMPTZ
);

ALTER TABLE public.timetable_generation_previews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Creator reads own previews" ON public.timetable_generation_previews;
CREATE POLICY "Creator reads own previews"
  ON public.timetable_generation_previews
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

-- Track which schedule version a constraint was defined against.
ALTER TABLE public.timetable_constraints
  ADD COLUMN IF NOT EXISTS schedule_version_id UUID REFERENCES public.timetable_schedule_versions(id) ON DELETE SET NULL;

-- Timetable clash checks resolve entries by year/day/period across all classes.
CREATE INDEX IF NOT EXISTS idx_teacher_timetable_year_day_period
  ON public.teacher_timetable (academic_year, day_of_week, period_number);

CREATE OR REPLACE FUNCTION public.replace_timetable_schedule(
  p_school_id UUID,
  p_academic_year TEXT,
  p_expected_version INTEGER,
  p_slots JSONB,
  p_actor_id UUID,
  p_retain_entries BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_version INTEGER;
  next_version INTEGER;
  item RECORD;
  lesson_order JSONB := '{}'::jsonb;
  slot_hash TEXT;
  actor_name TEXT;
  inserted_slots JSONB;
  inserted_constraints JSONB;
  new_version_id UUID;
BEGIN
  IF p_slots IS NULL OR jsonb_typeof(p_slots) <> 'array' OR jsonb_array_length(p_slots) = 0 THEN
    RAISE EXCEPTION 'slots must be a non-empty array' USING ERRCODE = '22023';
  END IF;

  SELECT full_name INTO actor_name
    FROM public.users
   WHERE id = p_actor_id AND school_id = p_school_id AND is_active = true;
  IF actor_name IS NULL THEN
    RAISE EXCEPTION 'actor is not active in the requested school' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_school_id::text || ':' || p_academic_year || ':schedule', 0));

  SELECT COALESCE(MAX(version), 0) INTO current_version
    FROM public.timetable_schedule_versions
   WHERE school_id = p_school_id AND academic_year = p_academic_year;

  IF p_expected_version IS NOT NULL AND current_version <> p_expected_version THEN
    RAISE EXCEPTION 'stale schedule version: expected %, current %', p_expected_version, current_version
      USING ERRCODE = '40001';
  END IF;
  next_version := current_version + 1;

  -- Lesson spot checks: name/time/order integrity and no overlapping slots.
  DECLARE
    prev_end TIME := NULL;
    row_no INTEGER := 0;
  BEGIN
    FOR item IN
      SELECT * FROM jsonb_to_recordset(p_slots) AS x(
        name TEXT,
        start_time TIME,
        end_time TIME,
        is_lesson BOOLEAN,
        order_number INTEGER
      )
    LOOP
      row_no := row_no + 1;
      IF NULLIF(btrim(COALESCE(item.name, '')), '') IS NULL THEN
        RAISE EXCEPTION 'slot % has no name', row_no USING ERRCODE = '22023';
      END IF;
      IF item.start_time IS NULL OR item.end_time IS NULL OR item.end_time <= item.start_time THEN
        RAISE EXCEPTION 'slot % has invalid times', row_no USING ERRCODE = '22023';
      END IF;
      IF item.order_number IS NOT NULL AND item.order_number <> row_no THEN
        RAISE EXCEPTION 'slot order must be sequential from 1' USING ERRCODE = '22023';
      END IF;
      IF COALESCE(item.is_lesson, true) THEN
        IF prev_end IS NOT NULL AND item.start_time < prev_end THEN
          RAISE EXCEPTION 'slots overlap at order %', row_no USING ERRCODE = '22023';
        END IF;
        lesson_order := lesson_order || jsonb_build_array(item.order_number);
      END IF;
      prev_end := GREATEST(COALESCE(prev_end, item.end_time), item.end_time);
    END LOOP;
  END;

  -- Constraints migrate by stable slot order. Existing constraint rows are
  -- read before the replacement; a client may not remap them.
  CREATE TEMP TABLE tmp_constraints_map ON COMMIT DROP AS
    SELECT c.teacher_id, c.day_of_week, s.order_number, c.constraint_type
      FROM public.timetable_constraints c
      JOIN public.timetable_slots s ON s.id = c.slot_id
     WHERE c.school_id = p_school_id
       AND s.school_id = p_school_id;

  SELECT COALESCE(jsonb_object_agg(v.value::int, true), '{}'::jsonb) INTO lesson_order
    FROM jsonb_array_elements(lesson_order) v;

  -- Every existing constraint must map onto a lesson slot of the new
  -- schedule; otherwise reject the replacement before anything changes.
  IF EXISTS (
    SELECT 1 FROM tmp_constraints_map m
     WHERE NOT (lesson_order ? m.order_number::text)
  ) THEN
    RAISE EXCEPTION 'existing constraints cannot be mapped to the new schedule'
      USING ERRCODE = '23505';
  END IF;

  -- The whole replacement is one transaction: if any step below fails, the
  -- delete/insert/audit all roll back together.
  DELETE FROM public.timetable_slots WHERE school_id = p_school_id;

  INSERT INTO public.timetable_slots(school_id, name, start_time, end_time, is_lesson, order_number)
  SELECT p_school_id, btrim(x.name), x.start_time, x.end_time, COALESCE(x.is_lesson, true), x.order_number
    FROM jsonb_to_recordset(p_slots) AS x(
      name TEXT, start_time TIME, end_time TIME, is_lesson BOOLEAN, order_number INTEGER
    );

  SELECT jsonb_agg(to_jsonb(s) - 'created_at' - 'school_id' ORDER BY s.order_number) INTO inserted_slots
    FROM public.timetable_slots s WHERE s.school_id = p_school_id;

  slot_hash := md5(inserted_slots::text);

  INSERT INTO public.timetable_schedule_versions(school_id, academic_year, version, slot_hash, is_current, created_by)
  VALUES (p_school_id, p_academic_year, next_version, slot_hash, true, p_actor_id)
  RETURNING id INTO new_version_id;

  UPDATE public.timetable_schedule_versions
     SET is_current = false
   WHERE school_id = p_school_id AND academic_year = p_academic_year AND id <> new_version_id;

  -- Re-create the migrated constraints against the new slot IDs.
  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'teacher_id', m.teacher_id,
             'day_of_week', m.day_of_week,
             'constraint_type', m.constraint_type,
             'slot_order', m.order_number
           ) ORDER BY m.day_of_week, m.order_number), '[]'::jsonb)
    INTO inserted_constraints
    FROM tmp_constraints_map m;

  IF jsonb_array_length(inserted_constraints) > 0 THEN
    WITH mapped AS (
      SELECT * FROM jsonb_to_recordset(inserted_constraints) AS m(
        teacher_id UUID, day_of_week INTEGER, constraint_type TEXT, slot_order INTEGER
      )
    )
    INSERT INTO public.timetable_constraints(
      school_id, teacher_id, day_of_week, slot_id, constraint_type, schedule_version_id
    )
    SELECT p_school_id, m.teacher_id, m.day_of_week, s.id, m.constraint_type, new_version_id
      FROM mapped m
      JOIN public.timetable_slots s
        ON s.school_id = p_school_id AND s.order_number = m.slot_order;
  END IF;

  IF COALESCE(p_retain_entries, true) = false THEN
    DELETE FROM public.teacher_timetable t
     WHERE t.academic_year = p_academic_year
       AND EXISTS (
         SELECT 1 FROM public.classes c
          WHERE c.id = t.class_id AND c.school_id = p_school_id
       );
  END IF;

  INSERT INTO public.audit_log(school_id, user_id, user_name, action, module, description, new_value)
  VALUES (
    p_school_id, p_actor_id, actor_name, 'update', 'timetable',
    format('Replaced bell schedule (version %s, %s)', next_version, p_academic_year),
    jsonb_build_object(
      'academicYear', p_academic_year,
      'previousVersion', current_version,
      'version', next_version,
      'slotCount', jsonb_array_length(p_slots),
      'retainEntries', COALESCE(p_retain_entries, true)
    )
  );

  RETURN jsonb_build_object(
    'version', next_version,
    'slots', inserted_slots,
    'constraints', inserted_constraints
  );
END;
$$;

REVOKE ALL ON FUNCTION public.replace_timetable_schedule(UUID, TEXT, INTEGER, JSONB, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_timetable_schedule(UUID, TEXT, INTEGER, JSONB, UUID, BOOLEAN) TO service_role;

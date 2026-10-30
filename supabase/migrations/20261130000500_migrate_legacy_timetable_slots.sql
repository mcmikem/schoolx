-- Auto-migrate schools still on the old short day (ends before 15:00) to the
-- Ugandan lower-secondary day (8 periods, 08:00-16:45). Only schools with no
-- scheduled lessons are touched, so existing timetables are never destroyed;
-- those schools keep the old slots and get an in-app prompt to upgrade.
DO $$
DECLARE
  sch RECORD;
  legacy BOOLEAN;
  has_lessons BOOLEAN;
  slots CONSTANT TEXT[][] := ARRAY[
    ['Assembly','08:00','08:15','false','1'],
    ['Period 1','08:15','08:55','true','2'],
    ['Period 2','08:55','09:35','true','3'],
    ['Period 3','09:35','10:15','true','4'],
    ['Break','10:15','10:35','false','5'],
    ['Period 4','10:35','11:15','true','6'],
    ['Period 5','11:15','11:55','true','7'],
    ['Period 6','11:55','12:35','true','8'],
    ['Lunch','12:35','13:35','false','9'],
    ['Period 7','13:35','14:15','true','10'],
    ['Period 8','14:15','14:55','true','11'],
    ['Games / Clubs','14:55','16:45','false','12']
  ];
  s TEXT[];
BEGIN
  FOR sch IN SELECT id FROM public.schools LOOP
    SELECT COALESCE(MAX(end_time), '00:00'::time) < '15:00'::time INTO legacy
      FROM public.timetable_slots WHERE school_id = sch.id;
    IF NOT legacy THEN CONTINUE; END IF;

    SELECT EXISTS (SELECT 1 FROM public.teacher_timetable WHERE class_id IN (SELECT id FROM public.classes WHERE school_id = sch.id)) INTO has_lessons;
    IF has_lessons THEN CONTINUE; END IF;

    DELETE FROM public.timetable_slots WHERE school_id = sch.id;

    FOREACH s SLICE 1 IN ARRAY slots LOOP
      INSERT INTO public.timetable_slots (school_id, name, start_time, end_time, is_lesson, order_number)
      VALUES (sch.id, s[1], s[2]::time, s[3]::time, s[4]::boolean, s[5]::int);
    END LOOP;
  END LOOP;
END $$;

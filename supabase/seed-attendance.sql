-- Add attendance for all students for last 10 days
DO $$
DECLARE
  student_rec RECORD;
  day_offset INTEGER;
  att_date DATE;
  random_status TEXT;
  cnt INTEGER := 0;
BEGIN
  FOR student_rec IN SELECT id, class_id FROM students ORDER BY id LOOP
    FOR day_offset IN 0..9 LOOP
      att_date := CURRENT_DATE - day_offset;
      
      -- Skip weekends
      IF EXTRACT(DOW FROM att_date) IN (0, 6) THEN
        CONTINUE;
      END IF;
      
      random_status := CASE 
        WHEN random() < 0.88 THEN 'present'
        WHEN random() < 0.94 THEN 'absent'
        WHEN random() < 0.98 THEN 'late'
        ELSE 'excused'
      END;
      
      INSERT INTO attendance (student_id, class_id, date, status)
      VALUES (student_rec.id, student_rec.class_id, att_date, random_status)
      ON CONFLICT DO NOTHING;
      
      cnt := cnt + 1;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Added % attendance records', cnt;
END $$;
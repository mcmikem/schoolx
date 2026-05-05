-- Add more events throughout the year
INSERT INTO events (school_id, title, description, event_type, start_date, end_date)
VALUES
('70ee855b-22f1-4b19-b71f-41882b17f260', 'Opening Ceremony', 'Start of academic year', 'academic', '2026-01-15', '2026-01-16'),
('70ee855b-22f1-4b19-b71f-41882b17f260', 'Mid Term Exams', 'Term 1 mid term', 'exam', '2026-02-20', '2026-02-28'),
('70ee855b-22f1-4b19-b71f-41882b17f260', 'Parents Day', 'Term 1 parents meeting', 'meeting', '2026-03-15'),
('70ee855b-22f1-4b19-b71f-41882b17f260', 'Sports Day', 'Annual sports competition', 'event', '2026-06-15'),
('70ee855b-22f1-4b19-b71f-41882b17f260', 'Music Festival', 'School music and drama', 'event', '2026-07-20'),
('70ee855b-22f1-4b19-b71f-41882b17f260', 'Science Fair', 'Science projects exhibition', 'academic', '2026-08-10'),
('70ee855b-22f1-4b19-b71f-41882b17f260', 'Independence Day', 'National holiday', 'holiday', '2026-10-09'),
('70ee855b-22f1-4b19-b71f-41882b17f260', 'Christmas Concert', 'End of year celebration', 'event', '2026-12-01'),
('70ee855b-22f1-4b19-b71f-41882b17f260', 'End of Year Exams', 'Final examinations', 'exam', '2026-11-01', '2026-11-15'),
('70ee855b-22f1-4b19-b71f-41882b17f260', 'Graduation Day', 'Primary 7 and Senior 4 graduation', 'event', '2026-11-25');

-- Add attendance for past 30 days for all students (batch of 100 at a time)
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
      
      random_status := CASE 
        WHEN random() < 0.90 THEN 'present'
        WHEN random() < 0.95 THEN 'absent'
        WHEN random() < 0.98 THEN 'late'
        ELSE 'excused'
      END;
      
      INSERT INTO attendance (student_id, class_id, date, status)
      VALUES (student_rec.id, student_rec.class_id, att_date, random_status)
      ON CONFLICT DO NOTHING;
      
      cnt := cnt + 1;
      IF cnt >= 5000 THEN
        EXIT;
      END IF;
    END LOOP;
    
    IF cnt >= 5000 THEN
      EXIT;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Added attendance records';
END $$;
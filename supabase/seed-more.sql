-- Add fee structure for all classes and terms
INSERT INTO fee_structure (school_id, class_id, name, amount, term, academic_year)
SELECT 
  '70ee855b-22f1-4b19-b71f-41882b17f260',
  id,
  'Tuition',
  CASE 
    WHEN name LIKE 'P.%' THEN 150000
    WHEN name LIKE 'S.1%' OR name LIKE 'S.2%' THEN 200000
    WHEN name LIKE 'S.3%' OR name LIKE 'S.4%' THEN 250000
    ELSE 300000
  END,
  t,
  '2026'
FROM classes
CROSS JOIN (SELECT 1 AS t UNION ALL SELECT 2 UNION ALL SELECT 3) AS terms;

-- Add Development Fee for all classes
INSERT INTO fee_structure (school_id, class_id, name, amount, term, academic_year)
SELECT 
  '70ee855b-22f1-4b19-b71f-41882b17f260',
  id,
  'Development',
  50000,
  t,
  '2026'
FROM classes
CROSS JOIN (SELECT 1 AS t UNION ALL SELECT 2 UNION ALL SELECT 3) AS terms;

-- Add Exam Fee for all classes
INSERT INTO fee_structure (school_id, class_id, name, amount, term, academic_year)
SELECT 
  '70ee855b-22f1-4b19-b71f-41882b17f260',
  id,
  'Examination',
  30000,
  t,
  '2026'
FROM classes
CROSS JOIN (SELECT 1 AS t UNION ALL SELECT 2 UNION ALL SELECT 3) AS terms;

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

-- Add timetable slots
INSERT INTO timetable_slots (school_id, name, start_time, end_time, is_lesson, order_number)
VALUES
('70ee855b-22f1-4b19-b71f-41882b17f260', 'Period 1', '08:00:00', '08:40:00', true, 1),
('70ee855b-22f1-4b19-b71f-41882b17f260', 'Period 2', '08:40:00', '09:20:00', true, 2),
('70ee855b-22f1-4b19-b71f-41882b17f260', 'Short Break', '09:20:00', '09:35:00', false, 3),
('70ee855b-22f1-4b19-b71f-41882b17f260', 'Period 3', '09:35:00', '10:15:00', true, 4),
('70ee855b-22f1-4b19-b71f-41882b17f260', 'Period 4', '10:15:00', '10:55:00', true, 5),
('70ee855b-22f1-4b19-b71f-41882b17f260', 'Long Break', '10:55:00', '11:25:00', false, 6),
('70ee855b-22f1-4b19-b71f-41882b17f260', 'Period 5', '11:25:00', '12:05:00', true, 7),
('70ee855b-22f1-4b19-b71f-41882b17f260', 'Period 6', '12:05:00', '12:45:00', true, 8),
('70ee855b-22f1-4b19-b71f-41882b17f260', 'Afternoon Break', '12:45:00', '13:15:00', false, 9),
('70ee855b-22f1-4b19-b71f-41882b17f260', 'Period 7', '13:15:00', '13:55:00', true, 10),
('70ee855b-22f1-4b19-b71f-41882b17f260', 'Period 8', '13:55:00', '14:35:00', true, 11);

-- Get first term ID
DO $$
DECLARE
  term_id UUID;
  exam_id UUID;
  subj_id UUID;
  cls_id UUID;
BEGIN
  -- Get term 1
  SELECT id INTO term_id FROM terms WHERE term_number = 1 LIMIT 1;
  
  -- Get a subject
  SELECT id INTO subj_id FROM subjects WHERE name = 'Mathematics' LIMIT 1;
  
  -- Create exams for each class
  FOR cls_id IN SELECT id FROM classes LOOP
    INSERT INTO exams (school_id, name, exam_type, class_id, subject_id, exam_date, max_score, academic_year)
    VALUES ('70ee855b-22f1-4b19-b71f-41882b17f260', 'End of Term 1', 'eot', cls_id, subj_id, '2026-04-05', 100, '2026')
    RETURNING id INTO exam_id;
    
    -- Add some exam scores for first 10 students in each class
    INSERT INTO exam_scores (student_id, subject_id, class_id, exam_type, exam_id, score, max_score, term, academic_year)
    SELECT s.id, subj_id, cls_id, 'eot', exam_id, (random() * 40 + 60)::numeric(5,2), 100, 1, '2026'
    FROM students s
    WHERE s.class_id = cls_id
    LIMIT 10;
  END LOOP;
END $$;

-- Add attendance for past 30 days for all students
DO $$
DECLARE
  student_rec RECORD;
  day_offset INTEGER;
  att_date DATE;
  random_status TEXT;
BEGIN
  FOR student_rec IN SELECT id, class_id FROM students LOOP
    FOR day_offset IN 0..29 LOOP
      att_date := CURRENT_DATE - day_offset;
      
      -- Random attendance status (90% present, 5% absent, 3% late, 2% excused)
      random_status := CASE 
        WHEN random() < 0.90 THEN 'present'
        WHEN random() < 0.95 THEN 'absent'
        WHEN random() < 0.98 THEN 'late'
        ELSE 'excused'
      END;
      
      INSERT INTO attendance (student_id, class_id, date, status)
      VALUES (student_rec.id, student_rec.class_id, att_date, random_status)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Add teacher timetable entries for Monday
DO $$
DECLARE
  teacher_rec RECORD;
  class_rec RECORD;
  subj_rec RECORD;
  period_num INTEGER;
BEGIN
  FOR teacher_rec IN SELECT id FROM users WHERE role = 'teacher' LOOP
    FOR class_rec IN SELECT id FROM classes ORDER BY random() LIMIT 5 LOOP
      -- Get a random subject for this class
      SELECT id INTO subj_rec FROM subjects ORDER BY random() LIMIT 1;
      
      -- Add 3 periods on Monday
      FOR period_num IN 1..3 LOOP
        INSERT INTO teacher_timetable (teacher_id, class_id, subject_id, day_of_week, period_number, start_time, end_time, room, academic_year)
        VALUES (
          teacher_rec.id,
          class_rec.id,
          subj_rec.id,
          1, -- Monday
          period_num,
          (ARRAY['08:00:00', '09:35:00', '11:25:00'])[period_num],
          (ARRAY['08:40:00', '09:20:00', '10:15:00'])[period_num],
          'Room ' || floor(random() * 10 + 1),
          '2026'
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
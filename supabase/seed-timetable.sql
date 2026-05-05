-- Add teacher timetable entries
INSERT INTO teacher_timetable (teacher_id, class_id, subject_id, day_of_week, period_number, start_time, end_time, room, academic_year)
SELECT 
  u.id,
  c.id,
  s.id,
  d.day,
  d.period,
  (ARRAY['08:00'::time, '08:40'::time, '09:35'::time, '10:15'::time, '11:25'::time, '12:05'::time, '13:15'::time, '13:55'::time])[d.period],
  (ARRAY['08:40'::time, '09:20'::time, '10:15'::time, '10:55'::time, '12:05'::time, '12:45'::time, '13:55'::time, '14:35'::time])[d.period],
  'Room ' || floor(random() * 8 + 1),
  '2026'
FROM users u
CROSS JOIN (SELECT id FROM classes WHERE name IN ('P.1A', 'S.1A', 'S.2A', 'S.3A', 'S.4A')) c
CROSS JOIN (SELECT id FROM subjects WHERE name IN ('Mathematics', 'English', 'Science', 'Social Studies')) s
CROSS JOIN (SELECT day, period FROM (VALUES (1,1), (1,2), (1,3), (2,1), (2,2), (2,3), (3,1), (3,2), (3,3), (4,1), (4,2), (4,3), (5,1), (5,2), (5,3)) AS t(day, period)) d
WHERE u.role = 'teacher'
LIMIT 50;
-- ============================================
-- OMUTO SMS - SEED DATA
-- Run after schema.sql to populate default data
-- ============================================

-- Create a demo school
INSERT INTO schools (id, name, school_code, district, subcounty, school_type, ownership, phone, subscription_plan, subscription_status, trial_ends_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Demo Primary School',
  'DEMO001',
  'Kampala',
  'Central Division',
  'primary',
  'private',
  '0700000000',
  'free',
  'trial',
  NOW() + INTERVAL '30 days'
) ON CONFLICT DO NOTHING;

-- Create demo classes
INSERT INTO classes (school_id, name, level, max_students, academic_year) VALUES
('00000000-0000-0000-0000-000000000001', 'P.1A', 'P.1', 60, '2026'),
('00000000-0000-0000-0000-000000000001', 'P.2A', 'P.2', 60, '2026'),
('00000000-0000-0000-0000-000000000001', 'P.3A', 'P.3', 60, '2026'),
('00000000-0000-0000-0000-000000000001', 'P.4A', 'P.4', 60, '2026'),
('00000000-0000-0000-0000-000000000001', 'P.5A', 'P.5', 60, '2026'),
('00000000-0000-0000-0000-000000000001', 'P.5B', 'P.5', 60, '2026'),
('00000000-0000-0000-0000-000000000001', 'P.6A', 'P.6', 60, '2026'),
('00000000-0000-0000-0000-000000000001', 'P.7A', 'P.7', 60, '2026')
ON CONFLICT DO NOTHING;

-- Create primary school subjects
INSERT INTO subjects (school_id, name, code, level, is_compulsory) VALUES
('00000000-0000-0000-0000-000000000001', 'English Language', 'ENG', 'primary', true),
('00000000-0000-0000-0000-000000000001', 'Mathematics', 'MATH', 'primary', true),
('00000000-0000-0000-0000-000000000001', 'Integrated Science', 'SCI', 'primary', true),
('00000000-0000-0000-0000-000000000001', 'Social Studies', 'SST', 'primary', true),
('00000000-0000-0000-0000-000000000001', 'Religious Education', 'RE', 'primary', true),
('00000000-0000-0000-0000-000000000001', 'Local Language', 'LL', 'primary', true),
('00000000-0000-0000-0000-000000000001', 'Kiswahili', 'KIS', 'primary', true),
('00000000-0000-0000-0000-000000000001', 'CAPE (Music, Dance & Drama)', 'CAPE1', 'primary', true),
('00000000-0000-0000-0000-000000000001', 'CAPE (Physical Education)', 'CAPE2', 'primary', true),
('00000000-0000-0000-0000-000000000001', 'CAPE (Arts & Technology)', 'CAPE3', 'primary', true)
ON CONFLICT DO NOTHING;

-- Create sample students
INSERT INTO students (school_id, student_number, first_name, last_name, gender, date_of_birth, parent_name, parent_phone, class_id)
SELECT
  '00000000-0000-0000-0000-000000000001',
  'STU' || LPAD(ROW_NUMBER() OVER()::text, 5, '0'),
  first_names.name,
  last_names.name,
  genders.gender,
  '2015-01-01'::date + (random() * 1000)::int * interval '1 day',
  parent_names.name,
  '07' || LPAD((random() * 99999999)::int::text, 8, '0'),
  (SELECT id FROM classes WHERE school_id = '00000000-0000-0000-0000-000000000001' ORDER BY random() LIMIT 1)
FROM
  (VALUES ('Sarah'), ('Grace'), ('Betty'), ('Esther'), ('Florence'), ('Mary'), ('Agnes'), ('Jane'), ('Ruth'), ('Mercy')) AS first_names(name)
CROSS JOIN
  (VALUES ('Nakato'), ('Namugala'), ('Auma'), ('Nalwoga'), ('Akello'), ('Nakamya'), ('Nabirye'), ('Nansubuga'), ('Nalwadda'), ('Nabukeera')) AS last_names(name)
CROSS JOIN
  (VALUES ('F')) AS genders(gender)
CROSS JOIN
  (VALUES ('James'), ('Joseph'), ('David'), ('Francis'), ('Patrick'), ('Paul'), ('Samuel'), ('Daniel'), ('Robert'), ('Charles')) AS parent_names(name)
LIMIT 20
ON CONFLICT DO NOTHING;

-- Create sample fee structure
INSERT INTO fee_structure (school_id, class_id, name, amount, term, academic_year, due_date)
SELECT
  '00000000-0000-0000-0000-000000000001',
  c.id,
  fees.name,
  fees.amount,
  1,
  '2026',
  '2026-03-31'
FROM classes c
CROSS JOIN (
  VALUES ('Tuition', 150000), ('Development', 30000), ('Exam Fee', 20000), ('Lunch', 50000)
) AS fees(name, amount)
WHERE c.school_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;

-- Create sample events
INSERT INTO events (school_id, title, event_type, start_date, description) VALUES
('00000000-0000-0000-0000-000000000001', 'End of Term 1 Exams', 'exam', '2026-03-15', 'Final examinations for Term 1'),
('00000000-0000-0000-0000-000000000001', 'Parent-Teacher Meeting', 'meeting', '2026-03-22', 'Discuss student progress with parents'),
('00000000-0000-0000-0000-000000000001', 'Report Card Distribution', 'academic', '2026-03-28', 'Parents collect report cards'),
('00000000-0000-0000-0000-000000000001', 'Term 2 Opens', 'term', '2026-04-05', 'School reopens for Term 2'),
('00000000-0000-0000-0000-000000000001', 'Sports Day', 'event', '2026-04-10', 'Annual inter-house sports competition'),
('00000000-0000-0000-0000-000000000001', 'Labour Day', 'holiday', '2026-05-01', 'Public holiday - school closed')
ON CONFLICT DO NOTHING;

-- P1-P3 Thematic Curriculum Integration (NCDC Uganda)
-- Maps the 12 P1 themes to lesson_plans for pilot use.
-- Based on: The National Primary School Curriculum for Uganda, Primary 1 (NCDC, 2024)
-- Pilot: Demo School, P1, Term 1

-- ============================================================
-- STEP 1: Create P1 class for the Demo School
-- ============================================================
-- The class uses the first school (Demo School) and creates a P1 section.

DO $$
DECLARE
  demo_school_id UUID;
  p1_class_id UUID;
  english_subject_id UUID;
  math_subject_id UUID;
BEGIN
  -- Get the first school (Demo School)
  SELECT id INTO demo_school_id FROM schools ORDER BY id LIMIT 1;

  -- Get the first two subjects (English Language and Mathematics) by id order
  SELECT id INTO english_subject_id FROM subjects ORDER BY id LIMIT 1;
  SELECT id INTO math_subject_id FROM subjects ORDER BY id LIMIT 1 OFFSET 1;

  -- Create P1 class for the Demo School
  INSERT INTO classes (school_id, name, level, stream, academic_year, max_students)
  VALUES (
    demo_school_id,
    'P.1A',
    'P.1',
    NULL,
    '2025-2026',
    50
  )
  RETURNING id INTO p1_class_id;

  RAISE NOTICE 'Created P1 class % for school %', p1_class_id, demo_school_id;
END $$;

-- ============================================================
-- STEP 2: Insert lesson_plans for P1 Themes (Term 1)
-- ============================================================

-- Theme 1: Our School
INSERT INTO lesson_plans (
  school_id, subject_id, class_id, topic, lesson_title, objectives,
  materials, procedure, duration, term, academic_year,
  week_number, lesson_number, subtopics, materials_needed, assessment, status, teaching_method, homework
) VALUES (
  (SELECT id FROM schools ORDER BY id LIMIT 1),
  (SELECT id FROM subjects ORDER BY id LIMIT 1), -- English Language
  (SELECT id FROM classes ORDER BY id LIMIT 1), -- P1A
  'Our School',
  'Our School',
  'Understand school environment and routines; identify key school areas',
  'Wall charts, school map, pictures of school building',
  'Introduce school areas; guided tour of school; class discussion on school rules',
  45, 1, '2025-2026',
  1, 1,
  '["classrooms", "office", "playground", "library"]',
  'School map, pictures',
  'Identify school areas',
  'active', 'discussion', 'draw your school'
);

-- Theme 2: Our Home
INSERT INTO lesson_plans (
  school_id, subject_id, class_id, topic, lesson_title, objectives,
  materials, procedure, duration, term, academic_year,
  week_number, lesson_number, subtopics, materials_needed, assessment, status, teaching_method, homework
) VALUES (
  (SELECT id FROM schools ORDER BY id LIMIT 1),
  (SELECT id FROM subjects ORDER BY id LIMIT 1),
  (SELECT id FROM classes ORDER BY id LIMIT 1),
  'Our Home',
  'Our Home',
  'Identify home types and family members; describe home activities',
  'Family pictures, home photos, local materials',
  'Show and tell home types; family member roles; drawing my home',
  45, 1, '2025-2026',
  1, 2,
  '["house type", "family members", "home activities"]',
  'Family photos, drawing paper',
  'Describe home type',
  'active', 'show and tell', 'draw your home'
);

-- Theme 3: Our Community
INSERT INTO lesson_plans (
  school_id, subject_id, class_id, topic, lesson_title, objectives,
  materials, procedure, duration, term, academic_year,
  week_number, lesson_number, subtopics, materials_needed, assessment, status, teaching_method, homework
) VALUES (
  (SELECT id FROM schools ORDER BY id LIMIT 1),
  (SELECT id FROM subjects ORDER BY id LIMIT 1),
  (SELECT id FROM classes ORDER BY id LIMIT 1),
  'Our Community',
  'Our Community',
  'Know important places in the community; relate harmoniously with others',
  'Community photos, maps, pictures of local shops',
  'Identify community places; discuss roles of people; map our community',
  45, 1, '2025-2026',
  1, 3,
  '["shopkeeper", "teacher", "doctor", "important places"]',
  'Community photos, map',
  'Name a community place',
  'active', 'discussion', 'community map'
);

-- Theme 4: The Human Body and Health
INSERT INTO lesson_plans (
  school_id, subject_id, class_id, topic, lesson_title, objectives,
  materials, procedure, duration, term, academic_year,
  week_number, lesson_number, subtopics, materials_needed, assessment, status, teaching_method, homework
) VALUES (
  (SELECT id FROM schools ORDER BY id LIMIT 1),
  (SELECT id FROM subjects ORDER BY id LIMIT 1),
  (SELECT id FROM classes ORDER BY id LIMIT 1),
  'The Human Body and Health',
  'The Human Body and Health',
  'Identify body parts and their uses; practice personal hygiene',
  'Body part flashcards, hygiene items (soap, comb)',
  'Name body parts; demonstrate washing hands; discuss health habits',
  45, 1, '2025-2026',
  1, 4,
  '["external body parts", "hygiene items"]',
  'Flashcards, soap, comb',
  'Name a body part and its use',
  'active', 'direct instruction', 'hygiene chart'
);

-- Theme 5: Weather
INSERT INTO lesson_plans (
  school_id, subject_id, class_id, topic, lesson_title, objectives,
  materials, procedure, duration, term, academic_year,
  week_number, lesson_number, subtopics, materials_needed, assessment, status, teaching_method, homework
) VALUES (
  (SELECT id FROM schools ORDER BY id LIMIT 1),
  (SELECT id FROM subjects ORDER BY id LIMIT 1),
  (SELECT id FROM classes ORDER BY id LIMIT 1),
  'Weather',
  'Weather',
  'Identify elements and types of weather; appreciate weather effects',
  'Sun/cloud/wind pictures, weather chart',
  'Identify weather elements; sort weather types; daily weather chart',
  45, 1, '2025-2026',
  1, 5,
  '["sun", "rain", "clouds", "wind"]',
  'Weather pictures, chart',
    'Name weather type',
  'active', 'hands-on', 'weather diary'
);

-- Theme 6: Accidents and Safety
INSERT INTO lesson_plans (
  school_id, subject_id, class_id, topic, lesson_title, objectives,
  materials, procedure, duration, term, academic_year,
  week_number, lesson_number, subtopics, materials_needed, assessment, status, teaching_method, homework
) VALUES (
  (SELECT id FROM schools ORDER BY id LIMIT 1),
  (SELECT id FROM subjects ORDER BY id LIMIT 1),
  (SELECT id FROM classes ORDER BY id LIMIT 1),
  'Accidents and Safety',
  'Accidents and Safety',
  'Identify common accidents at home; understand safety precautions',
  'First aid box items, pictures of accidents',
  'Discuss accidents (burns, cuts, falls); safety rules; first aid demo',
  45, 1, '2025-2026',
  1, 6,
  '["accidents at home", "safety precautions", "first aid"]',
  'First aid box items, pictures',
  'Name a safety precaution',
  'active', 'discussion', 'safety rules list'
);

-- Theme 7: Living Together
INSERT INTO lesson_plans (
  school_id, subject_id, class_id, topic, lesson_title, objectives,
  materials, procedure, duration, term, academic_year,
  week_number, lesson_number, subtopics, materials_needed, assessment, status, teaching_method, homework
) VALUES (
  (SELECT id FROM schools ORDER BY id LIMIT 1),
  (SELECT id FROM subjects ORDER BY id LIMIT 1),
  (SELECT id FROM classes ORDER BY id LIMIT 1),
  'Living Together',
  'Living Together',
  'Identify people in community; appreciate ways of living harmoniously',
  'Pictures of people working together, role-play props',
  'Discuss living together; sharing; cooperation games',
  45, 1, '2025-2026',
  1, 7,
  '["cooperation", "sharing", "living harmoniously"]',
  'Role-play props, pictures',
  'Name one way to live together',
  'active', 'group activity', 'sharing story'
);

-- Theme 8: Food and Nutrition
INSERT INTO lesson_plans (
  school_id, subject_id, class_id, topic, lesson_title, objectives,
  materials, procedure, duration, term, academic_year,
  week_number, lesson_number, subtopics, materials_needed, assessment, status, teaching_method, homework
) VALUES (
  (SELECT id FROM schools ORDER BY id LIMIT 1),
  (SELECT id FROM subjects ORDER BY id LIMIT 1),
  (SELECT id FROM classes ORDER BY id LIMIT 1),
  'Food and Nutrition',
  'Food and Nutrition',
  'Identify food sources; demonstrate keeping food safe',
  'Food pictures, sorting cards',
  'Sort foods by source; discuss food safety; balanced meal drawing',
  45, 1, '2025-2026',
  1, 8,
  '["food sources", "food safety"]',
  'Food pictures, sorting cards',
  'Name a food source',
  'active', 'sorting activity', 'meal plan'
);

-- Theme 9: Clothing
INSERT INTO lesson_plans (
  school_id, subject_id, class_id, topic, lesson_title, objectives,
  materials, procedure, duration, term, academic_year,
  week_number, lesson_number, subtopics, materials_needed, assessment, status, teaching_method, homework
) VALUES (
  (SELECT id FROM schools ORDER BY id LIMIT 1),
  (SELECT id FROM subjects ORDER BY id LIMIT 1),
  (SELECT id FROM classes ORDER BY id LIMIT 1),
  'Clothing',
  'Clothing',
  'Identify types of clothing; care for clothes; appropriate clothing for weather',
  'Pictures of clothes, fabric samples',
  'Sort clothes by type; discuss care; dress for weather activity',
  45, 1, '2025-2026',
  1, 9,
  '["clothing types", "care for clothes"]',
  'Fabric samples, pictures',
    'Identify clothing type',
  'active', 'sorting activity', 'clothing checklist'
);

-- Theme 10: Family Living
INSERT INTO lesson_plans (
  school_id, subject_id, class_id, topic, lesson_title, objectives,
  materials, procedure, duration, term, academic_year,
  week_number, lesson_number, subtopics, materials_needed, assessment, status, teaching_method, homework
) VALUES (
  (SELECT id FROM schools ORDER BY id LIMIT 1),
  (SELECT id FROM subjects ORDER BY id LIMIT 1),
  (SELECT id FROM classes ORDER BY id LIMIT 1),
  'Family Living',
  'Family Living',
  'Identify family members and roles; appreciate family responsibilities',
  'Family tree charts, family photos',
  'Draw family tree; discuss family roles; responsibilities at home',
  45, 1, '2025-2026',
  1, 10,
  '["family members", "family roles"]',
  'Family tree charts, photos',
  'Name a family member',
  'active', 'drawing activity', 'family talk'
);

-- Theme 11: Conservation
INSERT INTO lesson_plans (
  school_id, subject_id, class_id, topic, lesson_title, objectives,
  materials, procedure, duration, term, academic_year,
  week_number, lesson_number, subtopics, materials_needed, assessment, status, teaching_method, homework
) VALUES (
  (SELECT id FROM schools ORDER BY id LIMIT 1),
  (SELECT id FROM subjects ORDER BY id LIMIT 1),
  (SELECT id FROM classes ORDER BY id LIMIT 1),
  'Conservation',
  'Conservation',
  'Understand environment care; practice simple conservation actions',
  'Pictures of environment, planting seeds',
  'Discuss environment; plant seeds; keep classroom clean',
  45, 1, '2025-2026',
  1, 11,
  '["environment care", "conservation actions"]',
  'Pictures, planting seeds',
  'Name one conservation action',
  'active', 'direct instruction', 'conservation pledge'
);

-- Theme 12: Environmental Care
INSERT INTO lesson_plans (
  school_id, subject_id, class_id, topic, lesson_title, objectives,
  materials, procedure, duration, term, academic_year,
  week_number, lesson_number, subtopics, materials_needed, assessment, status, teaching_method, homework
) VALUES (
  (SELECT id FROM schools ORDER BY id LIMIT 1),
  (SELECT id FROM subjects ORDER BY id LIMIT 1),
  (SELECT id FROM classes ORDER BY id LIMIT 1),
  'Environmental Care',
  'Environmental Care',
  'Identify ways to care for the environment; keep surroundings clean',
  'Pictures of clean/unclean environment, gloves',
  'Discuss environment care; clean-up activity; sorting waste',
  45, 1, '2025-2026',
  1, 12,
  '["environment care", "keeping clean"]',
  'Pictures, gloves, waste sorting cards',
  'Name one way to care for environment',
  'active', 'hands-on activity', 'clean-up checklist'
);
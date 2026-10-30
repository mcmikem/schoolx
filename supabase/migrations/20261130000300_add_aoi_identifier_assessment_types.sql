ALTER TABLE public.grades
  DROP CONSTRAINT IF EXISTS grades_assessment_type_check;

ALTER TABLE public.grades
  ADD CONSTRAINT grades_assessment_type_check
  CHECK (
    assessment_type IN (
      'ca1', 'ca2', 'ca3', 'ca4', 'class_test', 'saturday',
      'project', 'exam', 'competency', 'u1', 'u2', 'eot', 'bot', 'mid_term',
      'holiday_package', 'hpg', 'mock', 'mock_exam', 'aoi', 'identifier_score'
    )
  );

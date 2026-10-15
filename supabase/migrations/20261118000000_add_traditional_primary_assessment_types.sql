ALTER TABLE grades DROP CONSTRAINT IF EXISTS grades_assessment_type_check;

ALTER TABLE grades
  ADD CONSTRAINT grades_assessment_type_check
  CHECK (assessment_type IN ('ca1', 'ca2', 'ca3', 'ca4', 'project', 'exam', 'competency', 'u1', 'u2', 'eot', 'bot', 'mid_term'));

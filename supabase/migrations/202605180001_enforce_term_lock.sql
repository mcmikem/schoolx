-- Migration: Enforce Term Lock on grades and exam_scores
-- Date: 2026-05-18

CREATE OR REPLACE FUNCTION check_term_lock()
RETURNS TRIGGER AS $$
DECLARE
  v_school_id UUID;
  v_lock_key TEXT;
  v_is_locked BOOLEAN;
BEGIN
  -- Get school_id for the student
  SELECT school_id INTO v_school_id FROM students WHERE id = NEW.student_id;
  
  -- Construct the lock key
  v_lock_key := 'term_locked_' || NEW.academic_year || '_' || NEW.term;
  
  -- Check if locked
  SELECT (value = 'true') INTO v_is_locked 
  FROM school_settings 
  WHERE school_id = v_school_id AND key = v_lock_key;
  
  IF v_is_locked THEN
    RAISE EXCEPTION 'This term is locked for this school. Academic data cannot be modified.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_term_lock_exam_scores ON exam_scores;
CREATE TRIGGER enforce_term_lock_exam_scores
BEFORE INSERT OR UPDATE ON exam_scores
FOR EACH ROW EXECUTE FUNCTION check_term_lock();

DROP TRIGGER IF EXISTS enforce_term_lock_grades ON grades;
CREATE TRIGGER enforce_term_lock_grades
BEFORE INSERT OR UPDATE ON grades
FOR EACH ROW EXECUTE FUNCTION check_term_lock();

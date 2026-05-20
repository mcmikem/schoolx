-- Migration: Enforce Payment Date on fee_payments
-- Date: 2026-05-18

CREATE OR REPLACE FUNCTION check_payment_date()
RETURNS TRIGGER AS $$
DECLARE
  v_school_id UUID;
  v_current_term_start DATE;
  v_user_role TEXT;
BEGIN
  -- Get school_id for the student
  SELECT school_id INTO v_school_id FROM students WHERE id = NEW.student_id;
  
  -- Get current term start date
  SELECT start_date INTO v_current_term_start 
  FROM academic_terms 
  WHERE school_id = v_school_id AND is_current = true
  LIMIT 1;
  
  -- Get user role
  SELECT role INTO v_user_role FROM users WHERE auth_id = auth.uid() LIMIT 1;
  
  -- If not admin, check date
  IF v_user_role NOT IN ('school_admin', 'headmaster', 'admin', 'super_admin') THEN
    IF NEW.payment_date < v_current_term_start THEN
      RAISE EXCEPTION 'Cannot backdate payments to previous terms.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_payment_date ON fee_payments;
CREATE TRIGGER enforce_payment_date
BEFORE INSERT OR UPDATE ON fee_payments
FOR EACH ROW EXECUTE FUNCTION check_payment_date();

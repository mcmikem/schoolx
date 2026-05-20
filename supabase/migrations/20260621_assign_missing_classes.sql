-- Migration: Assign missing classes to students without a class assignment
-- This migration assigns a default class to students where class_id is NULL.
-- It selects the first existing class for the student's school.
-- NOTE: This is a simplistic approach; adjust logic as needed for business rules.

DO $$
DECLARE
  rec RECORD;
  default_class_id UUID;
BEGIN
  FOR rec IN SELECT id, school_id FROM students WHERE class_id IS NULL LOOP
    SELECT id INTO default_class_id FROM classes
      WHERE school_id = rec.school_id
      ORDER BY created_at ASC LIMIT 1;
    IF default_class_id IS NOT NULL THEN
      UPDATE students SET class_id = default_class_id WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;

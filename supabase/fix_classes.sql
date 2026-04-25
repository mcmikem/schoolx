-- Add unique constraint after removing duplicates
ALTER TABLE public.classes ADD CONSTRAINT classes_school_name_year_unique UNIQUE (school_id, name, academic_year);
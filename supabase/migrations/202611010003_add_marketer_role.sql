-- Add marketer role to users table role check constraint
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('super_admin', 'school_admin', 'admin', 'headmaster', 'board', 'dean_of_studies', 'bursar', 'teacher', 'secretary', 'dorm_master', 'student', 'parent', 'marketer'));

-- Add indexes for frequently queried columns to improve query performance
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'students'
			AND column_name = 'phone'
	) THEN
		EXECUTE 'CREATE INDEX IF NOT EXISTS idx_students_phone ON public.students(phone)';
	END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date);
CREATE INDEX IF NOT EXISTS idx_grades_student_id ON public.grades(student_id);

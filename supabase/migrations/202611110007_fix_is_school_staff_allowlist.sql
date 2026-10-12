-- Restore the four legitimate staff roles the is_school_staff() allowlist
-- dropped, and remove two entries that cannot exist.
--
-- users.role's CHECK constraint allows: super_admin, school_admin, admin,
-- headmaster, board, dean_of_studies, bursar, teacher, secretary, dorm_master
-- (plus student/parent/marketer). The UI grants these roles real permissions
-- (src/lib/roles.ts: dean_of_studies.discipline, dorm_master.dorm_*,
-- bursar/secretary staff pages), but the RLS helper — which gates every
-- is_school_school-staff write policy for discipline, dorms, dorm_students,
-- dorm_rooms, dorm_incidents, lesson_plans, inventory_transactions — only
-- counted school_admin/headmaster/admin/super_admin/teacher plus the dead
-- entries class_teacher and deputy_head that the CHECK constraint rejects.
-- Result: dean, bursar, secretary and dorm master saw their pages in the UI
-- and got "permission denied" from the database on every write.
--
-- This restores the full employee set (including board) and drops the two
-- impossible role strings.

CREATE OR REPLACE FUNCTION is_school_staff(p_school_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
      AND school_id = p_school_id
      AND role IN (
        'school_admin', 'headmaster', 'admin', 'super_admin', 'board',
        'dean_of_studies', 'bursar', 'teacher', 'secretary', 'dorm_master'
      )
  )
$$;

-- ============================================
-- Close teacher privilege-escalation holes
-- ============================================
-- Found auditing the teacher build end-to-end. Each was a UI-level miss: the
-- control rendered for every role and the underlying policy was permissive, so
-- the write succeeded regardless of role.
--
-- 1. teacher_timetable — "FOR ALL" to any authenticated user in the school, so
--    a teacher could add/remove any lesson in any class timetable.
-- 2. students.parent_*  — the guardian block on the student profile wrote
--    straight to the students row. Row-level RLS cannot express "this role may
--    edit the record but not the guardian contact", hence the trigger.
-- 3. parent_students  — "FOR ALL" to authenticated; links parents to children.
-- 4. health_records   — "FOR ALL" to authenticated; a teacher could discharge
--    or DELETE another child's medical record.
--
-- All service-role paths (register, setup, create-parent-portal) bypass RLS
-- and are explicitly allowed through the students trigger, so onboarding is
-- unaffected.

-- ────────────────────────────────────────────
-- 1. teacher_timetable: reads stay school-wide, writes become admin/DOS only.
-- ────────────────────────────────────────────
DROP POLICY IF EXISTS "School users teacher_timetable all" ON teacher_timetable;

CREATE POLICY "School users teacher_timetable select" ON teacher_timetable
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM users u
  WHERE u.id = teacher_timetable.teacher_id
    AND u.school_id = my_school_id()
));

CREATE POLICY "Admins manage teacher_timetable" ON teacher_timetable
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.auth_id = auth.uid()
      AND u.school_id = my_school_id()
      AND u.role IN ('super_admin', 'school_admin', 'admin', 'headmaster', 'dean_of_studies')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.auth_id = auth.uid()
      AND u.school_id = my_school_id()
      AND u.role IN ('super_admin', 'school_admin', 'admin', 'headmaster', 'dean_of_studies')
  )
);

-- ────────────────────────────────────────────
-- 3. parent_students: staff may read links, only admins may create/drop them.
-- ────────────────────────────────────────────
DROP POLICY IF EXISTS "School users parent_students write" ON parent_students;

CREATE POLICY "Admins manage parent_students" ON parent_students
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.auth_id = auth.uid()
      AND u.school_id = my_school_id()
      AND u.role IN ('super_admin', 'school_admin', 'admin', 'headmaster', 'secretary')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.auth_id = auth.uid()
      AND u.school_id = my_school_id()
      AND u.role IN ('super_admin', 'school_admin', 'admin', 'headmaster', 'secretary')
  )
);

-- ────────────────────────────────────────────
-- 4. health_records: a teacher may log a visit, but not run the sick bay.
--    Admit/discharge/refer/amend/delete are clinical record actions.
-- ────────────────────────────────────────────
DROP POLICY IF EXISTS "School users health_records all" ON health_records;

CREATE POLICY "School staff read health_records" ON health_records
FOR SELECT TO authenticated
USING (school_id = my_school_id());

CREATE POLICY "Admins manage health_records" ON health_records
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.auth_id = auth.uid()
      AND u.school_id = my_school_id()
      AND u.role IN ('super_admin', 'school_admin', 'admin', 'headmaster', 'bursar', 'secretary')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.auth_id = auth.uid()
      AND u.school_id = my_school_id()
      AND u.role IN ('super_admin', 'school_admin', 'admin', 'headmaster', 'bursar', 'secretary')
  )
);

-- A child unwell in class has to be recorded now, so teachers keep INSERT.
CREATE POLICY "Teachers log health visits" ON health_records
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.auth_id = auth.uid()
      AND u.school_id = my_school_id()
      AND u.role IN ('teacher', 'class_teacher')
  )
);

-- ────────────────────────────────────────────
-- 2. students: protect the guardian contact columns.
--    Row-level RLS cannot scope to columns, so a BEFORE UPDATE trigger reverts
--    them for anyone who is not an admin. Service role (register/setup) passes
--    through untouched.
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION guard_student_guardian_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_allows BOOLEAN;
BEGIN
  -- Service role (onboarding, imports, the parent-portal flow) is trusted.
  IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM users u
    WHERE u.auth_id = auth.uid()
      AND u.school_id = my_school_id()
      AND u.role IN ('super_admin', 'school_admin', 'admin', 'headmaster', 'secretary')
  ) INTO caller_allows;

  IF NOT caller_allows THEN
    NEW.parent_name    := OLD.parent_name;
    NEW.parent_phone   := OLD.parent_phone;
    NEW.parent_phone2  := OLD.parent_phone2;
    NEW.parent_email   := OLD.parent_email;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_student_guardian_columns ON students;
CREATE TRIGGER trg_guard_student_guardian_columns
BEFORE UPDATE ON students
FOR EACH ROW
EXECUTE FUNCTION guard_student_guardian_columns();
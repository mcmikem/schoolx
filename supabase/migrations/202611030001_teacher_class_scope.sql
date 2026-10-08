-- Teacher accounts: scope class-level data to the classes the teacher actually
-- teaches.
--
-- Why: RLS gated every academic table on `school_id = my_school_id() AND
-- is_staff_role()`, and is_staff_role() is true for every role except
-- parent/student — so a teacher could read and write every student, mark,
-- register, homework assignment and report card in the school from the
-- browser. The only class-ownership columns in the schema
-- (classes.class_teacher_id, teacher_subjects) were referenced by no policy.
--
-- Blast radius: only roles 'teacher' and 'class_teacher' change. Every other
-- role keeps the predicate it has today, because in_teachers_scope() short-
-- circuits to TRUE for them. Parents/students keep the my_student_ids() branch.
--
-- Schema drift: these tables accumulated policies from a dozen files
-- ("Users can view grades" was USING (true), "School users access own school
-- grades" was an unrestricted FOR ALL, …) and permissive policies OR together,
-- so narrowing one policy changes nothing. Every policy name ever created on
-- the tables below is dropped first, then one canonical set is created.

-- ─── helpers ────────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.my_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1
$$;

-- Roles whose data access follows their class assignments instead of the
-- whole school.
CREATE OR REPLACE FUNCTION public.is_class_scoped_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
      AND role IN ('teacher', 'class_teacher')
  )
$$;

-- Classes the caller teaches: the class they lead plus every class linked to
-- them in teacher_subjects. SECURITY DEFINER so the lookup does not recurse
-- through the class policies this migration rewrites.
CREATE OR REPLACE FUNCTION public.my_assigned_class_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.classes WHERE class_teacher_id = my_user_id()
  UNION
  SELECT class_id FROM public.teacher_subjects
  WHERE teacher_id = my_user_id() AND class_id IS NOT NULL
$$;

-- The single predicate every class-level policy below uses.
--   * non-teachers (admin, dean, bursar, secretary, parent, student) -> TRUE,
--     i.e. exactly today's behaviour;
--   * teachers -> when the row carries a class_id it must be a class they
--     teach, and that column wins outright (WITH CHECK re-reads the row, so
--     falling back to the student's class would let a teacher move a student
--     into a class they do not teach). Only rows with no class_id are matched
--     through the student's current class.
CREATE OR REPLACE FUNCTION public.in_teachers_scope(
  p_class_id uuid,
  p_student_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NOT is_class_scoped_role()
      OR (
        CASE
          WHEN p_class_id IS NOT NULL THEN
            p_class_id IN (SELECT my_assigned_class_ids())
          WHEN p_student_id IS NOT NULL THEN EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = p_student_id
              AND s.class_id IN (SELECT my_assigned_class_ids())
          )
          ELSE false
        END
      )
$$;

REVOKE ALL ON FUNCTION public.my_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_class_scoped_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_assigned_class_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.in_teachers_scope(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_class_scoped_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_assigned_class_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.in_teachers_scope(uuid, uuid) TO authenticated;

-- class_teacher_id was never indexed; every policy evaluation scans it.
CREATE INDEX IF NOT EXISTS idx_classes_class_teacher
  ON public.classes (class_teacher_id);

-- ─── drop every policy ever created on these tables ──────────────────────────────────────────────

-- attendance
DROP POLICY IF EXISTS "Demo attendance read anon" ON attendance;
DROP POLICY IF EXISTS "School data access" ON attendance;
DROP POLICY IF EXISTS "School users access own school attendance" ON attendance;
DROP POLICY IF EXISTS "School users attendance select" ON attendance;
DROP POLICY IF EXISTS "School users attendance write" ON attendance;
DROP POLICY IF EXISTS "attendance_insert" ON attendance;
DROP POLICY IF EXISTS "attendance_select" ON attendance;
DROP POLICY IF EXISTS "attendance_update" ON attendance;
DROP POLICY IF EXISTS "Allow all for authenticated" ON attendance;
DROP POLICY IF EXISTS "Allow all" ON attendance;

-- classes
DROP POLICY IF EXISTS "Admins can manage classes" ON classes;
DROP POLICY IF EXISTS "Demo classes read anon" ON classes;
DROP POLICY IF EXISTS "School data access" ON classes;
DROP POLICY IF EXISTS "School users access own school classes" ON classes;
DROP POLICY IF EXISTS "School users classes select" ON classes;
DROP POLICY IF EXISTS "School users classes write" ON classes;
DROP POLICY IF EXISTS "Users can view classes" ON classes;
DROP POLICY IF EXISTS "classes_delete" ON classes;
DROP POLICY IF EXISTS "classes_insert" ON classes;
DROP POLICY IF EXISTS "classes_select" ON classes;
DROP POLICY IF EXISTS "classes_update" ON classes;
DROP POLICY IF EXISTS "Allow all for authenticated" ON classes;
DROP POLICY IF EXISTS "Allow all" ON classes;

-- exam_scores
DROP POLICY IF EXISTS "School users exam_scores all" ON exam_scores;
DROP POLICY IF EXISTS "exam_scores_all" ON exam_scores;
DROP POLICY IF EXISTS "exam_scores_school" ON exam_scores;
DROP POLICY IF EXISTS "exam_scores_staff_write" ON exam_scores;
DROP POLICY IF EXISTS "Allow all for authenticated" ON exam_scores;
DROP POLICY IF EXISTS "Allow all" ON exam_scores;

-- exams
DROP POLICY IF EXISTS "School users exams all" ON exams;
DROP POLICY IF EXISTS "exams_all" ON exams;
DROP POLICY IF EXISTS "exams_school" ON exams;
DROP POLICY IF EXISTS "Allow all for authenticated" ON exams;
DROP POLICY IF EXISTS "Allow all" ON exams;

-- grades
DROP POLICY IF EXISTS "Demo grades read anon" ON grades;
DROP POLICY IF EXISTS "School data access" ON grades;
DROP POLICY IF EXISTS "School users access own school grades" ON grades;
DROP POLICY IF EXISTS "School users grades select" ON grades;
DROP POLICY IF EXISTS "School users grades write" ON grades;
DROP POLICY IF EXISTS "Teachers can manage grades" ON grades;
DROP POLICY IF EXISTS "Users can view grades" ON grades;
DROP POLICY IF EXISTS "grades_insert" ON grades;
DROP POLICY IF EXISTS "grades_school_all" ON grades;
DROP POLICY IF EXISTS "grades_select" ON grades;
DROP POLICY IF EXISTS "grades_update" ON grades;
DROP POLICY IF EXISTS "Allow all for authenticated" ON grades;
DROP POLICY IF EXISTS "Allow all" ON grades;

-- homework
DROP POLICY IF EXISTS "School staff homework write" ON homework;
DROP POLICY IF EXISTS "School users homework all" ON homework;
DROP POLICY IF EXISTS "School users homework select" ON homework;
DROP POLICY IF EXISTS "Allow all for authenticated" ON homework;
DROP POLICY IF EXISTS "Allow all" ON homework;

-- period_attendance
DROP POLICY IF EXISTS "School users period_attendance select" ON period_attendance;
DROP POLICY IF EXISTS "School users period_attendance write" ON period_attendance;
DROP POLICY IF EXISTS "Allow all for authenticated" ON period_attendance;
DROP POLICY IF EXISTS "Allow all" ON period_attendance;

-- report_cards
DROP POLICY IF EXISTS "Parents view own children report_cards" ON report_cards;
DROP POLICY IF EXISTS "School users report_cards all" ON report_cards;
DROP POLICY IF EXISTS "Allow all for authenticated" ON report_cards;
DROP POLICY IF EXISTS "Allow all" ON report_cards;

-- students
DROP POLICY IF EXISTS "Demo students read anon" ON students;
DROP POLICY IF EXISTS "School data access" ON students;
DROP POLICY IF EXISTS "School users access own school" ON students;
DROP POLICY IF EXISTS "School users students delete" ON students;
DROP POLICY IF EXISTS "School users students insert" ON students;
DROP POLICY IF EXISTS "School users students select" ON students;
DROP POLICY IF EXISTS "School users students update" ON students;
DROP POLICY IF EXISTS "students_delete" ON students;
DROP POLICY IF EXISTS "students_insert" ON students;
DROP POLICY IF EXISTS "students_select" ON students;
DROP POLICY IF EXISTS "students_update" ON students;
DROP POLICY IF EXISTS "Allow all for authenticated" ON students;
DROP POLICY IF EXISTS "Allow all" ON students;

-- subject_allocations
DROP POLICY IF EXISTS "School users subject_allocations all" ON subject_allocations;
DROP POLICY IF EXISTS "subject_allocations_school" ON subject_allocations;
DROP POLICY IF EXISTS "Allow all for authenticated" ON subject_allocations;
DROP POLICY IF EXISTS "Allow all" ON subject_allocations;

-- teacher_subjects
DROP POLICY IF EXISTS "School users teacher_subjects select" ON teacher_subjects;
DROP POLICY IF EXISTS "School users teacher_subjects write" ON teacher_subjects;
DROP POLICY IF EXISTS "teacher_subjects_school" ON teacher_subjects;
DROP POLICY IF EXISTS "Allow all for authenticated" ON teacher_subjects;
DROP POLICY IF EXISTS "Allow all" ON teacher_subjects;

-- ─── canonical policy set ───────────────────────────────────────────────────


-- STUDENTS --------------------------------------------------------------

CREATE POLICY "School users students select"
ON students
FOR SELECT
TO authenticated
USING (
  (school_id = my_school_id() AND is_staff_role() AND in_teachers_scope(class_id, id))
  OR id IN (SELECT my_student_ids())
)
;


CREATE POLICY "School users students insert"
ON students
FOR INSERT
TO authenticated
WITH CHECK (
  school_id = my_school_id() AND is_staff_role() AND in_teachers_scope(class_id, id)
)
;


CREATE POLICY "School users students update"
ON students
FOR UPDATE
TO authenticated
USING (
  school_id = my_school_id() AND is_staff_role() AND in_teachers_scope(class_id, id)
)
WITH CHECK (
  school_id = my_school_id() AND is_staff_role() AND in_teachers_scope(class_id, id)
)
;


-- Deleting a student is not a class-level task: a teacher's registry is
-- read-only, so DELETE stays with every other staff role.
CREATE POLICY "School users students delete"
ON students
FOR DELETE
TO authenticated
USING (
  school_id = my_school_id() AND is_staff_role() AND NOT is_class_scoped_role()
)
;



-- ATTENDANCE ------------------------------------------------------------

CREATE POLICY "School users attendance select"
ON attendance
FOR SELECT
TO authenticated
USING (
  (class_id IN (SELECT id FROM classes WHERE school_id = my_school_id()) AND is_staff_role() AND in_teachers_scope(class_id, student_id))
  OR student_id IN (SELECT my_student_ids())
)
;


CREATE POLICY "School users attendance write"
ON attendance
FOR ALL
TO authenticated
USING (
  class_id IN (SELECT id FROM classes WHERE school_id = my_school_id()) AND is_staff_role() AND in_teachers_scope(class_id, student_id)
)
WITH CHECK (
  class_id IN (SELECT id FROM classes WHERE school_id = my_school_id()) AND is_staff_role() AND in_teachers_scope(class_id, student_id)
)
;



-- GRADES ----------------------------------------------------------------

CREATE POLICY "School users grades select"
ON grades
FOR SELECT
TO authenticated
USING (
  (class_id IN (SELECT id FROM classes WHERE school_id = my_school_id()) AND is_staff_role() AND in_teachers_scope(class_id, student_id))
  OR student_id IN (SELECT my_student_ids())
)
;


CREATE POLICY "School users grades write"
ON grades
FOR ALL
TO authenticated
USING (
  class_id IN (SELECT id FROM classes WHERE school_id = my_school_id()) AND is_staff_role() AND in_teachers_scope(class_id, student_id)
)
WITH CHECK (
  class_id IN (SELECT id FROM classes WHERE school_id = my_school_id()) AND is_staff_role() AND in_teachers_scope(class_id, student_id)
)
;



-- CLASSES ---------------------------------------------------------------

-- A teacher lists only the classes they lead or teach; everyone else lists
-- the whole school as before.
CREATE POLICY "School users classes select"
ON classes
FOR SELECT
TO authenticated
USING (
  school_id = my_school_id()
  AND (NOT is_class_scoped_role() OR id IN (SELECT my_assigned_class_ids()))
)
;


-- Creating, renaming or reassigning a class is management work. Without this
-- a teacher could set class_teacher_id to themselves on any class in the school
-- (the column feeds my_assigned_class_ids()).
CREATE POLICY "School users classes write"
ON classes
FOR ALL
TO authenticated
USING (
  school_id = my_school_id() AND NOT is_class_scoped_role()
)
WITH CHECK (
  school_id = my_school_id() AND NOT is_class_scoped_role()
)
;



-- TEACHER_SUBJECTS ------------------------------------------------------

-- Read stays school-scoped (the subquery follows the caller's class
-- visibility). Assignment changes stay with management roles.
CREATE POLICY "School users teacher_subjects select"
ON teacher_subjects
FOR SELECT
TO authenticated
USING (
  class_id IN (SELECT id FROM classes WHERE school_id = my_school_id())
)
;


CREATE POLICY "School users teacher_subjects write"
ON teacher_subjects
FOR ALL
TO authenticated
USING (
  class_id IN (SELECT id FROM classes WHERE school_id = my_school_id()) AND NOT is_class_scoped_role()
)
WITH CHECK (
  class_id IN (SELECT id FROM classes WHERE school_id = my_school_id()) AND NOT is_class_scoped_role()
)
;



-- PERIOD ATTENDANCE -----------------------------------------------------

CREATE POLICY "School users period_attendance select"
ON period_attendance
FOR SELECT
TO authenticated
USING (
  (school_id = my_school_id() AND is_staff_role() AND in_teachers_scope(class_id, student_id))
  OR student_id IN (SELECT my_student_ids())
)
;


CREATE POLICY "School users period_attendance write"
ON period_attendance
FOR ALL
TO authenticated
USING (
  school_id = my_school_id() AND is_staff_role() AND in_teachers_scope(class_id, student_id)
)
WITH CHECK (
  school_id = my_school_id() AND is_staff_role() AND in_teachers_scope(class_id, student_id)
)
;



-- HOMEWORK --------------------------------------------------------------

CREATE POLICY "School users homework all"
ON homework
FOR ALL
TO authenticated
USING (
  (school_id = my_school_id() AND is_staff_role() AND in_teachers_scope(class_id))
  OR (school_id = my_school_id() AND class_id IS NULL)
  OR class_id IN (SELECT DISTINCT s.class_id FROM students s WHERE s.id IN (SELECT my_student_ids()) AND s.class_id IS NOT NULL)
)
WITH CHECK (
  school_id = my_school_id() AND is_staff_role() AND in_teachers_scope(class_id)
)
;



-- EXAMS -----------------------------------------------------------------

CREATE POLICY "School users exams all"
ON exams
FOR ALL
TO authenticated
USING (
  school_id = my_school_id() AND in_teachers_scope(class_id)
)
WITH CHECK (
  school_id = my_school_id() AND in_teachers_scope(class_id)
)
;



-- EXAM SCORES -----------------------------------------------------------

CREATE POLICY "School users exam_scores all"
ON exam_scores
FOR ALL
TO authenticated
USING (
  student_id IN (SELECT id FROM students WHERE school_id = my_school_id()) AND in_teachers_scope(class_id, student_id)
)
WITH CHECK (
  student_id IN (SELECT id FROM students WHERE school_id = my_school_id()) AND in_teachers_scope(class_id, student_id)
)
;



-- REPORT CARDS ----------------------------------------------------------

CREATE POLICY "School users report_cards all"
ON report_cards
FOR ALL
TO authenticated
USING (
  school_id = my_school_id() AND is_staff_role() AND in_teachers_scope(class_id, student_id)
)
WITH CHECK (
  school_id = my_school_id() AND is_staff_role() AND in_teachers_scope(class_id, student_id)
)
;


-- Parents must keep read access to their own children's report cards.
CREATE POLICY "Parents view own children report_cards"
ON report_cards
FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT ps.student_id
    FROM parent_students ps
    JOIN users u ON u.id = ps.parent_id
    WHERE u.auth_id = auth.uid()
  )
)
;



-- SUBJECT ALLOCATIONS ---------------------------------------------------

CREATE POLICY "School users subject_allocations all"
ON subject_allocations
FOR ALL
TO authenticated
USING (
  class_id IN (SELECT id FROM classes WHERE school_id = my_school_id()) AND in_teachers_scope(class_id)
)
WITH CHECK (
  class_id IN (SELECT id FROM classes WHERE school_id = my_school_id()) AND in_teachers_scope(class_id)
)
;



-- Demo mode reads the seeded demo school without a session. Restated here
-- because the drop block above removes it.
CREATE POLICY "Demo students read anon" ON students
  FOR SELECT TO anon USING (school_id = '00000000-0000-0000-0000-000000000001');
CREATE POLICY "Demo classes read anon" ON classes
  FOR SELECT TO anon USING (school_id = '00000000-0000-0000-0000-000000000001');
CREATE POLICY "Demo attendance read anon" ON attendance
  FOR SELECT TO anon
  USING (student_id IN (SELECT id FROM students WHERE school_id = '00000000-0000-0000-0000-000000000001'));
CREATE POLICY "Demo grades read anon" ON grades
  FOR SELECT TO anon
  USING (student_id IN (SELECT id FROM students WHERE school_id = '00000000-0000-0000-0000-000000000001'));

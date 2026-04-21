-- ============================================================
-- Migration: Drop blanket-permissive "Allow all" policies and
--            replace with school-scoped equivalents on all
--            affected tables.
--
-- Context: Prior migrations added "Allow all for authenticated"
-- (qual=true) policies that let ANY authenticated user read and
-- write rows from ANY school. Our role_based_rls migration added
-- correct policies for students/classes/etc but those permissive
-- policies were still present and took precedence (PERMISSIVE
-- policies are ORed together).
-- ============================================================

-- =====================
-- STUDENTS
-- =====================
DROP POLICY IF EXISTS "Allow all" ON students;
DROP POLICY IF EXISTS "Allow all for authenticated" ON students;

-- =====================
-- CLASSES
-- =====================
DROP POLICY IF EXISTS "Allow all" ON classes;
DROP POLICY IF EXISTS "Allow all for authenticated" ON classes;

-- =====================
-- ATTENDANCE
-- =====================
DROP POLICY IF EXISTS "Allow all" ON attendance;
DROP POLICY IF EXISTS "Allow all for authenticated" ON attendance;

-- =====================
-- GRADES
-- =====================
DROP POLICY IF EXISTS "Allow all" ON grades;
DROP POLICY IF EXISTS "Allow all for authenticated" ON grades;

-- =====================
-- FEE STRUCTURE
-- =====================
DROP POLICY IF EXISTS "Allow all" ON fee_structure;
DROP POLICY IF EXISTS "Allow all for authenticated" ON fee_structure;

-- =====================
-- MESSAGES
-- =====================
DROP POLICY IF EXISTS "Allow all" ON messages;
DROP POLICY IF EXISTS "Allow all for authenticated" ON messages;

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users messages select" ON messages;
CREATE POLICY "School users messages select"
ON messages FOR SELECT TO authenticated
USING (school_id = my_school_id());

DROP POLICY IF EXISTS "School users messages write" ON messages;
CREATE POLICY "School users messages write"
ON messages FOR ALL TO authenticated
USING (school_id = my_school_id())
WITH CHECK (school_id = my_school_id());

-- =====================
-- EVENTS
-- =====================
DROP POLICY IF EXISTS "Allow all" ON events;
DROP POLICY IF EXISTS "Allow all for authenticated" ON events;

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users events select" ON events;
CREATE POLICY "School users events select"
ON events FOR SELECT TO authenticated
USING (school_id = my_school_id());

DROP POLICY IF EXISTS "School users events write" ON events;
CREATE POLICY "School users events write"
ON events FOR ALL TO authenticated
USING (is_school_staff(my_school_id()))
WITH CHECK (school_id = my_school_id() AND is_school_staff(my_school_id()));

-- =====================
-- SCHOOLS
-- (Any authenticated user was able to read/modify any school)
-- =====================
DROP POLICY IF EXISTS "Allow all" ON schools;
DROP POLICY IF EXISTS "Allow all for authenticated" ON schools;

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

-- Super admins see all schools; school users see only their own
DROP POLICY IF EXISTS "School users schools select" ON schools;
CREATE POLICY "School users schools select"
ON schools FOR SELECT TO authenticated
USING (
  id = my_school_id()
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- Only super admins can create schools (schools registered via service-role API)
DROP POLICY IF EXISTS "Super admin schools write" ON schools;
CREATE POLICY "Super admin schools write"
ON schools FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin'))
WITH CHECK (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin'));

-- =====================
-- SCHOOL_SETTINGS
-- =====================
DROP POLICY IF EXISTS "Allow all for authenticated" ON school_settings;

ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users settings select" ON school_settings;
CREATE POLICY "School users settings select"
ON school_settings FOR SELECT TO authenticated
USING (school_id = my_school_id());

DROP POLICY IF EXISTS "School admin settings write" ON school_settings;
CREATE POLICY "School admin settings write"
ON school_settings FOR ALL TO authenticated
USING (is_school_admin(school_id))
WITH CHECK (is_school_admin(school_id));

-- =====================
-- HOMEWORK
-- =====================
DROP POLICY IF EXISTS "Allow all for authenticated" ON homework;

ALTER TABLE homework ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users homework select" ON homework;
CREATE POLICY "School users homework select"
ON homework FOR SELECT TO authenticated
USING (
  class_id IN (SELECT id FROM classes WHERE school_id = my_school_id())
);

DROP POLICY IF EXISTS "School staff homework write" ON homework;
CREATE POLICY "School staff homework write"
ON homework FOR ALL TO authenticated
USING (
  class_id IN (SELECT id FROM classes WHERE school_id = my_school_id())
  AND is_school_staff(my_school_id())
)
WITH CHECK (
  class_id IN (SELECT id FROM classes WHERE school_id = my_school_id())
  AND is_school_staff(my_school_id())
);

-- =====================
-- HOMEWORK SUBMISSIONS
-- =====================
DROP POLICY IF EXISTS "Allow all for authenticated" ON homework_submissions;

ALTER TABLE homework_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users homework submissions" ON homework_submissions;
CREATE POLICY "School users homework submissions"
ON homework_submissions FOR ALL TO authenticated
USING (
  homework_id IN (
    SELECT h.id FROM homework h
    JOIN classes c ON c.id = h.class_id
    WHERE c.school_id = my_school_id()
  )
)
WITH CHECK (
  homework_id IN (
    SELECT h.id FROM homework h
    JOIN classes c ON c.id = h.class_id
    WHERE c.school_id = my_school_id()
  )
);

-- =====================
-- LESSON PLANS
-- =====================
DROP POLICY IF EXISTS "Allow all for authenticated" ON lesson_plans;

ALTER TABLE lesson_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School staff lesson plans" ON lesson_plans;
CREATE POLICY "School staff lesson plans"
ON lesson_plans FOR ALL TO authenticated
USING (is_school_staff(my_school_id()))
WITH CHECK (is_school_staff(my_school_id()));

-- =====================
-- DORMS
-- =====================
DROP POLICY IF EXISTS "Allow all for authenticated" ON dorms;

ALTER TABLE dorms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users dorms select" ON dorms;
CREATE POLICY "School users dorms select"
ON dorms FOR SELECT TO authenticated
USING (school_id = my_school_id());

DROP POLICY IF EXISTS "School admin dorms write" ON dorms;
CREATE POLICY "School admin dorms write"
ON dorms FOR ALL TO authenticated
USING (is_school_admin(school_id))
WITH CHECK (is_school_admin(school_id));

-- =====================
-- DORM STUDENTS
-- =====================
DROP POLICY IF EXISTS "Allow all for authenticated" ON dorm_students;

ALTER TABLE dorm_students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users dorm_students" ON dorm_students;
CREATE POLICY "School users dorm_students"
ON dorm_students FOR ALL TO authenticated
USING (
  dorm_id IN (SELECT id FROM dorms WHERE school_id = my_school_id())
)
WITH CHECK (
  dorm_id IN (SELECT id FROM dorms WHERE school_id = my_school_id())
);

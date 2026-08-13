-- ============================================================
-- Parent Portal RLS Hardening
-- ------------------------------------------------------------
-- Problem: parents carry a `school_id` on their users row, so
-- every school-scoped policy (school_id = my_school_id(),
-- class_id IN (... my school classes ...), student_id IN
-- (SELECT id FROM students WHERE school_id = my_school_id()))
-- let a parent SELECT *ANY* student's grades, attendance,
-- payments, homework submissions, wallets, canteen orders,
-- report cards and messages. The parent portal filtered
-- client-side, but a crafted client could read the whole
-- school.
--
-- Fix: add SECURITY DEFINER helpers and scope sensitive
-- policies to "school staff OR the requester's own children".
--
-- Helpers required:
--   my_student_ids()  -> student ids the current user may see
--                        (linked children for parents, own row
--                        for students)
--   is_staff_role()   -> current user is NOT a 'parent'/'student'
-- ============================================================

-- ------------------------------------------------------------
-- 1. Helpers (SECURITY DEFINER, mirrors my_school_id() style)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_student_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT ps.student_id
  FROM parent_students ps
  JOIN users u ON u.id = ps.parent_id
  WHERE u.auth_id = auth.uid()
  UNION
  SELECT s.id
  FROM students s
  JOIN users u ON u.id = s.user_id
  WHERE u.auth_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_staff_role()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
      AND role IS DISTINCT FROM 'parent'
      AND role IS DISTINCT FROM 'student'
  )
$$;

-- ------------------------------------------------------------
-- 2. GRADES
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "School users grades select" ON grades;
CREATE POLICY "School users grades select" ON grades
FOR SELECT TO authenticated
USING (
  ("class_id" IN (SELECT "id" FROM "classes" WHERE school_id = my_school_id()) AND is_staff_role())
  OR student_id IN (SELECT my_student_ids())
);

DROP POLICY IF EXISTS "School users grades write" ON grades;
CREATE POLICY "School users grades write" ON grades
FOR ALL TO authenticated
USING ("class_id" IN (SELECT "id" FROM "classes" WHERE school_id = my_school_id()) AND is_staff_role())
WITH CHECK ("class_id" IN (SELECT "id" FROM "classes" WHERE school_id = my_school_id()) AND is_staff_role());

-- ------------------------------------------------------------
-- 3. ATTENDANCE
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "School users attendance select" ON attendance;
CREATE POLICY "School users attendance select" ON attendance
FOR SELECT TO authenticated
USING (
  ("class_id" IN (SELECT "id" FROM "classes" WHERE school_id = my_school_id()) AND is_staff_role())
  OR student_id IN (SELECT my_student_ids())
);

DROP POLICY IF EXISTS "School users attendance write" ON attendance;
CREATE POLICY "School users attendance write" ON attendance
FOR ALL TO authenticated
USING ("class_id" IN (SELECT "id" FROM "classes" WHERE school_id = my_school_id()) AND is_staff_role())
WITH CHECK ("class_id" IN (SELECT "id" FROM "classes" WHERE school_id = my_school_id()) AND is_staff_role());

-- ------------------------------------------------------------
-- 4. FEE PAYMENTS
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "School users fee_payments select" ON fee_payments;
CREATE POLICY "School users fee_payments select" ON fee_payments
FOR SELECT TO authenticated
USING (
  (student_id IN (SELECT id FROM students WHERE school_id = my_school_id()) AND is_staff_role())
  OR student_id IN (SELECT my_student_ids())
);

DROP POLICY IF EXISTS "School users fee_payments write" ON fee_payments;
CREATE POLICY "School users fee_payments write" ON fee_payments
FOR ALL TO authenticated
USING (student_id IN (SELECT id FROM students WHERE school_id = my_school_id()) AND is_staff_role())
WITH CHECK (student_id IN (SELECT id FROM students WHERE school_id = my_school_id()) AND is_staff_role());

-- ------------------------------------------------------------
-- 5. STUDENT FEE TERMS
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "School users student_fee_terms all" ON student_fee_terms;
CREATE POLICY "School users student_fee_terms all" ON student_fee_terms
FOR ALL TO authenticated
USING (
  ("class_id" IN (SELECT "id" FROM "classes" WHERE school_id = my_school_id()) AND is_staff_role())
  OR student_id IN (SELECT my_student_ids())
)
WITH CHECK (
  ("class_id" IN (SELECT "id" FROM "classes" WHERE school_id = my_school_id()) AND is_staff_role())
  OR ("class_id" IN (SELECT "id" FROM "classes" WHERE school_id = my_school_id()) AND student_id IN (SELECT my_student_ids()))
);

-- ------------------------------------------------------------
-- 6. HOMEWORK (class-scoped; parents see only their child's class)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "School users homework all" ON homework;
CREATE POLICY "School users homework all" ON homework
FOR ALL TO authenticated
USING (
  (school_id = my_school_id() AND is_staff_role())
  OR (school_id = my_school_id() AND class_id IS NULL)
  OR class_id IN (SELECT DISTINCT s.class_id FROM students s WHERE s.id IN (SELECT my_student_ids()) AND s.class_id IS NOT NULL)
)
WITH CHECK (school_id = my_school_id() AND is_staff_role());

-- ------------------------------------------------------------
-- 7. HOMEWORK SUBMISSIONS (fixes the leaked embedded read)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "School users homework_submissions all" ON homework_submissions;
CREATE POLICY "School users homework_submissions all" ON homework_submissions
FOR ALL TO authenticated
USING (
  (homework_id IN (SELECT id FROM homework WHERE school_id = my_school_id()) AND is_staff_role())
  OR student_id IN (SELECT my_student_ids())
)
WITH CHECK (homework_id IN (SELECT id FROM homework WHERE school_id = my_school_id()) AND is_staff_role());

-- ------------------------------------------------------------
-- 8. CANTEEN ORDERS (parents may place orders for own children)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "School users canteen_orders all" ON canteen_orders;
CREATE POLICY "School users canteen_orders all" ON canteen_orders
FOR ALL TO authenticated
USING (
  (school_id = my_school_id() AND is_staff_role())
  OR student_id IN (SELECT my_student_ids())
)
WITH CHECK (
  (school_id = my_school_id() AND is_staff_role())
  OR (school_id = my_school_id() AND student_id IS NOT NULL AND student_id IN (SELECT my_student_ids()))
);

-- ------------------------------------------------------------
-- 9. STUDENT WALLETS (topup RPC runs as invoker -> RLS applies)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "School users student_wallets all" ON student_wallets;
CREATE POLICY "School users student_wallets all" ON student_wallets
FOR ALL TO authenticated
USING (
  (school_id = my_school_id() AND is_staff_role())
  OR student_id IN (SELECT my_student_ids())
)
WITH CHECK (
  (school_id = my_school_id() AND is_staff_role())
  OR (school_id = my_school_id() AND student_id IN (SELECT my_student_ids()))
);

-- ------------------------------------------------------------
-- 10. WALLET TRANSACTIONS
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "School users wallet_transactions all" ON wallet_transactions;
CREATE POLICY "School users wallet_transactions all" ON wallet_transactions
FOR ALL TO authenticated
USING (
  (school_id = my_school_id() AND is_staff_role())
  OR student_id IN (SELECT my_student_ids())
)
WITH CHECK (
  (school_id = my_school_id() AND is_staff_role())
  OR (school_id = my_school_id() AND student_id IN (SELECT my_student_ids()))
);

-- ------------------------------------------------------------
-- 11. REPORT CARDS (school-wide policy now staff-only; the
--     "Parents view own children report_cards" policy remains
--     and correctly scopes parents to their children)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "School users report_cards all" ON report_cards;
CREATE POLICY "School users report_cards all" ON report_cards
FOR ALL TO authenticated
USING (school_id = my_school_id() AND is_staff_role())
WITH CHECK (school_id = my_school_id() AND is_staff_role());

-- ------------------------------------------------------------
-- 12. PARENT MESSAGES (parents only see/write their own thread)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "School users parent_messages all" ON parent_messages;
CREATE POLICY "School users parent_messages all" ON parent_messages
FOR ALL TO authenticated
USING (
  (school_id = my_school_id() AND is_staff_role())
  OR parent_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
)
WITH CHECK (
  (school_id = my_school_id() AND is_staff_role())
  OR (school_id = my_school_id() AND parent_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))
);

-- ------------------------------------------------------------
-- 13. PARENT STUDENTS (drop the school-wide SELECT escape hatch;
--     keep parent-self read + school-wide write for auto-link)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "School users parent_students select" ON parent_students;
CREATE POLICY "School users parent_students select" ON parent_students
FOR SELECT TO authenticated
USING (
  parent_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  OR (student_id IN (SELECT id FROM students WHERE school_id = my_school_id()) AND is_staff_role())
);

-- ------------------------------------------------------------
-- 14. PARENT NOTIFICATIONS
--     Fixes the wrong policies created in
--     202605040002_parent_notifications.sql which compared
--     parent_id (users.id) against auth.uid() (auth.users.id).
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Parents can view own notifications" ON parent_notifications;
DROP POLICY IF EXISTS "School admins can manage notifications" ON parent_notifications;

DROP POLICY IF EXISTS "Parent notifications own" ON parent_notifications;
CREATE POLICY "Parent notifications own" ON parent_notifications
FOR ALL TO authenticated
USING (parent_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))
WITH CHECK (parent_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "School users parent_notifications all" ON parent_notifications;
CREATE POLICY "School users parent_notifications all" ON parent_notifications
FOR ALL TO authenticated
USING (school_id = my_school_id() AND is_staff_role())
WITH CHECK (school_id = my_school_id() AND is_staff_role());
-- ------------------------------------------------------------
-- 15. TIMETABLE FOR PARENTS
--     Parents can view timetables of their children's classes.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION my_children_class_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT s.class_id
  FROM parent_students ps
  JOIN students s ON s.id = ps.student_id
  JOIN users u ON u.id = ps.parent_id
  WHERE u.auth_id = auth.uid()
    AND s.class_id IS NOT NULL
$$;

DROP POLICY IF EXISTS "Parents teacher_timetable select" ON teacher_timetable;
CREATE POLICY "Parents teacher_timetable select" ON teacher_timetable
FOR SELECT TO authenticated
USING (class_id IN (SELECT my_children_class_ids()));

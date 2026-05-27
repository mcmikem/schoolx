-- Fix schools RLS so school users can read their own school and admins can update it reliably.

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users select own school" ON schools;
CREATE POLICY "School users select own school"
ON schools
FOR SELECT
TO authenticated
USING (id = my_school_id());

DROP POLICY IF EXISTS "School admins update own school" ON schools;
CREATE POLICY "School admins update own school"
ON schools
FOR UPDATE
TO authenticated
USING (id = my_school_id() AND is_school_admin(id))
WITH CHECK (id = my_school_id());

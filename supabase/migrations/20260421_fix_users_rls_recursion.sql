-- Fix infinite recursion in users table RLS policies
--
-- Two policies had raw subqueries on the users table itself, causing
-- PostgreSQL error 42P17: "infinite recursion detected in policy for relation 'users'"
-- whenever any authenticated user tried to read their own profile.
--
-- 1. users_select: school_id IN (SELECT u2.school_id FROM users u2 WHERE u2.auth_id = auth.uid())
--    → Dropped. Redundant — 'Users read own record' already covers this via
--      the SECURITY DEFINER my_school_id() function (no RLS bypass needed).
--
-- 2. "Admin users write" ALL policy had:
--    EXISTS (SELECT 1 FROM users u2 WHERE u2.auth_id = auth.uid() AND u2.role = 'super_admin')
--    → Replaced with is_super_admin() which is SECURITY DEFINER and bypasses RLS.

DROP POLICY IF EXISTS users_select ON public.users;

DROP POLICY IF EXISTS "Admin users write" ON public.users;
CREATE POLICY "Admin users write" ON public.users
  FOR ALL
  USING (is_school_admin(my_school_id()) OR is_super_admin());

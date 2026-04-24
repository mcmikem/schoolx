-- ============================================
-- Fix Users RLS Read Policy - 20260425
-- ============================================
-- Critical security fix: Change users read policy from USING (true)
-- to USING (auth_id = auth.uid()) to prevent data breach where any
-- authenticated user could read ALL user records across ALL schools.
-- ============================================

-- Drop the broken permissive policy
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;

-- Create secure policy: user can only read their own profile
CREATE POLICY "Users can read own profile" ON public.users
  FOR SELECT TO authenticated
  USING (auth_id = auth.uid());

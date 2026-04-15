-- ============================================================
-- Fix RLS Policies with USING (true) - Security Hardening
-- Date: 2026-04-15
-- ============================================================
-- This migration fixes overly permissive RLS policies that allowed
-- any authenticated user to read ALL data across all schools.
-- ============================================================

-- Helper function already exists in harden-rls.sql, but ensure it's available
CREATE OR REPLACE FUNCTION get_user_school()
RETURNS uuid AS $$
  SELECT school_id FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function to check if user is super_admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function to check if user has admin role
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
    AND role IN ('super_admin', 'school_admin', 'admin')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- 1. FIX: USERS TABLE SELECT POLICY
-- ============================================================
-- Current: USING (true) - allows ALL authenticated users to read ALL user profiles
-- Fix: Users can only read users in their own school (or super_admin can read all)
DROP POLICY IF EXISTS "Users can read own profile" ON users;

CREATE POLICY "Users can read own school profiles" ON users
  FOR SELECT TO authenticated
  USING (
    school_id = get_user_school()
    OR is_super_admin()
  );

-- ============================================================
-- 2. FIX: SUPPORT_TICKETS TABLE
-- ============================================================
-- Current: FOR ALL USING (true) - anyone can read/modify all tickets
-- Fix: Super admin can manage all, school users can only see their school's tickets
DROP POLICY IF EXISTS "Super admins manage support tickets" ON support_tickets;

CREATE POLICY "Schools manage own support tickets" ON support_tickets
  FOR SELECT TO authenticated
  USING (school_id = get_user_school() OR is_super_admin());

CREATE POLICY "Schools create support tickets" ON support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (school_id = get_user_school());

CREATE POLICY "Super admins update support tickets" ON support_tickets
  FOR UPDATE TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ============================================================
-- 3. FIX: FEEDBACKS TABLE
-- ============================================================
-- Current: Multiple policies with USING (true) - anyone can see all feedback
-- Fix: School-scoped access
DROP POLICY IF EXISTS "Users view all feedback" ON feedbacks;
DROP POLICY IF EXISTS "Users create feedback" ON feedbacks;
DROP POLICY IF EXISTS "Users update own feedback" ON feedbacks;

CREATE POLICY "Schools view own feedback" ON feedbacks
  FOR SELECT TO authenticated
  USING (school_id = get_user_school() OR is_super_admin());

CREATE POLICY "Users create feedback" ON feedbacks
  FOR INSERT TO authenticated
  WITH CHECK (school_id = get_user_school() OR school_id IS NULL);

CREATE POLICY "Users update own feedback" ON feedbacks
  FOR UPDATE TO authenticated
  USING (
    school_id = get_user_school()
    AND user_id = auth.uid()::text
  );

-- ============================================================
-- 4. FIX: ERROR_LOGS TABLE
-- ============================================================
-- Current: FOR SELECT USING (true) - anyone can read all error logs
-- Fix: Only super_admin can view error logs
DROP POLICY IF EXISTS "Super admins view error logs" ON error_logs;

CREATE POLICY "Only super admins view error logs" ON error_logs
  FOR SELECT TO authenticated
  USING (is_super_admin());

-- Keep the insert policy for system to log errors
DROP POLICY IF EXISTS "System inserts error logs" ON error_logs;

CREATE POLICY "System inserts error logs" ON error_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================
-- 5. FIX: DORM_ROOMS TABLE
-- ============================================================
-- Current: FOR SELECT USING (true) - anyone can see all dorm rooms
-- Fix: School-scoped via dorm relation
DROP POLICY IF EXISTS "Users view dorm rooms" ON dorm_rooms;

CREATE POLICY "Schools view own dorm rooms" ON dorm_rooms
  FOR SELECT TO authenticated
  USING (
    dorm_id IN (
      SELECT id FROM dorms WHERE school_id = get_user_school()
    )
    OR is_super_admin()
  );

-- ============================================================
-- 6. FIX: TRANSPORT_STOPS TABLE
-- ============================================================
-- Current: FOR SELECT USING (true) - anyone can see all transport stops
-- Fix: School-scoped via route relation
DROP POLICY IF EXISTS "Users view transport stops" ON transport_stops;

CREATE POLICY "Schools view own transport stops" ON transport_stops
  FOR SELECT TO authenticated
  USING (
    route_id IN (
      SELECT id FROM transport_routes WHERE school_id = get_user_school()
    )
    OR is_super_admin()
  );

-- ============================================================
-- 7. ADD MISSING POLICIES FOR TABLES WITHOUT RLS
-- ============================================================
-- Ensure all school-scoped tables have proper policies

-- dorm_incidents (already has policy but verify)
-- transport_vehicle_logs (already has policy but verify)

-- ============================================================
-- 8. VERIFY ALL POLICIES ARE SCHOOL-SCOPED
-- ============================================================
-- Run this query to audit policies (for documentation):
-- SELECT schemaname, tablename, policyname, qual, with_check
-- FROM pg_policies
-- WHERE qual = 'true' OR qual LIKE '%USING (true)%';
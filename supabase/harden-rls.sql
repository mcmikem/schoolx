-- ============================================
-- OMUTO - Hardened RLS Policies
-- ============================================

-- Reference ID for Demo School
-- '00000000-0000-0000-0000-000000000001'

-- 1. SCHOOLS
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can create school" ON schools;
DROP POLICY IF EXISTS "School data access" ON schools;
DROP POLICY IF EXISTS "Allow demo school access" ON schools;

-- Read: Users can read their own school
CREATE POLICY "Users can read own school" ON schools
  FOR SELECT TO authenticated
  USING (id IN (SELECT school_id FROM users WHERE auth_id = auth.uid()));

-- Read: Demo school is publicly readable for demo purposes (READ ONLY)
CREATE POLICY "Public read demo school" ON schools
  FOR SELECT TO anon, authenticated
  USING (id = '00000000-0000-0000-0000-000000000001');

-- Insert: Only authenticated users can create a school (can be restricted further to a setup role)
CREATE POLICY "Authenticated users can create school" ON schools
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 2. USERS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can register" ON users;
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

CREATE POLICY "Users can read own profile" ON users
  FOR SELECT TO authenticated
  USING (auth_id = auth.uid());

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE TO authenticated
  USING (auth_id = auth.uid());

-- Fix: Users can only insert their own profile link
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT TO authenticated
  WITH CHECK (auth_id = auth.uid());

-- 3. SCHOOL-SCOPED TABLES (classes, subjects, students, attendance, grades, fee_structure, fee_payments, events, messages)
-- We use a helper function to avoid repeating the complex subquery

CREATE OR REPLACE FUNCTION get_user_school()
RETURNS uuid AS $$
  SELECT school_id FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Apply to all school-scoped tables
DO $$
DECLARE
    t text;
    tables_to_harden text[] := ARRAY['classes', 'subjects', 'students', 'attendance', 'grades', 'fee_structure', 'fee_payments', 'events', 'messages'];
BEGIN
    FOREACH t IN ARRAY tables_to_harden
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS "School data access" ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Allow demo school %I" ON %I', t, t);
        EXECUTE format('DROP POLICY IF EXISTS "Allow demo access" ON %I', t);
        
        -- Policy for authenticated users in THEIR school
        EXECUTE format('CREATE POLICY "School scoped access" ON %I
            FOR ALL TO authenticated
            USING (school_id = get_user_school())
            WITH CHECK (school_id = get_user_school())', t);
            
        -- Policy for PUBLIC demo access (READ ONLY)
        EXECUTE format('CREATE POLICY "Public demo read access" ON %I
            FOR SELECT TO anon
            USING (school_id = ''00000000-0000-0000-0000-000000000001'')', t);
    END LOOP;
END $$;

-- Fix: RLS policies were using `users.id = auth.uid()` but the correct column
-- is `users.auth_id`. The `id` column is the internal users table PK (UUID)
-- while `auth_id` is the Supabase auth user UUID returned by auth.uid().
-- This caused syllabus SELECT/UPDATE/DELETE and topic_coverage policies to
-- silently block all reads and writes for logged-in users.

-- ── syllabus ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "syllabus_select" ON syllabus;
DROP POLICY IF EXISTS "syllabus_insert" ON syllabus;
DROP POLICY IF EXISTS "syllabus_update" ON syllabus;
DROP POLICY IF EXISTS "syllabus_delete" ON syllabus;

CREATE POLICY "syllabus_select" ON syllabus
  FOR SELECT USING (
    school_id IN (
      SELECT school_id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "syllabus_insert" ON syllabus
  FOR INSERT WITH CHECK (
    school_id IN (
      SELECT school_id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "syllabus_update" ON syllabus
  FOR UPDATE USING (
    school_id IN (
      SELECT school_id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "syllabus_delete" ON syllabus
  FOR DELETE USING (
    school_id IN (
      SELECT school_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- ── topic_coverage ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "topic_coverage_select" ON topic_coverage;
DROP POLICY IF EXISTS "topic_coverage_insert" ON topic_coverage;
DROP POLICY IF EXISTS "topic_coverage_update" ON topic_coverage;
DROP POLICY IF EXISTS "topic_coverage_delete" ON topic_coverage;

CREATE POLICY "topic_coverage_select" ON topic_coverage
  FOR SELECT USING (
    class_id IN (
      SELECT id FROM classes WHERE school_id IN (
        SELECT school_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "topic_coverage_insert" ON topic_coverage
  FOR INSERT WITH CHECK (
    class_id IN (
      SELECT id FROM classes WHERE school_id IN (
        SELECT school_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "topic_coverage_update" ON topic_coverage
  FOR UPDATE USING (
    class_id IN (
      SELECT id FROM classes WHERE school_id IN (
        SELECT school_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "topic_coverage_delete" ON topic_coverage
  FOR DELETE USING (
    class_id IN (
      SELECT id FROM classes WHERE school_id IN (
        SELECT school_id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

-- ── users table: fix self-reference policies to also use auth_id ─────────────
DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "users_update" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;

CREATE POLICY "users_select" ON users
  FOR SELECT USING (
    school_id IN (
      SELECT school_id FROM users u2 WHERE u2.auth_id = auth.uid()
    )
  );

CREATE POLICY "users_update" ON users
  FOR UPDATE USING (auth_id = auth.uid());

CREATE POLICY "users_insert" ON users
  FOR INSERT WITH CHECK (
    school_id IN (
      SELECT school_id FROM users u2 WHERE u2.auth_id = auth.uid()
    )
  );

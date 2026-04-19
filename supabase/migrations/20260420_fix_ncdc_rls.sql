-- Fix: Enable RLS and add school-scoped policies for syllabus and topic_coverage tables
-- These tables were missing RLS policies, causing access issues

-- ── syllabus ───────────────────────────────────────────────────────────────
ALTER TABLE syllabus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "syllabus_select" ON syllabus;
DROP POLICY IF EXISTS "syllabus_insert" ON syllabus;
DROP POLICY IF EXISTS "syllabus_update" ON syllabus;
DROP POLICY IF EXISTS "syllabus_delete" ON syllabus;

CREATE POLICY "syllabus_select" ON syllabus
  FOR SELECT USING (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "syllabus_insert" ON syllabus
  FOR INSERT WITH CHECK (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "syllabus_update" ON syllabus
  FOR UPDATE USING (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "syllabus_delete" ON syllabus
  FOR DELETE USING (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid()
    )
  );

-- ── topic_coverage ─────────────────────────────────────────────────────────
ALTER TABLE topic_coverage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "topic_coverage_select" ON topic_coverage;
DROP POLICY IF EXISTS "topic_coverage_insert" ON topic_coverage;
DROP POLICY IF EXISTS "topic_coverage_update" ON topic_coverage;
DROP POLICY IF EXISTS "topic_coverage_delete" ON topic_coverage;

-- Access via parent syllabus row (joins through class_id which is school-scoped)
CREATE POLICY "topic_coverage_select" ON topic_coverage
  FOR SELECT USING (
    class_id IN (
      SELECT id FROM classes WHERE school_id IN (
        SELECT school_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "topic_coverage_insert" ON topic_coverage
  FOR INSERT WITH CHECK (
    class_id IN (
      SELECT id FROM classes WHERE school_id IN (
        SELECT school_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "topic_coverage_update" ON topic_coverage
  FOR UPDATE USING (
    class_id IN (
      SELECT id FROM classes WHERE school_id IN (
        SELECT school_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "topic_coverage_delete" ON topic_coverage
  FOR DELETE USING (
    class_id IN (
      SELECT id FROM classes WHERE school_id IN (
        SELECT school_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- ── courses (also missing RLS) ─────────────────────────────────────────────
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "courses_select" ON courses;
DROP POLICY IF EXISTS "courses_insert" ON courses;
DROP POLICY IF EXISTS "courses_update" ON courses;
DROP POLICY IF EXISTS "courses_delete" ON courses;

CREATE POLICY "courses_select" ON courses
  FOR SELECT USING (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "courses_insert" ON courses
  FOR INSERT WITH CHECK (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "courses_update" ON courses
  FOR UPDATE USING (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "courses_delete" ON courses
  FOR DELETE USING (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid()
    )
  );

-- school_workflows table: persists automation rules per school
CREATE TABLE IF NOT EXISTS school_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_school_workflows_school_id ON school_workflows(school_id);

ALTER TABLE school_workflows ENABLE ROW LEVEL SECURITY;

-- School staff can read their own workflows
CREATE POLICY "school_workflows_select" ON school_workflows
  FOR SELECT USING (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid()
    )
  );

-- Only admin/headteacher can write workflows
CREATE POLICY "school_workflows_insert" ON school_workflows
  FOR INSERT WITH CHECK (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid()
      AND role IN ('admin', 'headteacher', 'super_admin')
    )
  );

CREATE POLICY "school_workflows_update" ON school_workflows
  FOR UPDATE USING (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid()
      AND role IN ('admin', 'headteacher', 'super_admin')
    )
  );

CREATE POLICY "school_workflows_delete" ON school_workflows
  FOR DELETE USING (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid()
      AND role IN ('admin', 'headteacher', 'super_admin')
    )
  );

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION update_school_workflows_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_school_workflows_updated_at
  BEFORE UPDATE ON school_workflows
  FOR EACH ROW EXECUTE FUNCTION update_school_workflows_updated_at();

-- Trigger to keep schools.student_count in sync
CREATE OR REPLACE FUNCTION sync_school_student_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE schools
    SET student_count = (
      SELECT COUNT(*) FROM students
      WHERE school_id = OLD.school_id AND status = 'active'
    )
    WHERE id = OLD.school_id;
    RETURN OLD;
  ELSE
    UPDATE schools
    SET student_count = (
      SELECT COUNT(*) FROM students
      WHERE school_id = NEW.school_id AND status = 'active'
    )
    WHERE id = NEW.school_id;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_student_count ON students;
CREATE TRIGGER trg_sync_student_count
  AFTER INSERT OR UPDATE OF status OR DELETE ON students
  FOR EACH ROW EXECUTE FUNCTION sync_school_student_count();

-- Back-fill current student counts
UPDATE schools s
SET student_count = (
  SELECT COUNT(*) FROM students st
  WHERE st.school_id = s.id AND st.status = 'active'
);

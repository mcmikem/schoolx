-- Migration: Create dedicated teacher substitutions table
-- Purpose: Resolve logic gap in data storage and enable clash detection

CREATE TABLE IF NOT EXISTS teacher_substitutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    absent_teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    substitute_teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    period INTEGER NOT NULL,
    reason TEXT,
    status TEXT CHECK (status IN ('pending', 'completed', 'cancelled')) DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE teacher_substitutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School users substitutions select"
ON teacher_substitutions FOR SELECT
TO authenticated
USING (
  school_id IN (
    SELECT school_id FROM users WHERE auth_id = auth.uid()
  )
);

CREATE POLICY "School users substitutions insert"
ON teacher_substitutions FOR INSERT
TO authenticated
WITH CHECK (
  school_id IN (
    SELECT school_id FROM users WHERE auth_id = auth.uid()
  )
);

CREATE POLICY "School users substitutions update"
ON teacher_substitutions FOR UPDATE
TO authenticated
USING (
  school_id IN (
    SELECT school_id FROM users WHERE auth_id = auth.uid()
  )
);

-- Performance Index
CREATE INDEX IF NOT EXISTS idx_subs_date ON teacher_substitutions(date);
CREATE INDEX IF NOT EXISTS idx_subs_substitute ON teacher_substitutions(substitute_teacher_id);

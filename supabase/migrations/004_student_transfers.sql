-- Student Transfers Table
-- ============================================
CREATE TABLE IF NOT EXISTS student_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    transfer_type TEXT CHECK (transfer_type IN ('in', 'out')) NOT NULL,
    previous_school TEXT,
    next_school TEXT,
    transfer_date DATE NOT NULL,
    reason TEXT,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'completed')) DEFAULT 'pending',
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for student_transfers
ALTER TABLE student_transfers ENABLE ROW LEVEL SECURITY;

-- Schools can manage their own transfers
DROP POLICY IF EXISTS "Schools manage transfers" ON student_transfers;

CREATE POLICY "Schools manage transfers" ON student_transfers
    FOR ALL TO authenticated
    USING (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid()))
    WITH CHECK (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid()));

-- Suggestions Table
-- ============================================
CREATE TABLE IF NOT EXISTS suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT CHECK (category IN ('feature', 'bug', 'improvement', 'other')) DEFAULT 'other',
    status TEXT CHECK (status IN ('open', 'under_review', 'implemented', 'rejected')) DEFAULT 'open',
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for suggestions
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;

-- Schools can manage their own suggestions
DROP POLICY IF EXISTS "Schools manage suggestions" ON suggestions;

CREATE POLICY "Schools manage suggestions" ON suggestions
    FOR ALL TO authenticated
    USING (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid()))
    WITH CHECK (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid()));

-- Add index for behavior_logs student lookups
CREATE INDEX IF NOT EXISTS idx_behavior_logs_student_date ON behavior_logs(student_id, date DESC);

-- Add school_id to behavior_logs if missing
ALTER TABLE behavior_logs ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

UPDATE behavior_logs bg
SET school_id = s.school_id
FROM students s
WHERE bg.student_id = s.id AND bg.school_id IS NULL;

-- Add RLS for behavior_logs if missing
DROP POLICY IF EXISTS "Schools view behavior logs" ON behavior_logs;

CREATE POLICY "Schools view behavior logs" ON behavior_logs
    FOR ALL TO authenticated
    USING (
        student_id IN (SELECT id FROM students WHERE school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid()))
    )
    WITH CHECK (
        student_id IN (SELECT id FROM students WHERE school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid()))
    );
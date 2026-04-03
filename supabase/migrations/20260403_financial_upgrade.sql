-- Migration: Financial Integrity Upgrade
-- Purpose: Add support for opening balances and structured fee adjustments (discounts/scholarships)

-- 1. Add opening balance to students
ALTER TABLE students ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(12,2) DEFAULT 0;

-- 2. Create fee adjustments table
CREATE TABLE IF NOT EXISTS fee_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    adjustment_type TEXT CHECK (adjustment_type IN ('discount', 'scholarship', 'penalty', 'manual_credit')) NOT NULL,
    notes TEXT,
    recorded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for fee_adjustments
ALTER TABLE fee_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School users adjustments select"
ON fee_adjustments FOR SELECT
TO authenticated
USING (
  school_id IN (
    SELECT school_id FROM users WHERE auth_id = auth.uid()
  )
);

CREATE POLICY "School users adjustments insert"
ON fee_adjustments FOR INSERT
TO authenticated
WITH CHECK (
  school_id IN (
    SELECT school_id FROM users WHERE auth_id = auth.uid()
  )
);

-- Performance Index
CREATE INDEX IF NOT EXISTS idx_adj_student ON fee_adjustments(student_id);
CREATE INDEX IF NOT EXISTS idx_adj_type ON fee_adjustments(adjustment_type);

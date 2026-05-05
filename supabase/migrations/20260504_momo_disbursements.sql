-- MOMO Disbursements Table (for refunds to parents)
CREATE TABLE IF NOT EXISTS momo_disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  parent_phone TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('mtn', 'airtel')),
  amount INTEGER NOT NULL,
  reference TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  external_transaction_id TEXT,
  error_message TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_momo_disbursements_school ON momo_disbursements(school_id);
CREATE INDEX idx_momo_disbursements_status ON momo_disbursements(status);

ALTER TABLE momo_disbursements ENABLE ROW LEVEL SECURITY;

CREATE POLICY  "School admins can manage disbursements" ON momo_disbursements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('school_admin', 'admin', 'headmaster', 'bursar'))
  );
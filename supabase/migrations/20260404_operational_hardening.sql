-- Migration: Operational hardening for grading workflow, soft deletes, and automation dedupe

ALTER TABLE grades
  ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('draft', 'submitted', 'approved', 'published')) DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE fee_payments
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE fee_structure
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE fee_adjustments
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE automated_message_logs
  ADD COLUMN IF NOT EXISTS record_id UUID REFERENCES students(id);

CREATE INDEX IF NOT EXISTS idx_grades_status ON grades(status);
CREATE INDEX IF NOT EXISTS idx_grades_deleted_at ON grades(deleted_at);
CREATE INDEX IF NOT EXISTS idx_fee_payments_deleted_at ON fee_payments(deleted_at);
CREATE INDEX IF NOT EXISTS idx_fee_structure_deleted_at ON fee_structure(deleted_at);
CREATE INDEX IF NOT EXISTS idx_fee_adjustments_deleted_at ON fee_adjustments(deleted_at);
CREATE INDEX IF NOT EXISTS idx_automated_message_logs_record ON automated_message_logs(trigger_id, record_id, sent_at DESC);

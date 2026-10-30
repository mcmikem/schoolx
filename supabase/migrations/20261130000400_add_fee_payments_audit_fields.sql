-- Who last edited a fee payment and when. The PUT /api/fee-payments/[id] route
-- sets both fields on every edit; recorded_by (creation) already exists.
ALTER TABLE fee_payments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);

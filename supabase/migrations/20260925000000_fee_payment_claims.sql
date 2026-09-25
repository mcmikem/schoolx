-- ============================================================================
-- Fee payment claims — manual parent fee payment confirmation
-- ============================================================================
-- Replaces in-app parent payment (Flutterwave/mobile-money push) with a manual
-- flow: a parent pays the school offline (Momo/Airtel/cash), taps "I have paid",
-- and the claim lands here as PENDING for a staff member to confirm.
--
-- A claim is deliberately NOT stored in fee_payments: that table has no status
-- column, so an unconfirmed claim would immediately reduce the student's
-- balance and inflate collection rates. Only an approved claim becomes a real
-- fee_payments row.
-- ============================================================================

CREATE TABLE IF NOT EXISTS fee_payment_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    -- What the parent says they paid with, for the bursar to match against the
    -- school's own Momo/Airtel statement.
    claimed_method TEXT NOT NULL DEFAULT 'mobile_money',
    reference TEXT,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    -- Link to the fee_payments row created on approval, for traceability.
    approved_payment_id UUID REFERENCES fee_payments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fee_payment_claims_school_status
    ON fee_payment_claims(school_id, status);
CREATE INDEX IF NOT EXISTS idx_fee_payment_claims_student
    ON fee_payment_claims(student_id, created_at DESC);

-- One open claim per student at a time keeps the bursar's queue unambiguous
-- and prevents a parent spamming dozens of pending rows.
CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_payment_claims_one_pending
    ON fee_payment_claims(student_id) WHERE status = 'pending';

ALTER TABLE fee_payment_claims ENABLE ROW LEVEL SECURITY;

-- Parents: read and create their own children's claims.
DROP POLICY IF EXISTS "Parents fee_payment_claims select" ON fee_payment_claims;
CREATE POLICY "Parents fee_payment_claims select"
ON fee_payment_claims
FOR SELECT
TO authenticated
USING (student_id IN (SELECT my_student_ids()));

DROP POLICY IF EXISTS "Parents fee_payment_claims insert" ON fee_payment_claims;
CREATE POLICY "Parents fee_payment_claims insert"
ON fee_payment_claims
FOR INSERT
TO authenticated
WITH CHECK (
    student_id IN (SELECT my_student_ids())
    AND school_id = my_school_id()
    AND status = 'pending'
);

-- Staff: full control so they can approve (which creates the fee payment).
DROP POLICY IF EXISTS "Staff fee_payment_claims all" ON fee_payment_claims;
CREATE POLICY "Staff fee_payment_claims all"
ON fee_payment_claims
FOR ALL
TO authenticated
USING (school_id = my_school_id() AND is_staff_role())
WITH CHECK (school_id = my_school_id() AND is_staff_role());

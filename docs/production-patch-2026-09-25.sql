-- ============================================================================
-- SkoolMate OS — SAFE production patch (2026-09-25)
--
-- Run this in Supabase Dashboard -> SQL Editor.
-- Every statement is additive and idempotent (IF NOT EXISTS / guarded), and
-- was verified against the live schema before being included.
--
-- WHY THIS MATTERS
--  1. Perf indexes: the app queries students/attendance/fee_payments by
--     school+class, student, and student+date on nearly every screen. Those
--     indexes were never applied, so each of those screens is doing full
--     table scans — the main reason the app feels slow on 3G.
--  2. Receipt counters: two devices printing a receipt at the same moment
--     can mint the same RCP number (read-max-plus-one race). This makes the
--     counter atomic. The app already falls back gracefully, so applying
--     this upgrades receipts from racy to safe.
--  3. fee_payment_claims: table backing the new manual parent fee-payment
--     flow. Without it parents cannot report a payment.
--
-- NOT INCLUDED (needs fixing first, see notes at the end):
--   202606270001_consolidated_payments_and_modules.sql
-- ============================================================================

BEGIN;

-- Wave 1 (ROADMAP #10): missing performance indexes + payroll_deductions FK hardening
-- Additive + idempotent (IF NOT EXISTS / guarded DO blocks). Safe to re-run.

-- 1. Students filtered by school + class (class lists, attendance, fees)
CREATE INDEX IF NOT EXISTS idx_students_school_class
  ON public.students (school_id, class_id);

-- 2. Fee payments looked up per student (bursar ledger, defaulter engine)
CREATE INDEX IF NOT EXISTS idx_fee_payments_student
  ON public.fee_payments (student_id);

-- 3. Attendance looked up per student + date (streaks, at-risk, reports)
CREATE INDEX IF NOT EXISTS idx_attendance_student_date
  ON public.attendance (student_id, date DESC);

-- 4. Parent→child links resolved per student (parent portal provider)
CREATE INDEX IF NOT EXISTS idx_parent_students_student
  ON public.parent_students (student_id);

-- 5. Teacher→subject assignments resolved per teacher (timetable, workload)
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_teacher
  ON public.teacher_subjects (teacher_id);

-- 6. Events per school + start date (calendar; duplicates 202611010002 guard — IF NOT EXISTS keeps it safe)
CREATE INDEX IF NOT EXISTS idx_events_school_start_date
  ON public.events (school_id, start_date DESC);

-- 7. Payroll deduction lookups (payslip build, payroll run)
CREATE INDEX IF NOT EXISTS idx_payroll_deductions_record
  ON public.payroll_deductions (payroll_record_id);
CREATE INDEX IF NOT EXISTS idx_payroll_deductions_staff
  ON public.payroll_deductions (staff_id);

-- 8. Referential integrity on payroll_deductions (audit L9).
-- NOT VALID: enforces for new writes without failing on legacy orphan rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_payroll_deductions_record'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payroll_records'
  ) THEN
    ALTER TABLE public.payroll_deductions
      ADD CONSTRAINT fk_payroll_deductions_record
      FOREIGN KEY (payroll_record_id) REFERENCES public.payroll_records (id)
      ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_payroll_deductions_staff'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'staff'
  ) THEN
    ALTER TABLE public.payroll_deductions
      ADD CONSTRAINT fk_payroll_deductions_staff
      FOREIGN KEY (staff_id) REFERENCES public.staff (id)
      ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

-- Per-school atomic receipt numbering.
-- Read-max-plus-one in the client raced when two devices receipted at once
-- (UNIQUE(school_id, receipt_number) turned the loser into a 500). This
-- counter makes the next number atomic: INSERT ... ON CONFLICT DO UPDATE
-- takes a row lock, so concurrent callers serialize and never collide.

CREATE TABLE IF NOT EXISTS receipt_counters (
  school_id UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  last_number INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE receipt_counters ENABLE ROW LEVEL SECURITY;
-- No permissive policies: only the SECURITY DEFINER function below touches it.

CREATE OR REPLACE FUNCTION next_receipt_number(p_school_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num INTEGER;
BEGIN
  INSERT INTO receipt_counters AS rc (school_id, last_number)
  VALUES (p_school_id, 1)
  ON CONFLICT (school_id) DO UPDATE SET last_number = rc.last_number + 1
  RETURNING last_number INTO v_num;
  RETURN 'RCP-' || LPAD(v_num::TEXT, 6, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION next_receipt_number(UUID) TO authenticated;

-- Backfill from printed history so numbering continues per school instead of
-- restarting at RCP-000001 (auditors rely on sequential receipt books).
INSERT INTO receipt_counters (school_id, last_number)
SELECT
  school_id,
  COALESCE(MAX(CAST(NULLIF(regexp_replace(receipt_number, '[^0-9]', '', 'g'), '') AS INTEGER)), 0)
FROM receipts
GROUP BY school_id
ON CONFLICT (school_id) DO NOTHING;

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

COMMIT;

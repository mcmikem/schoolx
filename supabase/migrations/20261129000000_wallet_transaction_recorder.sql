-- ============================================================================
-- Record who made a wallet transaction
-- ============================================================================
-- The app already declares `recorded_by` on wallet_transactions, in the setup
-- SQL it runs against a new school. The live table does not have it: the table
-- was created by an earlier migration without the column, and
-- `CREATE TABLE IF NOT EXISTS` is a no-op against a table that already exists.
-- So the source and the database disagreed, silently, and the setup SQL had
-- been describing a table nobody had.
--
-- The other half is the function. topup_student_wallet() inserted a row with no
-- recorded_by at all, so a top-up -- money paid in at the counter -- carried no
-- name against it. That is the exact gap an audit trail exists to close: the
-- amount is on record and the person who took it is not.
--
-- Nullable, so existing rows keep reading as unattributed rather than being
-- back-filled with a guess. p_recorded_by is added as a fifth argument with a
-- default of NULL, which keeps every existing call site working unchanged; the
-- two places that already know who they are pass it.
-- ============================================================================

ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.wallet_transactions.recorded_by IS
  'Staff member who recorded the transaction. NULL on rows written before this column existed, and on entries made without an authenticated session.';

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_recorded_by
  ON public.wallet_transactions (school_id, created_at DESC);

-- Recorded by the same path the app already uses, with the caller supplied.
CREATE OR REPLACE FUNCTION public.topup_student_wallet(
  p_student_id UUID,
  p_amount NUMERIC,
  p_description TEXT,
  p_ref TEXT,
  p_recorded_by UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_wallet_id UUID;
  v_school_id UUID;
BEGIN
  SELECT s.school_id INTO v_school_id
  FROM students s
  WHERE s.id = p_student_id;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'Cannot top up wallet: student not found or not associated with a school';
  END IF;

  INSERT INTO student_wallets (student_id, school_id, balance)
  VALUES (p_student_id, v_school_id, p_amount)
  ON CONFLICT (student_id) DO UPDATE
    SET balance = student_wallets.balance + p_amount,
        last_topup_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO v_wallet_id;

  INSERT INTO wallet_transactions
    (school_id, wallet_id, amount, transaction_type, description, reference_id, recorded_by)
  VALUES
    (v_school_id, v_wallet_id, p_amount, 'topup', p_description, p_ref, p_recorded_by);
END;
$$ LANGUAGE plpgsql;
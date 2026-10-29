-- ============================================================================
-- Every fee payment gets exactly one receipt, including offline replays
-- ============================================================================
-- Offline capture hands the parent a slip without a number: the per-school
-- counter lives on the server, and the page cannot reach it from a field with
-- no signal. The comment in the fees page promised "the receipt book catches
-- up when the queue replays", but nothing actually minted the number when the
-- queue replayed -- those payments never entered the receipt book.
--
-- Minting here rather than in /api/sync/ covers every insert path (fees page,
-- /api/fee-payments, offline replay, imports) and makes the receipt atomic
-- with the payment: there is no window where a payment exists without its
-- receipt, and a lost response cannot lose the receipt.
--
-- Idempotency comes from the payment_id existence check, so a replayed insert
-- (or a retry after a timeout that already committed) never mints a second
-- number. The existing next_receipt_number() counter keeps numbers sequential
-- and collision-free across concurrent devices.

CREATE OR REPLACE FUNCTION public.ensure_receipt_for_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number TEXT;
  v_attempt INTEGER := 0;
BEGIN
  -- A voided payment keeps the receipt it was issued; never mint for a row
  -- that arrives already soft-deleted (imports can carry them). Receipts also
  -- require a pupil and a school, so a malformed import row cannot block.
  IF NEW.deleted_at IS NOT NULL OR NEW.student_id IS NULL OR NEW.school_id IS NULL THEN
    RETURN NEW;
  END IF;

  WHILE v_attempt < 3 LOOP
    v_attempt := v_attempt + 1;

    IF EXISTS (SELECT 1 FROM receipts WHERE payment_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    BEGIN
      v_number := next_receipt_number(NEW.school_id);
    EXCEPTION WHEN OTHERS THEN
      -- Counter table/function missing (database predating 20260917): fall
      -- back to the highest number already in this school's book.
      SELECT 'RCP-' || LPAD(
        (COALESCE(MAX(CAST(NULLIF(regexp_replace(receipt_number, '[^0-9]', '', 'g'), '') AS BIGINT)), 0) + 1)::TEXT,
        6,
        '0'
      )
      INTO v_number
      FROM receipts
      WHERE school_id = NEW.school_id;
    END;

    BEGIN
      INSERT INTO receipts (school_id, student_id, payment_id, receipt_number, amount, issued_at)
      VALUES (
        NEW.school_id,
        NEW.student_id,
        NEW.id,
        v_number,
        NEW.amount_paid,
        COALESCE(NEW.created_at, NOW())
      );
      RETURN NEW;
    EXCEPTION WHEN unique_violation THEN
      -- Another recorder took this number between mint and insert. Loop: the
      -- existence check above now sees their receipt if it was for this
      -- payment; otherwise the counter hands out the next number.
      CONTINUE;
    WHEN OTHERS THEN
      -- Capturing the money matters more than the slip. Never let a receipt
      -- bookkeeping failure roll back the payment; the next edit or replay
      -- will try again.
      RAISE WARNING 'Receipt not minted for payment %: %', NEW.id, SQLERRM;
      RETURN NEW;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_receipt_for_payment ON public.fee_payments;
CREATE TRIGGER trg_ensure_receipt_for_payment
  AFTER INSERT ON public.fee_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_receipt_for_payment();

-- Catch up payments recorded before this trigger existed (offline replays and
-- /api/fee-payments inserts). Order by payment date so each school's book
-- reads in the order the money was received.
DO $$
DECLARE
  r RECORD;
  v_number TEXT;
BEGIN
  FOR r IN
    SELECT p.id, p.school_id, p.student_id, p.amount_paid, p.created_at
    FROM fee_payments p
    WHERE p.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM receipts rc WHERE rc.payment_id = p.id)
    ORDER BY p.school_id, p.payment_date, p.created_at
  LOOP
    BEGIN
      v_number := next_receipt_number(r.school_id);
    EXCEPTION WHEN OTHERS THEN
      SELECT 'RCP-' || LPAD(
        (COALESCE(MAX(CAST(NULLIF(regexp_replace(receipt_number, '[^0-9]', '', 'g'), '') AS BIGINT)), 0) + 1)::TEXT,
        6,
        '0'
      )
      INTO v_number
      FROM receipts
      WHERE school_id = r.school_id;
    END;

    INSERT INTO receipts (school_id, student_id, payment_id, receipt_number, amount, issued_at)
    VALUES (
      r.school_id,
      r.student_id,
      r.id,
      v_number,
      r.amount_paid,
      COALESCE(r.created_at, NOW())
    );
  END LOOP;
END $$;

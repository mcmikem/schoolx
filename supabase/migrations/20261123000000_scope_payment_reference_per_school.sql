-- ============================================================================
-- Scope the payment-reference uniqueness to the school
-- ============================================================================
-- The index is currently
--
--     create unique index idx_fee_payments_reference
--       on public.fee_payments(payment_reference)
--       where payment_reference is not null;
--
-- which is GLOBAL. Every school on the project shares one namespace, so:
--
--   * School A recording reference "R-001" makes "R-001" unusable by School B.
--     Bank transfer references, receipt numbers and school-local references are
--     not globally unique and never were meant to be.
--   * The bursar sees "duplicate key value violates unique constraint
--     idx_fee_payments_reference" and has no way to tell that the clash is with
--     another school's row rather than their own.
--
-- Scoped per school, the constraint does the job it exists for -- stopping the
-- same reference being processed twice for the same school, which is what
-- "prevent duplicate processing" means -- without leaking across tenants.
--
-- NULL stays outside the index, so cash payments with no reference are
-- unaffected: they remain unlimited, as they must be.
--
-- If duplicates already exist WITHIN a school this index cannot be created, so
-- they are collapsed first: the earliest row wins and later ones are cleared.
-- Clearing rather than deleting is deliberate -- these are financial records.
-- ============================================================================

-- 1. Report and clear any in-school duplicates of the same reference.
--    Two payments cannot both be "the payment for that reference" for the same
--    school, so the later one cannot be trusted to process again.
DO $$
DECLARE
  dup record;
  cleared integer := 0;
BEGIN
  FOR dup IN
    SELECT school_id, payment_reference
    FROM fee_payments
    WHERE payment_reference IS NOT NULL
      AND deleted_at IS NULL
    GROUP BY school_id, payment_reference
    HAVING count(*) > 1
  LOOP
    RAISE NOTICE 'duplicate reference % for school % -- keeping the earliest, clearing later rows',
      dup.payment_reference, dup.school_id;
    UPDATE fee_payments p
    SET deleted_at = now()
    WHERE p.school_id = dup.school_id
      AND p.payment_reference = dup.payment_reference
      AND p.deleted_at IS NULL
      AND p.created_at > (
        SELECT min(q.created_at) FROM fee_payments q
        WHERE q.school_id = dup.school_id
          AND q.payment_reference = dup.payment_reference
          AND q.deleted_at IS NULL
      );
    GET DIAGNOSTICS cleared = ROW_COUNT;
    RAISE NOTICE '  % rows soft-deleted', cleared;
  END LOOP;
END $$;

-- 2. Replace the global index with a per-school one.
DROP INDEX IF EXISTS idx_fee_payments_reference;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_payments_reference
  ON public.fee_payments(school_id, payment_reference)
  WHERE payment_reference IS NOT NULL;
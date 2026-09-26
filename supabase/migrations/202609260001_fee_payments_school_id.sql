-- ============================================================================
-- Materialise fee_payments.school_id
-- ============================================================================
-- supabase/schema.sql declares fee_payments.school_id, and several code paths
-- depend on it, but no migration ever created the column — so it does not
-- exist in the live database. Confirmed against production: PostgREST returns
-- 42703 "Could not find the 'school_id' column" for that relation.
--
-- Impact this fixes:
--   - src/lib/hooks/fees.ts filters .eq("school_id", schoolId) when checking
--     for duplicate payments, so that guard could not run.
--   - src/app/api/parent/fee-payment and the SchoolPay sync writer insert it.
--
-- Adding it is additive and safe: existing rows get NULL, and the code paths
-- that scope by student are unaffected. We backfill from the student's school
-- so the column is immediately usable, then index it because the duplicate
-- guard and the bursar ledger both filter on it.
-- ============================================================================

ALTER TABLE public.fee_payments
  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- Backfill from the student's school so existing payments are attributable.
-- Bounded per iteration via ctid: PostgreSQL has no UPDATE ... LIMIT, so the
-- batch boundary has to come from a subquery.
DO $$
DECLARE
  batch_size CONSTANT integer := 5000;
  updated_rows integer := 0;
BEGIN
  LOOP
    UPDATE public.fee_payments fp
       SET school_id = s.school_id
      FROM public.students s
     WHERE fp.ctid IN (
             SELECT ctid FROM public.fee_payments
              WHERE school_id IS NULL
              LIMIT batch_size
           )
       AND fp.student_id = s.id;

    GET DIAGNOSTICS updated_rows = ROW_COUNT;
    EXIT WHEN updated_rows = 0;
  END LOOP;
END $$;

-- Keep it populated for new rows written by code paths that omit it.
CREATE OR REPLACE FUNCTION public.fee_payments_fill_school_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.school_id IS NULL AND NEW.student_id IS NOT NULL THEN
    SELECT s.school_id INTO NEW.school_id
      FROM public.students s
     WHERE s.id = NEW.student_id;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_fee_payments_fill_school_id') THEN
    CREATE TRIGGER trg_fee_payments_fill_school_id
      BEFORE INSERT ON public.fee_payments
      FOR EACH ROW EXECUTE FUNCTION public.fee_payments_fill_school_id();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fee_payments_school_id
  ON public.fee_payments(school_id);

-- Drop the redundant duplicate created by the consolidated index migration,
-- which indexes (student_id) under a school-scoped name.
DROP INDEX IF EXISTS public.idx_fee_payments_school;

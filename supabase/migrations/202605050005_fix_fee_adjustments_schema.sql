-- Fix fee_adjustments table: add missing columns and widen adjustment_type constraint

-- 1. Add deleted_at for soft-delete support
ALTER TABLE public.fee_adjustments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Widen adjustment_type CHECK to include all types used by the application
--    Original only had: discount, scholarship, penalty, manual_credit
--    App also uses: write_off, bursary
ALTER TABLE public.fee_adjustments
  DROP CONSTRAINT IF EXISTS fee_adjustments_adjustment_type_check;

ALTER TABLE public.fee_adjustments
  ADD CONSTRAINT fee_adjustments_adjustment_type_check
  CHECK (adjustment_type IN (
    'discount', 'scholarship', 'penalty', 'manual_credit', 'write_off', 'bursary', 'amnesty'
  ));

-- 3. Index for soft-delete filtering
CREATE INDEX IF NOT EXISTS idx_fee_adjustments_deleted_at
  ON public.fee_adjustments (deleted_at);

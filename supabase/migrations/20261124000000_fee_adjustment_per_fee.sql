-- ============================================================================
-- Let a fee adjustment apply to one fee, not just the pupil in total
-- ============================================================================
-- A bursar granting a discount on meals, or a bursary covering the Development
-- Fund, had nowhere to say so: fee_adjustments carried only student_id, so
-- every discount landed on the pupil's whole bill and the school could not
-- tell which fee it had actually forgiven.
--
-- Nullable, and that matters. Most adjustments are genuinely across the whole
-- bill -- a full write-off, an amnesty -- and forcing a fee on those would be
-- worse than leaving them unattributed. NULL means "applies to the pupil", the
-- original behaviour, and nothing about existing rows changes.
--
-- ON DELETE SET NULL rather than CASCADE: the adjustment itself is the record
-- of a decision. Removing a fee line that is no longer charged must not delete
-- the bursary someone was granted.
-- ============================================================================

ALTER TABLE public.fee_adjustments
  ADD COLUMN IF NOT EXISTS fee_id UUID REFERENCES public.fee_structure(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.fee_adjustments.fee_id IS
  'Fee line this adjustment applies to. NULL means the whole bill.';

-- Supports "which fees has this pupil already had discounted", which is what
-- the adjustment form now needs to avoid stacking the same discount twice.
CREATE INDEX IF NOT EXISTS idx_fee_adjustments_fee_id
  ON public.fee_adjustments (fee_id)
  WHERE fee_id IS NOT NULL;
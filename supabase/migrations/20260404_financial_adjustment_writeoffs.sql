-- Migration: Expand financial adjustment types for real school exits and bursaries
-- Purpose: support write-offs and bursaries without misreporting cash receipts

ALTER TABLE fee_adjustments
  DROP CONSTRAINT IF EXISTS fee_adjustments_adjustment_type_check;

ALTER TABLE fee_adjustments
  ADD CONSTRAINT fee_adjustments_adjustment_type_check
  CHECK (
    adjustment_type IN (
      'discount',
      'scholarship',
      'penalty',
      'manual_credit',
      'write_off',
      'bursary'
    )
  );

COMMENT ON TABLE fee_adjustments IS 'Non-cash fee adjustments including scholarships, bursaries, penalties, manual credits, and write-offs.';
COMMENT ON COLUMN fee_adjustments.adjustment_type IS 'Structured accounting adjustment type. Use write_off for unrecoverable balances and bursary for sponsored support.';

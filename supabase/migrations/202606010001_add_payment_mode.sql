-- Migration: 202606010001_add_payment_mode.sql
-- Adds a new enum type `payment_mode` and a column `payment_mode` to `fee_payments`.

DO $$ BEGIN
  CREATE TYPE payment_mode AS ENUM ('cash', 'card', 'online', 'installments');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE fee_payments
  ADD COLUMN IF NOT EXISTS payment_mode payment_mode NOT NULL DEFAULT 'cash';

-- Ensure existing rows have the default value
UPDATE fee_payments SET payment_mode = 'cash' WHERE payment_mode IS NULL;

-- No additional RLS policy changes needed; column is visible to all authorized roles.

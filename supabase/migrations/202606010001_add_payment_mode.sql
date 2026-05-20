-- Migration: add_payment_mode
-- Adds a payment_mode enum and column to fee_payments

CREATE TYPE payment_mode AS ENUM ('Cash', 'Mobile_Money', 'Bank_Slip', 'SchoolPay');

ALTER TABLE fee_payments
  ADD COLUMN payment_mode payment_mode NOT NULL DEFAULT 'Cash';

-- Ensure existing rows get default value
UPDATE fee_payments SET payment_mode = 'Cash' WHERE payment_mode IS NULL;

--INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('202606020001', 'add_payment_mode', ARRAY['CREATE TYPE payment_mode AS ENUM (''Cash'',''Mobile_Money'',''Bank_Slip'',''SchoolPay'');','ALTER TABLE fee_payments ADD COLUMN payment_mode payment_mode NOT NULL DEFAULT ''Cash'';','UPDATE fee_payments SET payment_mode = ''Cash'' WHERE payment_mode IS NULL;']);

-- No RLS policy changes needed as column is visible to all roles.

-- Record migration

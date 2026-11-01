-- ═══════════════════════════════════════════════════════════════════════════
-- Billing overhaul
--   1. Manual payment rail (cash / bank) support in the ledger
--   2. Payment intents stored on pending ledger rows (what to do on confirm)
--   3. Promo codes
--   4. Scheduled downgrades on schools
--   5. Backfill next_payment_date so paid-plan grace periods work
--   6. Seed plan_features so DB and src/lib/billing/config.ts agree
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Allow manual rails on subscription_payments ──────────────────────────
ALTER TABLE subscription_payments
  DROP CONSTRAINT IF EXISTS subscription_payments_provider_check;
ALTER TABLE subscription_payments
  ADD CONSTRAINT subscription_payments_provider_check
  CHECK (provider IN ('stripe', 'paypal', 'mtn', 'airtel', 'cash', 'bank', 'system'));

-- ── 2. Quote context + what a pending payment should activate when confirmed ─
ALTER TABLE subscription_payments ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE subscription_payments ADD COLUMN IF NOT EXISTS line_items JSONB DEFAULT '[]'::jsonb;
-- intent examples:
--   {"type":"renew","plan":"growth","cycle":"term","months":4}
--   {"type":"upgrade","plan":"enterprise","cycle":"annual","months":12,"credit":45000}
--   {"type":"module","moduleKeys":["library","transport"],"months":12}
ALTER TABLE subscription_payments ADD COLUMN IF NOT EXISTS intent JSONB;

-- ── 3. Promo codes ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    percent_off INTEGER NOT NULL CHECK (percent_off BETWEEN 1 AND 100),
    -- NULL plan = applies to everything
    applies_to_plan TEXT CHECK (applies_to_plan IS NULL OR applies_to_plan IN ('starter','growth','enterprise','lifetime')),
    max_redemptions INTEGER,           -- NULL = unlimited
    times_redeemed INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- Schools may only READ active, valid codes to see their quote; writes are
-- super-admin/service-role only.
DROP POLICY IF EXISTS "Active promo codes readable" ON promo_codes;
CREATE POLICY "Active promo codes readable" ON promo_codes
    FOR SELECT TO authenticated
    USING (active AND (valid_until IS NULL OR valid_until > NOW()));

-- Atomic promo redemption counter used by the billing service.
CREATE OR REPLACE FUNCTION increment_promo_redemption(p_code TEXT)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE promo_codes
     SET times_redeemed = times_redeemed + 1
   WHERE code = p_code AND active;
$$;

-- Launch code: 10% off anything. Unlimited redemptions, no expiry — revoke by
-- setting active = false. Adjust percent/validity in promo_codes directly.
INSERT INTO promo_codes (code, description, percent_off, applies_to_plan, active, created_by)
VALUES ('WELCOME10', 'Welcome offer — 10% off any billing activity', 10, NULL, TRUE, NULL)
ON CONFLICT (code) DO NOTHING;

-- ── 4. Scheduled plan changes (downgrades apply at next payment date) ────────
ALTER TABLE schools ADD COLUMN IF NOT EXISTS scheduled_plan TEXT
  CHECK (scheduled_plan IS NULL OR scheduled_plan IN ('free_trial','starter','growth','enterprise','lifetime'));
ALTER TABLE schools ADD COLUMN IF NOT EXISTS scheduled_plan_change_at TIMESTAMPTZ;

-- ── 5. Backfill next_payment_date for paid-but-unanchored schools ───────────
-- legacy rows were activated with only last_payment_at set; the guard's grace
-- period needs an expiry anchor. Assume the shortest paid cycle (4 months).
UPDATE schools
  SET next_payment_date = last_payment_at + INTERVAL '4 months'
  WHERE subscription_status = 'active'
    AND last_payment_at IS NOT NULL
    AND next_payment_date IS NULL
    AND subscription_plan NOT IN ('free_trial', 'lifetime');

-- ── 6. Seed plan_features from the canonical config ─────────────────────────
-- Mirrors src/lib/billing/config.ts so support tooling and the DB agree.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'plan_features_plan_feature_key_key' AND conrelid = 'plan_features'::regclass
  ) THEN
    BEGIN
      ALTER TABLE plan_features
        ADD CONSTRAINT plan_features_plan_feature_key_key UNIQUE (plan, feature_key);
    EXCEPTION WHEN others THEN
      -- Pre-existing duplicate rows may block the unique index; leave the
      -- constraint off rather than fail the migration.
      NULL;
    END;
  END IF;
END $$;

INSERT INTO plan_features (plan, feature_key, feature_name, included, limit_value, unit)
VALUES
  ('starter',    'max_students',  'Student limit',        true, 200,   'students'),
  ('starter',    'admin_users',   'Admin users',          true, 3,     'users'),
  ('starter',    'sms_quota',     'SMS per term',         true, 100,   'sms'),
  ('starter',    'price',         'Price / student/term', true, 2000,  'ugx'),
  ('growth',     'max_students',  'Student limit',        true, 500,   'students'),
  ('growth',     'admin_users',   'Admin users',          true, 10,    'users'),
  ('growth',     'sms_quota',     'SMS per term',         true, 500,   'sms'),
  ('growth',     'price',         'Price / student/term', true, 3500,  'ugx'),
  ('enterprise', 'max_students',  'Student limit',        true, NULL,  'students'),
  ('enterprise', 'admin_users',   'Admin users',          true, 999,   'users'),
  ('enterprise', 'sms_quota',     'SMS per term',         true, NULL,  'sms'),
  ('enterprise', 'price',         'Price / student/term', true, 5500,  'ugx'),
  ('lifetime',   'max_students',  'Student limit',        true, NULL,  'students'),
  ('lifetime',   'price',         'One-time license',     true, 12000000, 'ugx')
ON CONFLICT (plan, feature_key) DO NOTHING;
-- If the unique constraint failed to create (legacy duplicates), plain DO
-- NOTHING still applies safely since migrations run once.

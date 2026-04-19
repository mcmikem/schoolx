-- Add report & ID card customization columns to schools table
-- These allow super admin to configure per-school branding for reports and ID cards

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS address         TEXT,
  ADD COLUMN IF NOT EXISTS motto           TEXT,
  ADD COLUMN IF NOT EXISTS principal_name  TEXT,
  ADD COLUMN IF NOT EXISTS report_header   TEXT,
  ADD COLUMN IF NOT EXISTS report_footer   TEXT,
  ADD COLUMN IF NOT EXISTS id_card_style   TEXT DEFAULT 'standard';

-- Add feature_stage if not already present (some deployments may be missing it)
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS feature_stage TEXT DEFAULT 'full';

-- Update the subscription_plan CHECK to allow the values used in app
ALTER TABLE schools
  DROP CONSTRAINT IF EXISTS schools_subscription_plan_check;

ALTER TABLE schools
  ADD CONSTRAINT schools_subscription_plan_check
  CHECK (subscription_plan IN ('free_trial', 'starter', 'growth', 'enterprise', 'lifetime', 'basic', 'premium', 'max'));

-- Update the subscription_status CHECK to allow suspended, canceled, unpaid, past_due
ALTER TABLE schools
  DROP CONSTRAINT IF EXISTS schools_subscription_status_check;

ALTER TABLE schools
  ADD CONSTRAINT schools_subscription_status_check
  CHECK (subscription_status IN ('active', 'expired', 'trial', 'past_due', 'suspended', 'canceled', 'unpaid'));

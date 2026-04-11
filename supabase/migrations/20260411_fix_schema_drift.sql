-- Migration: Fix schema drift between application code and database schema
-- Date: 2026-04-11
-- Description: Expands role, subscription_plan, and subscription_status constraints
--              to match the full set of values used by the application code.

-- ============================================================
-- 1. Expand users.role CHECK constraint
-- ============================================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (
  role IN (
    'super_admin', 'school_admin', 'admin', 'board', 'headmaster',
    'dean_of_studies', 'bursar', 'teacher', 'secretary', 'dorm_master',
    'student', 'parent'
  )
);

-- ============================================================
-- 2. Expand schools.subscription_plan CHECK constraint
-- ============================================================
ALTER TABLE schools DROP CONSTRAINT IF EXISTS schools_subscription_plan_check;
ALTER TABLE schools ADD CONSTRAINT schools_subscription_plan_check CHECK (
  subscription_plan IN ('free', 'free_trial', 'basic', 'premium', 'max')
);

-- ============================================================
-- 3. Expand schools.subscription_status CHECK constraint
-- ============================================================
ALTER TABLE schools DROP CONSTRAINT IF EXISTS schools_subscription_status_check;
ALTER TABLE schools ADD CONSTRAINT schools_subscription_status_check CHECK (
  subscription_status IN ('active', 'expired', 'trial', 'past_due', 'canceled', 'unpaid', 'suspended')
);

-- ============================================================
-- 4. Add missing payment tracking columns to schools table
-- ============================================================
ALTER TABLE schools ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMPTZ;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS last_payment_attempt TIMESTAMPTZ;

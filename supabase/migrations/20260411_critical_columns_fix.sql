-- =============================================
-- CRITICAL: Fix missing columns for onboarding
-- Run this to ensure all app functionality works
-- =============================================

-- 1. Schools table columns that code expects
ALTER TABLE schools ADD COLUMN IF NOT EXISTS feature_stage TEXT DEFAULT 'core';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS custom_features JSONB DEFAULT '{}'::jsonb;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS setup_progress JSONB DEFAULT '{"completed": [], "skipped": []}'::jsonb;

-- 2. Schools table: Update subscription_status check constraint to include all statuses
ALTER TABLE schools DROP CONSTRAINT IF EXISTS schools_subscription_status_check;
ALTER TABLE schools ADD CONSTRAINT schools_subscription_status_check 
  CHECK (subscription_status IN ('active', 'expired', 'trial', 'past_due', 'canceled', 'unpaid', 'suspended'));

-- 3. Schools table: Update subscription_plan check constraint to include 'free'
ALTER TABLE schools DROP CONSTRAINT IF EXISTS schools_subscription_plan_check;
ALTER TABLE schools ADD CONSTRAINT schools_subscription_plan_check 
  CHECK (subscription_plan IN ('free', 'free_trial', 'basic', 'premium', 'max'));

-- 4. Users table: Update role check constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('super_admin', 'school_admin', 'admin', 'board', 'headmaster', 'dean_of_studies', 'bursar', 'teacher', 'secretary', 'dorm_master', 'student', 'parent'));

-- 5. Create setup_checklist table (critical for onboarding)
CREATE TABLE IF NOT EXISTS setup_checklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  item_label TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  skipped BOOLEAN DEFAULT false,
  skipped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, item_key)
);

-- 6. Add RLS to setup_checklist
ALTER TABLE setup_checklist ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policy for setup_checklist (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'School admins manage setup_checklist'
  ) THEN
    CREATE POLICY "School admins manage setup_checklist" ON setup_checklist 
      FOR ALL USING (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid() AND role IN ('school_admin', 'admin')));
  END IF;
END
$$;

-- 8. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_schools_feature_stage ON schools(feature_stage);
CREATE INDEX IF NOT EXISTS idx_schools_onboarding ON schools(onboarding_completed);
CREATE INDEX IF NOT EXISTS idx_setup_checklist_school ON setup_checklist(school_id);

-- 9. Create view for setup progress (if not exists)
CREATE OR REPLACE VIEW setup_progress AS
SELECT 
  school_id,
  COUNT(*) as total_items,
  COUNT(*) FILTER (WHERE is_completed = true) as completed_items,
  ROUND(COUNT(*) FILTER (WHERE is_completed = true)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as progress_percent
FROM setup_checklist
GROUP BY school_id;

-- 10. Users table: Add password_reset_required column (used in super-admin)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_required BOOLEAN DEFAULT false;

-- 11. Schools: Add columns used in super-admin
ALTER TABLE schools ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;

-- 12. Students table: Add missing columns commonly needed
ALTER TABLE students ADD COLUMN IF NOT EXISTS repeating BOOLEAN DEFAULT false;
ALTER TABLE students ADD COLUMN IF NOT EXISTS enrollment_date TIMESTAMPTZ;
ALTER TABLE students ADD COLUMN IF NOT EXISTS exit_date TIMESTAMPTZ;
ALTER TABLE students ADD COLUMN IF NOT EXISTS exit_reason TEXT;

-- 13. Classes table: Add columns needed
ALTER TABLE classes ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 60;

-- 14. Fee structure: Add columns
ALTER TABLE fee_structure ADD COLUMN IF NOT EXISTS academic_year TEXT;
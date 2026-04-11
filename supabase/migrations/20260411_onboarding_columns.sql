-- Add all onboarding and customization columns to schools table
-- This ensures all settings can be saved during onboarding

-- Feature stage controls which modules are available
ALTER TABLE schools ADD COLUMN IF NOT EXISTS feature_stage TEXT DEFAULT 'core';

-- Custom features JSONB for granular feature toggles
ALTER TABLE schools ADD COLUMN IF NOT EXISTS custom_features JSONB DEFAULT '{}'::jsonb;

-- Onboarding completion tracking
ALTER TABLE schools ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Setup progress tracking
ALTER TABLE schools ADD COLUMN IF NOT EXISTS setup_progress JSONB DEFAULT '{"completed": [], "skipped": []}'::jsonb;

-- Add these columns to the school_settings table for flexible key-value config
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS value_type TEXT DEFAULT 'text';
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS value_json JSONB;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_school_settings_key ON school_settings(school_id, key);

-- Grant permissions (will be handled by RLS but ensure table is accessible)
COMMENT ON COLUMN schools.feature_stage IS 'Controls which modules are available: core, academic, finance, full';
COMMENT ON COLUMN schools.custom_features IS 'JSON object for granular feature toggles per module';
COMMENT ON COLUMN schools.onboarding_completed IS 'Whether the initial onboarding has been completed';
COMMENT ON COLUMN schools.setup_progress IS 'Tracks which setup items have been completed or skipped';
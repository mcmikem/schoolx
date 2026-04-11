-- Add feature_stage column to schools table for onboarding customization
-- This column controls which modules are available to a school (core, academic, finance, full)
ALTER TABLE schools ADD COLUMN IF NOT EXISTS feature_stage TEXT DEFAULT 'core';

-- Also add custom_features JSONB for granular feature toggles
ALTER TABLE schools ADD COLUMN IF NOT EXISTS custom_features JSONB DEFAULT '{}'::jsonb;
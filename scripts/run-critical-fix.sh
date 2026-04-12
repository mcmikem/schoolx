#!/bin/bash
# Run critical columns fix directly

echo "Running critical SQL directly..."

SQL='ALTER TABLE schools ADD COLUMN IF NOT EXISTS feature_stage TEXT DEFAULT '\''core'\'';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS custom_features JSONB DEFAULT '\''{}'\''::jsonb;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS setup_progress JSONB DEFAULT '\''{"completed": [], "skipped": []}'\''::jsonb;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_required BOOLEAN DEFAULT false;
ALTER TABLE students ADD COLUMN IF NOT EXISTS repeating BOOLEAN DEFAULT false;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 60;

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

ALTER TABLE setup_checklist ENABLE ROW LEVEL SECURITY;'

echo "$SQL" | SUPABASE_ACCESS_TOKEN=sbp_9ecbbe0c8c9e2feeef2c201752bfd7ee17584af9 supabase db query --project-ref gucxpmgwvnbqykevucbi "$SQL" 2>&1 || echo "Trying alternative..."
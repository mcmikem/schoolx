#!/bin/bash

# Run critical columns fix directly
# Usage: ./scripts/run-critical-fix.sh
# Required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

set -e

# Check required environment variables
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo "Error: NEXT_PUBLIC_SUPABASE_URL is not set"
  echo "Please set it in your .env file or export it before running this script"
  exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "Error: SUPABASE_SERVICE_ROLE_KEY is not set"
  echo "Please set it in your .env file or export it before running this script"
  exit 1
fi

echo "Running critical SQL directly..."

SQL='ALTER TABLE schools ADD COLUMN IF NOT EXISTS feature_stage TEXT DEFAULT '\''core'\'';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS custom_features JSONB DEFAULT '\''{}'\''::jsonb;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS setup_progress JSONB DEFAULT '\''{"completed": [], "skipped": []}'\''::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '\''{}'\''::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
ALTER TABLE setup_checklist ADD COLUMN IF NOT EXISTS last_verified TIMESTAMPTZ;
ALTER TABLE setup_checklist ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id);
ALTER TABLE setup_checklist ENABLE ROW LEVEL SECURITY;'

# Use Supabase CLI if available, otherwise use curl
if command -v supabase &> /dev/null && [ -n "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "Using Supabase CLI..."
  echo "$SQL" | supabase db query --project-ref "${NEXT_PUBLIC_SUPABASE_URL#https://}" 2>&1 || echo "Trying alternative..."
else
  echo "Using curl to apply migration..."
  curl -X POST \
    "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"$SQL\"}"
fi

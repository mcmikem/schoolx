#!/bin/bash

# Apply migrations to Supabase via REST API
# Usage: ./scripts/db-push.sh
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

SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL"
SERVICE_KEY="$SUPABASE_SERVICE_ROLE_KEY"

# Create the SQL query to add columns
SQL='ALTER TABLE schools ADD COLUMN IF NOT EXISTS feature_stage TEXT DEFAULT '\''core'\'';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS custom_features JSONB DEFAULT '\''{}'\''::jsonb;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS setup_progress JSONB DEFAULT '\''{"completed": [], "skipped": []}'\''::jsonb;'

# Use psql if available, otherwise show what to do
if command -v psql &> /dev/null; then
    echo "Using psql..."
    PGPASSWORD="$SERVICE_KEY" psql -h "$SUPABASE_URL" -U postgres -d postgres -c "$SQL"
else
    echo "Installing psql..."
    brew install postgresql 2>/dev/null || (echo "Can't auto-install. Please run manually:" && echo "$SQL")
fi

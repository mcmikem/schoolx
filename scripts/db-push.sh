#!/bin/bash

# Apply migrations to Supabase via REST API
# Usage: ./scripts/db-push.sh

SUPABASE_URL="https://gucxpmgwvnbqykevucbi.supabase.co"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1Y3hwbWd3dm5icXlrZXZ1Y2JpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE3NjYxMCwiZXhwIjoyMDg5NzUyNjEwfQ.u-yxVo_MfiXnoj6UlFZgcAsNinM0XY4PryIUp77O-7Y"

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
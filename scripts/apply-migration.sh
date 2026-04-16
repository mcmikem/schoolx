#!/bin/bash

# Apply migrations to Supabase
# Usage: ./scripts/apply-migration.sh [file.sql]
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

# Read SQL from file or argument
if [ -n "$1" ]; then
  SQL=$(cat "$1")
  echo "Applying migration from: $1"
else
  echo "Usage: ./scripts/apply-migration.sh [file.sql]"
  exit 1
fi

# Use psql if available, otherwise use curl
if command -v psql &> /dev/null; then
  echo "Using psql..."
  PGPASSWORD="$SERVICE_KEY" psql -h "$SUPABASE_URL" -U postgres -d postgres -c "$SQL"
else
  echo "Using curl..."
  curl -X POST \
    "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
    -H "apikey: ${SERVICE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"$SQL\"}"
fi

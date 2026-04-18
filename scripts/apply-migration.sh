#!/bin/bash

# Apply migrations to Supabase
# Usage: ./scripts/apply-migration.sh [file.sql]
# Preferred env vars: SUPABASE_DB_URL / POSTGRES_URL / DATABASE_URL
# Fallback env vars: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY

set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: ./scripts/apply-migration.sh [file.sql]"
  exit 1
fi

SQL_FILE="$1"
if [ ! -f "$SQL_FILE" ]; then
  echo "Error: SQL file not found: $SQL_FILE"
  exit 1
fi

echo "Applying migration from: $SQL_FILE"

DB_URL="${SUPABASE_DB_URL:-${POSTGRES_URL:-${POSTGRES_URL_NON_POOLING:-${DATABASE_URL:-}}}}"

if [ -n "$DB_URL" ] && command -v psql >/dev/null 2>&1; then
  echo "Using psql with database URL..."
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE"
  exit 0
fi

if [ -z "${NEXT_PUBLIC_SUPABASE_URL:-}" ] || [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "Error: Set SUPABASE_DB_URL/POSTGRES_URL for psql, or NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for RPC fallback."
  exit 1
fi

SQL_JSON=$(python3 - "$SQL_FILE" <<'PY'
import json
import pathlib
import sys
print(json.dumps(pathlib.Path(sys.argv[1]).read_text()))
PY
)

echo "Using exec_sql RPC fallback..."
curl --fail-with-body -sS \
  -X POST "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"sql\": ${SQL_JSON}}"


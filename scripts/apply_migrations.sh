#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------
# apply_migrations.sh – Idempotent Supabase migration handling
# ---------------------------------------------------------------
# This script:
#   1. Renames migration files with a fresh timestamp to avoid conflicts.
#   2. Strips any manual INSERT into supabase_migrations.schema_migrations.
#   3. Runs `supabase db push --linked` to apply the migrations.
# ---------------------------------------------------------------

MIGRATIONS_DIR="$(dirname "$0")/../supabase/migrations"

log() { echo "[apply_migrations] $*"; }

log "Renaming migration files with a new timestamp"
for file in "$MIGRATIONS_DIR"/*_student_nin_fix.sql "$MIGRATIONS_DIR"/*_refund_requests.sql "$MIGRATIONS_DIR"/*_co_curricular.sql "$MIGRATIONS_DIR"/*_student_nin.sql; do
  if [[ -f "$file" ]]; then
    ts=$(date -u +%Y%m%d%H%M%S)
    base=$(basename "$file")
    new="$MIGRATIONS_DIR/${ts}_$base"
    mv "$file" "$new"
    log "Renamed $file → $new"
    sleep 1  # ensure unique timestamps
  fi
done

log "Removing any manual INSERT into schema_migrations"
find "$MIGRATIONS_DIR" -type f -name "*.sql" -exec sed -i.bak '/INSERT INTO supabase_migrations.schema_migrations/d' {} +

log "Pushing migrations to Supabase (linked)"
supabase db push --linked

log "All migrations applied successfully"

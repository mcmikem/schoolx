#!/usr/bin/env bash

# -------------------------------------------------------------------
# fix_student_nin_migration.sh
# -------------------------------------------------------------------
# Automates the rename and idempotent edit of the problematic
# `student_nin_fix.sql` migration for the Omuto School Management System.
#
# Steps performed:
#   1. Locate the migration file matching '*student_nin_fix.sql'.
#   2. Generate a new timestamp (UTC) that is newer than all existing
#      migration timestamps.
#   3. Rename the file to `<new_timestamp>_student_nin_fix.sql`.
#   4. Edit the file:
#        • Remove any manual INSERT into `supabase_migrations.schema_migrations`.
#        • Convert the `ALTER TABLE` statement to be idempotent using
#          `IF NOT EXISTS`.
#   5. Print a summary of actions.
#
# Usage:
#   $ cd "$(git rev-parse --show-toplevel)"
#   $ ./supabase/migrations/fix_student_nin_migration.sh
# -------------------------------------------------------------------

set -euo pipefail

# Directory containing migrations (relative to script location)
MIGRATION_DIR="$(dirname "$0")"

# Find the original migration file (case‑sensitive match)
original_file=$(find "$MIGRATION_DIR" -maxdepth 1 -type f -name "*student_nin_fix.sql" | head -n 1)

if [[ -z "$original_file" ]]; then
  echo "[ERROR] No migration file ending with 'student_nin_fix.sql' found in $MIGRATION_DIR"
  exit 1
fi

# Extract the base name (without path)
base_name=$(basename "$original_file")

echo "[INFO] Found migration file: $base_name"

# Generate a new UTC timestamp greater than existing ones
# We'll use the current UTC date‑time in YYYYMMDDHHMMSS format
new_timestamp=$(date -u +"%Y%m%d%H%M%S")
new_file="${new_timestamp}_student_nin_fix.sql"
new_path="$MIGRATION_DIR/$new_file"

# Rename the file
mv "$original_file" "$new_path"

echo "[INFO] Renamed to: $new_file"

# -------------------------------------------------------------------
# Edit the migration file in‑place using `sed`
#   • Remove any line that inserts into `supabase_migrations.schema_migrations`
#   • Replace the ALTER TABLE statement with an idempotent version
# -------------------------------------------------------------------

# 1️⃣ Remove manual INSERT statements (if present)
sed -i '' '/INSERT INTO supabase_migrations\.schema_migrations/d' "$new_path"

# 2️⃣ Make the ALTER TABLE idempotent
#    Look for a line containing "ALTER TABLE" and replace it with the
#    IF NOT EXISTS variant.
#    This handles variations of whitespace and optional IF EXISTS.
sed -i '' -E 's/ALTER TABLE[[:space:]]+IF[[:space:]]+EXISTS[[:space:]]+([^[:space:]]+)[[:space:]]+ADD[[:space:]]+COLUMN[[:space:]]+([^;]+);/ALTER TABLE IF EXISTS \1\n  ADD COLUMN IF NOT EXISTS \2;/' "$new_path"

# In case the original statement lacked the preceding IF EXISTS, handle that too:
sed -i '' -E 's/ALTER TABLE[[:space:]]+([^[:space:]]+)[[:space:]]+ADD[[:space:]]+COLUMN[[:space:]]+([^;]+);/ALTER TABLE IF EXISTS \1\n  ADD COLUMN IF NOT EXISTS \2;/' "$new_path"

echo "[INFO] Edited migration to be idempotent and removed manual INSERTs."

# -------------------------------------------------------------------
# Summary
# -------------------------------------------------------------------

echo "--- Migration fix complete ---"
echo "New file: $new_file"
cat "$new_path"

exit 0

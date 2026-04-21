#!/usr/bin/env zsh
# Apply pending Supabase migrations via Management API using curl

set -e

PROJECT_REF="gucxpmgwvnbqykevucbi"
API_URL="https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query"
MIGRATIONS_DIR="$(dirname "$0")/../supabase/migrations"

# Get token from macOS keychain
MTOKEN=$(security find-generic-password -s "Supabase CLI" -w | sed 's/^go-keyring-base64://' | base64 -d)
echo "Token: ${MTOKEN:0:12}..."

api_query() {
  local sql="$1"
  # Use Python to JSON-encode the SQL safely (handles quotes, newlines, etc.)
  local json
  json=$(python3 -c "import sys,json; print(json.dumps({'query': sys.stdin.read()}))" <<< "$sql")
  curl -s -X POST "$API_URL" \
    -H "Authorization: Bearer $MTOKEN" \
    -H "Content-Type: application/json" \
    -d "$json"
}

already_applied() {
  local version="$1"
  local result
  result=$(api_query "SELECT version FROM supabase_migrations.schema_migrations WHERE version = '$version' LIMIT 1")
  # If result contains the version, it's already applied
  echo "$result" | python3 -c "import sys,json; data=json.load(sys.stdin); sys.exit(0 if len(data)>0 else 1)" 2>/dev/null
}

record_migration() {
  local version="$1"
  local name_part
  name_part=$(echo "$version" | sed 's/^[0-9]*_//')
  api_query "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('$version', '$name_part') ON CONFLICT DO NOTHING" > /dev/null
}

apply_migration() {
  local name="$1"
  local filepath="$MIGRATIONS_DIR/${name}.sql"

  if [[ ! -f "$filepath" ]]; then
    echo "  [SKIP]  $name — file not found"
    return 0
  fi

  if already_applied "$name" 2>/dev/null; then
    echo "  [SKIP]  $name — already applied"
    return 0
  fi

  echo "  [RUN]   $name..."
  local result
  result=$(api_query "$(cat "$filepath")")

  if echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if 'message' in d and 'already exists' not in d.get('message','').lower() else 1)" 2>/dev/null; then
    echo "  [FAIL]  $name"
    echo "          $(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message','?')[:200])" 2>/dev/null || echo "$result" | head -c 200)"
    FAILURES=$((FAILURES + 1))
    return 1
  else
    record_migration "$name"
    echo "  [OK]    $name"
    PASSED=$((PASSED + 1))
    return 0
  fi
}

echo ""
echo "Testing connection..."
TEST=$(api_query "SELECT 1 AS ok")
if echo "$TEST" | grep -q '"message"'; then
  echo "Connection FAILED: $TEST"
  exit 1
fi
echo "  Connected OK"
echo ""

PASSED=0
FAILURES=0

apply_migration "20260419_fix_fee_terms_rls"
apply_migration "20260420_fix_ncdc_rls"
apply_migration "20260420_rate_limit_log"
apply_migration "20260420_role_based_rls"
apply_migration "20260420_school_customization"
apply_migration "20260420_school_workflows"
apply_migration "20260421_drop_permissive_policies"
apply_migration "20260421_eliminate_all_recursive_rls"
apply_migration "20260421_fix_missing_rls_policies"
apply_migration "20260421_fix_rls_auth_id"
apply_migration "20260421_fix_rls_missing_policies"
apply_migration "20260421_fix_users_rls_recursion"
apply_migration "20260421_restore_syllabus_insert_policies"
apply_migration "20260421_sms_triggers_and_library_issues"
apply_migration "20260422_create_missing_tables"
apply_migration "20260422_fix_grades_and_timetable_rls"

echo ""
echo "============================================"
echo "Done: $PASSED applied/skipped, $FAILURES failed"

if [[ $FAILURES -gt 0 ]]; then
  exit 1
fi

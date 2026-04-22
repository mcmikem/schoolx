#!/usr/bin/env python3
"""
Apply pending Supabase migrations via the Management API.
Bypasses CLI migration history format mismatch.
"""
import subprocess, base64, json, urllib.request, urllib.error, os, sys

# --- Config ---
PROJECT_REF = "gucxpmgwvnbqykevucbi"
API_URL = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"
MIGRATIONS_DIR = os.path.join(os.path.dirname(__file__), "..", "supabase", "migrations")

# New migrations not yet applied (in order)
NEW_MIGRATIONS = [
    "20260419_fix_fee_terms_rls",
    "20260420_fix_ncdc_rls",
    "20260420_rate_limit_log",
    "20260420_role_based_rls",
    "20260420_school_customization",
    "20260420_school_workflows",
    "20260421_drop_permissive_policies",
    "20260421_eliminate_all_recursive_rls",
    "20260421_fix_missing_rls_policies",
    "20260421_fix_rls_auth_id",
    "20260421_fix_rls_missing_policies",
    "20260421_fix_users_rls_recursion",
    "20260421_restore_syllabus_insert_policies",
    "20260421_sms_triggers_and_library_issues",
    "20260422_create_missing_tables",
    "20260422_fix_grades_and_timetable_rls",
]

def get_token():
    raw = subprocess.check_output(
        ["security", "find-generic-password", "-s", "Supabase CLI", "-w"],
        text=True
    ).strip()
    # Format: go-keyring-base64:<base64data>
    if raw.startswith("go-keyring-base64:"):
        raw = raw[len("go-keyring-base64:"):]
    return base64.b64decode(raw).decode()

def api_query(token, sql):
    data = json.dumps({"query": sql}).encode("utf-8")
    req = urllib.request.Request(
        API_URL,
        data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read()), None
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        return None, body

def already_applied(token, version):
    result, err = api_query(
        token,
        f"SELECT version FROM supabase_migrations.schema_migrations WHERE version = '{version}' LIMIT 1"
    )
    if err:
        return False
    return len(result) > 0

def record_migration(token, version):
    name_part = "_".join(version.split("_")[1:]) if "_" in version else version
    sql = (
        f"INSERT INTO supabase_migrations.schema_migrations (version, name) "
        f"VALUES ('{version}', '{name_part}') ON CONFLICT DO NOTHING"
    )
    _, err = api_query(token, sql)
    return err is None

def main():
    print("Getting Supabase access token from keychain...")
    try:
        token = get_token()
        print(f"  Token: {token[:12]}...")
    except Exception as e:
        print(f"  ERROR: {e}")
        sys.exit(1)

    # Test connection
    result, err = api_query(token, "SELECT 1 AS ok")
    if err:
        print(f"  Connection test FAILED: {err}")
        sys.exit(1)
    print("  Connection OK\n")

    passed = 0
    failed = 0

    for migration in NEW_MIGRATIONS:
        filepath = os.path.join(MIGRATIONS_DIR, f"{migration}.sql")
        if not os.path.exists(filepath):
            print(f"  [SKIP]  {migration}.sql — file not found")
            continue

        # Check if already applied
        if already_applied(token, migration):
            print(f"  [SKIP]  {migration} — already in migration table")
            passed += 1
            continue

        print(f"  [RUN]   {migration}...")
        with open(filepath, "r") as f:
            sql = f.read()

        result, err = api_query(token, sql)
        if err:
            # Check if it's a non-fatal error (already exists / policy already exists)
            err_lower = err.lower()
            if any(x in err_lower for x in ["already exists", "duplicate", "42p07", "42710", "if not exists"]):
                print(f"          (idempotent — already exists, marking as applied)")
                record_migration(token, migration)
                passed += 1
            else:
                print(f"  [FAIL]  {migration}")
                print(f"          Error: {err[:300]}")
                failed += 1
        else:
            record_migration(token, migration)
            print(f"  [OK]    {migration}")
            passed += 1

    print(f"\n{'='*50}")
    print(f"Done: {passed} passed, {failed} failed")
    if failed > 0:
        sys.exit(1)

if __name__ == "__main__":
    main()

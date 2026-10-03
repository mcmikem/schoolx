# Rotating the leaked Supabase service-role key

**Status: OPEN — not yet rotated. The exposed key is still live.**

| | |
|---|---|
| Repo | `mcmikem/schoolx` (**public**) |
| Secret | Supabase `service_role` JWT |
| First committed | 2026-04-11, commit `47aa474` |
| Files at that commit | `scripts/apply-migration.sh`, `scripts/db-push.sh` |
| Verified live | HTTP 200 against the project REST API on 2026-10-03 |
| Also committed | a `SUPABASE_ACCESS_TOKEN` in `scripts/run-critical-fix.sh` (`50519ace`, 2026-04-12) — **verified dead (HTTP 401)** |
| HEAD today | **clean.** The scripts now read from the environment; the secret exists only in history |

`service_role` bypasses RLS entirely. Anyone who clones this repository can read
every table in the project — users, students, fee records — and write to them.

## Why the leak is not the urgent part

The key has been public since April. GitHub's file-history viewer exposes it to
anyone who navigates to the file at that commit, so no clone is even required.
Scraper caches and search indexes may already hold it.

**Rotating is the fix. Rewriting history is only hygiene.** Deleting the commits
does not un-publish a secret that has been readable for six months.

Confirmed blast radius (2026-10-03):

- HEAD of all 6 public repos in the `mcmikem` account: clean
- Forks of `schoolx`: none
- The exposure is confined to `schoolx` history

---

## Order of operations

Do these in order. **Do not skip step 3** — revoking before Vercel holds the new
key takes production down, because every server-side Supabase call authenticates
with `SUPABASE_SERVICE_ROLE_KEY`.

### 1. Create the replacement key

Supabase dashboard → project **Omuto School Management System** (`gucxpmgwvnbqykevucbi`)
→ **Project Settings → API Keys** → **Create new secret key**.

Copy it immediately — the dashboard shows it once.

### 2. Put it in Vercel

Vercel → project `omuto-school-management` → **Settings → Environment Variables**.

Set **`SUPABASE_SERVICE_ROLE_KEY`** to the new value for **all three** environments
(Production, Preview, Development). Editing a variable triggers a redeploy; if you
edit Production last you avoid promoting a half-migrated build.

Verify the old key is gone from Vercel rather than merely shadowed.

### 3. Verify production uses the new key

Confirm the app is healthy, then prove the new key works **and the old one no
longer does**:

```bash
URL=https://skoolmate.omuto.org

curl -s -o /dev/null -w 'app health -> %{http_code}\n' "$URL/api/health/"

NEW='<paste the new key>'
OLD=$(git show 47aa474:scripts/apply-migration.sh \
  | grep -oE 'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}')

API="$NEXT_PUBLIC_SUPABASE_URL/rest/v1/schools?select=id&limit=1"

curl -s -o /dev/null -w 'new key -> %{http_code}\n' \
  -H "apikey: $NEW" -H "Authorization: Bearer $NEW" "$API"

curl -s -o /dev/null -w 'old key -> %{http_code}\n' \
  -H "apikey: $OLD" -H "Authorization: Bearer $OLD" "$API"
```

Expected: app health **200**, new key **200**, old key **401**.

Until the old key returns 401 the leak is still live.

### 4. Revoke the old key

Only after step 3 shows 401 is unnecessary — the old key is already dead. If you
created the replacement without revoking, return to **API Keys** and delete the
April key now. Revoking is what actually closes the exposure.

### 5. Update local development

```bash
SUPABASE_SERVICE_ROLE_KEY=<new key>   # in .env.local
```

### 6. History hygiene (optional, destructive)

```bash
npm run purge:secrets
git push --force-with-lease
```

This rewrites every commit SHA after April 2026, breaks existing clones, open PRs
and anything referencing old SHAs. It does not reduce risk once the key has been
rotated — do it only if you want the history scrubbed.

### 7. Clear the suppression

Once the key is revoked, delete its entry from `.gitleaksignore` and re-scan:

```bash
npm run scan:secrets        # expect: no leaks found
```

`.gitleaksignore` currently suppresses three fingerprints. The other two are
already dead, so after this rotation all three can go and CI will enforce a clean
history going forward.

---

## Preventing a repeat

Already in place:

- `gitleaks` in the pre-commit hook (step 1/4) on staged files
- `gitleaks` over full history in CI (`npm run scan:secrets`)
- `npm run check:production-leakage`

Worth noting: CI has never actually executed. GitHub Actions reports
*"The job was not started because your account is locked due to a billing issue."*
Until billing is resolved, **the pre-commit hook is the only automated gate**, and
it only sees staged files.

## Rollback

Nothing here is destructive to application state. If the new key misbehaves,
create another key and repeat from step 1 — do not restore the revoked one.
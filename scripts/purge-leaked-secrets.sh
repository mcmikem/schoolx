#!/usr/bin/env bash
#
# Purge the April 2026 leaked credentials from this repository's git history.
#
#   npm run purge:secrets
#
# READ THIS FIRST
# ---------------
# This script REWRITES HISTORY. Every commit SHA after the affected commits
# changes, which means:
#
#   * `git push --force-with-lease` to origin is required
#   * every existing clone must be re-cloned or hard-reset
#   * any open pull requests become unmergeable
#   * anything already referencing the old SHAs (CI badges, Vercel links,
#     bookmarks) breaks
#
# Most importantly: THIS IS NOT WHAT FIXES THE LEAK.
#
# A credential that sat in a public repository for five months must be assumed
# compromised. Deleting it from history does not un-publish it -- it is already
# in clones, forks, scraper caches and search indexes. The only real fix is to
# rotate the credential in its issuing system:
#
#   Supabase: create a new secret key, deploy it to Vercel, THEN revoke the
#             old one. That is the step that matters.
#
# Run this afterwards purely as hygiene.
#
set -euo pipefail

FILES=(
  "scripts/apply-migration.sh"
  "scripts/db-push.sh"
  "scripts/run-critical-fix.sh"
)

BEFORE_SHA=$(git rev-parse HEAD)

if ! command -v git-filter-repo >/dev/null 2>&1 && ! git filter-repo --version >/dev/null 2>&1; then
  cat <<'EOF'
git-filter-repo is required.

  pipx install git-filter-repo        # recommended
  # or: pip3 install --user git-filter-repo

This script will NOT fall back to `git filter-branch`: that tool is slow,
deprecated, and easy to get wrong on a repository this size.
EOF
  exit 1
fi

cat <<'EOF'

This will rewrite the entire history of:

EOF
printf '  %s\n' "${FILES[@]}"
cat <<'EOF'

Confirm the working tree is clean first:  git status --porcelain
EOF

read -r -p "Type 'rewrite' to continue: " CONFIRM
if [ "$CONFIRM" != "rewrite" ]; then
  echo "Aborted. Nothing changed."
  exit 0
fi

echo "Removing the affected files from all commits..."
git filter-repo --invert-paths \
  --path "${FILES[0]}" \
  --path "${FILES[1]}" \
  --path "${FILES[2]}" \
  --force

echo
echo "History rewritten: ${BEFORE_SHA} -> $(git rev-parse HEAD)"
echo
echo "Verifying the credentials are gone from history..."
if gitleaks git --redact --no-banner --log-level error; then
  echo "  OK: no secrets found in the rewritten history."
else
  echo "  WARNING: gitleaks still reports findings. Inspect before pushing."
fi

cat <<'EOF'

Next steps:
  1. Review:  git log --oneline -5
  2. Force-push:  git push --force-with-lease origin main
  3. Rotate the Supabase service_role key in the dashboard. This is the step
     that actually closes the exposure -- the force-push above does not.
  4. Once rotated, delete the stale fingerprint from .gitleaksignore.
EOF

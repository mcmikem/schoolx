# EGM Remediation Report

**Status:** Core remediation applied; platform-level hardening remains.

## Fixed in this pass

- Removed published demo credentials from README and documented development-only gating.
- Corrected product identity and removed stale subscription matrix.
- Corrected mobile-money provider documentation and CI environment names.
- Documented release gates, offline boundaries, and production operations.
- Added private, school-scoped student-photo storage policies and signed URL generation.
- Added protected-field stripping for generic service-role sync updates.
- Added mobile-money amount verification against the pending ledger amount.
- Added webhook processing claims to prevent concurrent duplicate handling.
- Added payment-ledger processing claims to reduce concurrent subscription activation.
- Fixed clean schema ordering for `schools.onboarded_by`.
- Made production startup fail on missing required configuration.
- Added a production leakage allowlist entry for the explicitly development-only student demo.
- Replaced the rate-limit count/insert race with an atomic Supabase RPC using a
  transaction-scoped advisory lock.
- Applied the atomic rate-limit migration to the remote database.

## Verification

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm test -- --runInBand` passed: 237 suites, 2,519 tests.
- `npm run test:regression` passed: 164 tests.
- `npm run check:production-leakage` passed.
- `npm run build` passed.
- Atomic rate-limit migration is recorded remotely as `20261204000100`.
- Schema drift has 91 historical live-only columns remaining in the baseline;
  these require typed compatibility declarations or reviewed removal.

## Remaining work requiring infrastructure or product decisions

- Full RLS least-privilege review across every sensitive table needs a role
  matrix and live database tests.
- Registration provisioning, asynchronous SMS, encrypted offline storage,
  backup/restore drills, and deployment migration gates need system-level
  rollout work beyond a safe local patch.
- Existing direct student-photo URLs stored in old rows need a migration or
  signed-URL refresh strategy for already persisted records.
- Supabase migration history contains a pre-existing duplicate `202611030001`
  version/name mismatch. The duplicate local hardening filename was removed,
  and `20261204000100` was repaired as applied. `supabase db push --dry-run`
  now reports the remote database is up to date.

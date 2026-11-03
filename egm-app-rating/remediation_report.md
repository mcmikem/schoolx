# EGM Remediation Report

**Status:** Partially resolved after user instruction to fix all findings.

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

## Verification

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm test -- --runInBand` passed: 237 suites, 2,519 tests.
- `npm run test:regression` passed: 164 tests.
- `npm run check:production-leakage` passed.
- `npm run build` passed.

## Remaining work requiring infrastructure or product decisions

- `npm run check:schema-drift` still reports 16 live-database differences. The
  repository contains migrations for several of them, but applying migrations
  to the configured live database requires deployment credentials and operator
  approval; it was not silently performed.
- Distributed rate limiting needs a selected Redis/edge implementation and
  production connectivity; no new dependency was guessed.
- Full RLS least-privilege review across every sensitive table needs a role
  matrix and live database tests.
- Registration provisioning, asynchronous SMS, encrypted offline storage,
  backup/restore drills, and deployment migration gates need system-level
  rollout work beyond a safe local patch.
- Existing direct student-photo URLs stored in old rows need a migration or
  signed-URL refresh strategy for already persisted records.

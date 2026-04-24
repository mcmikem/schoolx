# Execution Review + Market-Ready Upgrade Plan (2026-04-24)

## What got fixed in this execution

- Added enforceable DB contract guardrails via `check:db-contract` and aligned schema to app table usage.
- Removed duplicate table declarations (`dorms`, `dorm_students`, `lesson_plans`) from `supabase/schema.sql`.
- Added missing app-referenced tables in schema: `books`, `book_checkouts`, `discipline`, `notices`, `period_attendance`, `timetable`, `visitors`.
- Updated timetable relation mapping to use `users` relation (`teachers:users!teacher_id`) instead of a missing `profiles` relation.
- Added local `xlsx` type declaration to unblock TypeScript declaration checks in environments where runtime package exists.

## What is still missing

1. **Clean lint baseline**
   - Next 16 no longer supports `next lint` command in this environment, and external registry restrictions block adding missing ESLint packages cleanly.

2. **Schema-to-feature hardening**
   - We established table presence, but still need constraints/indexes/RLS policies per newly added tables.

3. **Critical-flow automated tests**
   - Need smoke tests for attendance, grades, fees, import/export, and library checkout/return.

4. **Release observability**
   - Need deployment scorecards + runtime alerts on sync failures and API error spikes.

## What could be better

- Convert “compatibility tables” to a canonical naming model plus migration strategy.
- Standardize form validation and modal accessibility behavior across modules.
- Replace remote font links with deterministic local/`next/font` loading.

## Best path to market-ready + regression-resistant (phased)

## P0 (Immediate)

1. Lock schema contract + add indexes and RLS for newly added tables.
2. Keep DB contract CI gate as required for merges.
3. Restore stable dependency install path in CI runner with approved npm registry access.

## P1 (2–4 weeks)

1. Add smoke tests for top 6 workflows.
2. Add sync reliability instrumentation (queued/failed/retried/resolved).
3. Add build health dashboard (contract pass %, build pass %, workflow success %).

## P2 (4–8 weeks)

1. UX system unification (shared primitives + accessible modal contract).
2. Role-based “Top Tasks” IA simplification.
3. Canary rollout playbook and rollback drills.

## Acceptance criteria for market launch

- Zero DB contract drift in CI for 4 consecutive weeks.
- >=99% critical-flow smoke pass rate.
- No Sev-1 regression in 30 days of canary rollout.
- Accessibility baseline met on core journeys.

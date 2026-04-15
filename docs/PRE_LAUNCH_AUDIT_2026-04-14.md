# Pre-Launch Audit Report

Date: 2026-04-14
Project: Omuto School Management System / SkoolMate OS
Verdict: Not market-ready yet

## Executive Summary

The app builds and the current Jest suite passes, but the main launch risk is not compilation. The blocking issues are product integrity, data/security exposure, payment flow correctness, demo-mode leakage, and schema drift between docs and runtime code.

The strongest conclusion from this audit is that the app still contains production-visible demo behavior on routes that look complete, plus a few backend issues that can directly cause billing failures or cross-tenant data exposure.

## Verification Performed

- `npm test`: passed, 19/19 suites and 243/243 tests.
- `npm run lint`: passed with 24 warnings, mostly hook dependency issues.
- `npm run build`: passed outside the sandbox. The earlier Turbopack panic was caused by sandbox restrictions, not by the app itself.
- `npx tsc --noEmit`: failed on the student detail route type mismatch and read-only `process.env.NODE_ENV` mutations in `src/__tests__/api-utils.test.ts`.
- `npx next build --webpack`: failed on a real type-check error in `src/app/dashboard/students/[id]/page.tsx`, so the repo is not release-clean across build modes.
- Parallel agent audits were used for frontend/product integrity and backend/security/payment readiness.

## Release Recommendation

Do not market this app publicly until all Critical items and the first 6 High items below are closed.

## Critical Findings

1. Committed secrets are present in the repository.
   - `scripts/db-push.sh:6-7`
   - `scripts/apply-migration.sh:4-18`
   - `scripts/run-critical-fix.sh:31`
   - Impact: exposed Supabase service-role and access credentials are enough to compromise production data.
   - Action: rotate all exposed credentials immediately, remove them from git history if possible, and move all secrets to environment/secret storage.

2. The setup API seeds demo data into setup runs.
   - `src/app/api/setup/route.ts:356`
   - `src/lib/seed-demo.ts:5+`
   - Impact: real tenants can be polluted with fake demo school data, classes, students, and fees.
   - Action: remove demo seeding from production setup entirely, or hard-gate it behind an explicit dev/demo-only flag.

3. Student report API is overexposed.
   - `src/app/api/reports/route.ts:35-165`
   - Impact: any authenticated user in the same school can fetch a full student report payload without role or relationship checks.
   - Action: restrict to approved roles, or enforce teacher/parent ownership checks per student.

4. PayPal webhooks are effectively non-functional in production.
   - `src/lib/payments/paypal.ts:181-214`
   - `src/app/api/payment/paypal/webhook/route.ts:35-51`
   - Impact: valid production PayPal webhooks will be rejected.
   - Secondary issue: checkout writes `reference_id` while webhook handlers expect `payment.custom` and `subscription.custom_id`.
   - Action: implement real verification and standardize one metadata field across checkout, webhook, and subscription update logic.

5. Mobile-money billing is internally inconsistent.
   - `src/app/api/payment/mobile-money/route.ts:75-82`
   - `src/lib/payments/utils.ts:59-66`
   - `supabase/migrations/20260413_pricing_system.sql:127-135`
   - `src/app/api/payment/verify/route.ts:133-140`
   - Impact: payment records can fail inserts or become unreadable because write paths use `subscription_history` and providers `mtn`/`airtel`, while reads query `subscription_payments` and the migration enum only allows `momo|bank|cash|card|paypal`.
   - Action: unify the payment schema and provider enum, then update all payment routes together.

6. Setup wizard can report completion without successful persistence.
   - `src/app/dashboard/setup-wizard/page.tsx:133-209`
   - `src/app/dashboard/setup-wizard/page.tsx:514-530`
   - Impact: user can bypass save, or partial writes can fail silently while the wizard marks setup complete.
   - Action: remove the bypass, validate every write result, and block completion until all persistence succeeds.

## High Findings

1. Parent portal is split across two different products/routes.
   - `src/app/parent/login/page.tsx:51-68`
   - `src/app/parent/dashboard/page.tsx:110+`
   - `src/lib/navigation.ts:735-756`
   - Impact: real users can land in a demo-heavy dashboard while navigation points to a separate `/parent-portal` tree.
   - Action: consolidate to one parent product and remove hardcoded parent demo credentials from normal production UX.

2. Notices page is broken for real users.
   - `src/app/dashboard/notices/page.tsx:25-30`
   - `src/app/dashboard/notices/page.tsx:32-49`
   - Impact: non-demo users stay stuck in loading, and posted notices are only local UI state.
   - Action: fetch real data on mount, persist notices to backend, and add proper loading/error/empty states.

3. Suggestion box never loads existing suggestions.
   - `src/app/dashboard/suggestions/page.tsx:36-47`
   - Impact: historical suggestions are invisible unless a new one is submitted in the current session.
   - Action: call `fetchSuggestions()` on mount and after writes.

4. Several pages are still hardcoded mock UIs.
   - `src/app/dashboard/students/conduct/page.tsx:9-35`
   - `src/app/dashboard/student-transfers/page.tsx:18-72`
   - `src/app/dashboard/leave/page.tsx:27-50`
   - Impact: these pages present as complete features but do not persist or query live data.
   - Action: either wire them fully or remove them from launch navigation and sales demos.

5. Fee-term RLS is too permissive.
   - `supabase/migrations/20260414_fee_terms.sql:94-109`
   - Impact: `USING (true)` on select policies is not acceptable for multi-tenant school data.
   - Action: scope by `school_id` and authenticated user membership instead of global readability.

6. Setup and deployment docs are not aligned with runtime schema requirements.
   - `docs/SETUP.md:33-38`
   - Runtime references show dependence on `fee_terms`, `student_fee_terms`, `sms_triggers`, `automated_message_logs`, `student_grades`, `report_cards`, `term_archives`, and `fee_balances`.
   - Impact: a fresh deploy following the docs can produce a half-working system.
   - Action: make migrations the single source of truth and regenerate `schema.sql` from the actual deployed schema.

7. Public registration route is too open for production onboarding.
   - `src/app/api/register/route.ts:84-366`
   - Impact: no CAPTCHA, no email/phone verification, and service-role powered school creation make spam and abuse easy.
   - Action: add CAPTCHA, stronger rate limiting, moderation, or invite-based onboarding.

8. Installment reminder SMS route contains a real request bug.
   - `src/app/api/automation/auto-installment-reminder/route.ts:105-108`
   - Impact: header key is `apikye` instead of `apikey`, so authentication to the SMS provider will fail.
   - Action: fix the header and add a route-level test.

9. Login UX advertises demo accounts even when demo login is disabled.
   - `src/app/login/page.tsx:82+`
   - `src/app/api/demo-login/route.ts:43-49`
   - Impact: production users can see a non-working demo path.
   - Action: hide demo affordances unless explicitly enabled.

10. Strict webpack production build fails on a Next 16 route type mismatch.
   - `src/app/dashboard/students/[id]/page.tsx:405`
   - Impact: at least one production build path fails type-checking, which means release confidence is lower than the default build output suggests.
   - Action: update the dynamic page to the generated `PageProps` contract and keep webpack build in the release gate until the discrepancy is resolved.

11. CI type-check is also broken by test code mutating `NODE_ENV`.
   - `src/__tests__/api-utils.test.ts:79`
   - `src/__tests__/api-utils.test.ts:88`
   - `src/__tests__/api-utils.test.ts:95`
   - Impact: the configured `tsc --noEmit` gate fails on the current tree.
   - Action: rewrite the env helper to avoid direct assignment to read-only `process.env.NODE_ENV`.

## Medium Findings

1. Analytics and DNA pages overstate product depth.
   - `src/app/dashboard/analytics/page.tsx`
   - `src/app/dashboard/analytics/dna/page.tsx`
   - Issues include duplicate KPI labeling, inert search, and hardcoded/randomized visual data.

2. Finance navigation and fee tabs are inconsistent.
   - `src/lib/navigation.ts:396+`
   - `src/app/dashboard/fees/page.tsx:1217+`
   - Deep links advertise tabs that are not fully represented in the actual fee hub UI.

3. Parent login includes hardcoded demo credentials.
   - `src/app/parent/login/page.tsx:18-31`
   - This is acceptable for internal demoing only, not for a production-facing route.

4. Demo/mock branching remains widespread.
   - 46 source files still reference `DEMO_*`, `demo-school`, `mockRecords`, `ALLOW_SUPABASE_MOCK`, or related patterns.
   - Action: centralize demo mode and keep it out of normal production routes.

5. Lint warnings indicate stale state logic risk.
   - 24 warnings, especially missing hook dependencies on dashboard pages.
   - Action: fix these before adding more complexity; some can cause stale or misleading UI data.

6. Offline sync queue bookkeeping is inconsistent.
   - `src/lib/offline.ts:73-85`
   - `src/lib/offline.ts:146-153`
   - `src/lib/offline.ts:217-224`
   - `src/lib/offline.ts:497-505`
   - Impact: sync queue entries are written without a stable queue `id`, then later treated as numeric IDs during sync bookkeeping.
   - Action: give every queue item a stable string id or switch to auto-generated keys and keep the type consistent end-to-end.

7. Secure sync route is being bypassed by direct client sync.
   - `src/components/OfflineIndicator.tsx:22-42`
   - `src/lib/offline.ts:487-490`
   - `src/app/api/sync/route.ts:22-34`
   - Impact: the UI appears to call `/api/sync`, but the implementation ignores the URL and syncs directly through the browser Supabase client.
   - Action: choose one sync path, preferably server-mediated if school/role enforcement matters, and delete the redundant one.

8. POS offline support is incomplete.
   - `src/app/dashboard/store/pos/page.tsx:133-136`
   - `src/lib/offline.ts:51-75`
   - `src/app/api/sync/route.ts:22-34`
   - Impact: offline POS writes `canteen_sales`, but that table is missing from the IndexedDB store list and server sync allowlist.
   - Action: either support `canteen_sales` end-to-end or make POS explicitly online-only.

9. Native/offline readiness is overstated by Capacitor configuration.
   - `capacitor.config.ts:7-12`
   - Impact: native builds are configured to load the remote hosted app rather than bundled local assets.
   - Action: remove the production `server.url` override unless the intended model is cloud-only.

## Engineering and Ops Gaps

- Jest passes, but it force-exits due to open handles.
- Webpack production build fails on type-checking even though the default build path completes.
- Tests are mostly helper/unit level and do not cover enough route, payment, RLS, onboarding, or parent-portal behavior.
- There is no evidence of strong CI gates against demo leakage, committed secrets, or schema drift.
- Several automation endpoints use provider dry-run behavior when SMS config is missing. That is useful for dev, but risky if not surfaced clearly in production monitoring.
- CI is too weak for launch confidence.
  - `.github/workflows/ci.yml:27-31` runs `tsc` and `npm run build`, but not lint or tests.
  - `package.json:10` still uses `jest --forceExit`.

## Recommended Release Gates

1. Secret scan must pass with zero hardcoded credentials.
2. `npm run lint`, `npm test`, `npm run build`, and `npx next build --webpack` must all pass in CI.
3. Add Playwright smoke coverage for:
   - school registration
   - admin login
   - parent login
   - setup wizard completion
   - notices
   - suggestion box
   - payment checkout and verification
4. Add route tests for:
   - `/api/reports`
   - payment webhooks
   - mobile money verification
   - cron automation routes
5. Enforce one migration path for fresh deploys.
6. Remove or fully gate demo routes/features from public navigation.

## Streamlining and Automation Recommendations

- Add `gitleaks` or `trufflehog` to CI to block committed secrets.
- Add an allowlist-based CI check that fails on `DEMO_`, `mockRecords`, `Math.random()`, or hardcoded demo credentials in production routes.
- Add a schema drift check that compares runtime migrations against the documented setup flow.
- Add Sentry route-level instrumentation for payments, onboarding, and cron automations.
- Add a release checklist script that runs `lint`, `test`, `build`, secret scan, and a migration sanity check before deployment.
- Add a second production build job using webpack until the Next 16 build-mode discrepancy is resolved.
- Create a feature registry so unfinished modules can be hidden cleanly from navigation and sales pages until ready.

## Priority Order

1. Rotate leaked credentials and remove them from the repo.
2. Fix setup seeding, report authorization, and payment flow correctness.
3. Remove demo leakage from login, parent, notices, suggestions, and mock feature pages.
4. Fix schema/setup drift and tighten RLS.
5. Add smoke tests and CI gates before public launch.

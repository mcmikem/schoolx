# Production Operations Runbook

## Release order

1. Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run test:regression`.
2. Run `npm run check:schema-drift`, `npm run check:production-leakage`, and `npm run scan:secrets`.
3. Apply Supabase migrations to staging before deploying application code.
4. Run authenticated staging checks for login, RLS tenant isolation, storage, payments, cron, and offline sync.
5. Deploy an immutable application version and run `npm run smoke:prod`.

## Required production configuration

Supabase URL, anon key, service-role key, app URL, and `CRON_SECRET` are
required. Payment, SMS, email, mobile-money, AI, and WhatsApp variables are
optional integrations; each must be configured as a complete provider set
before its feature is enabled.

Never enable `ENABLE_DEV_TEST_ROUTES`, `NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES`, or
demo passwords in production.

## Database safety

Use the ordered files in `supabase/migrations/` as the migration source of
truth. Do not apply `schema.sql`, `complete-setup.sql`, or repair scripts to an
existing production database unless the change has been reviewed as a
migration. Take a backup before schema changes and verify a clean reset in CI.

## Sensitive data

Student photos are private objects. Use authenticated, school-scoped signed
URLs. Do not place student, health, payroll, or payment data in screenshots,
logs, support tickets, or public storage.

Offline browser storage is not a secure vault. Use managed devices, keep data
minimized, and clear browser storage when a device changes owner.

## Incident response

- **Authentication or tenant isolation:** disable the affected route, rotate
  service credentials, inspect audit logs, and run cross-school access tests.
- **Payment discrepancy:** stop activation callbacks, preserve provider payloads,
  reconcile the subscription ledger, and only then re-enable processing.
- **Provider outage:** pause retries that could duplicate side effects, record
  provider status, and resume from idempotent pending records.
- **Data loss:** restore into a separate project first, verify row counts and
  RLS policies, then document the recovery decision before production restore.

## Recovery requirements

Before broad production use, the operator must record backup frequency, restore
test date, target RTO/RPO, retention periods, alert owner, and dependency
contacts for Supabase, storage, SMS, email, payment providers, and Redis.

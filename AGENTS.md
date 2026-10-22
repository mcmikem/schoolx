# SkoolMate OS — Agent Guide

## Commands

```bash
# Dev (Next.js 16 + Turbopack)
npm run dev

# Build
npm run build                          # standard
MOBILE_BUILD=1 npm run build          # static export for Capacitor
DOCKER_BUILD=1 npm run build          # standalone output for Docker

# Quality gates (required order before commit)
npm run lint          # eslint src/
npm run typecheck     # tsc --noEmit
npm test              # jest --runInBand --forceExit
npm run test:regression
npm run test:e2e      # playwright test

# CI / build status checks (run locally after pushing)
npm run check:ci              # one-shot GitHub Actions + Vercel status
npm run check:ci -- --watch   # poll every 15s until done

# Post-deploy smoke (health, login page, SW build, sign-in, profile, DB write)
BASE_URL=https://skoolmate.omuto.org \
  SMOKE_PHONE=... SMOKE_PASSWORD=... SMOKE_CRON_SECRET=... \
  npm run smoke:prod
```

Pre-commit hook runs: `lint-staged → typecheck → test:regression`. All must pass.

**Post-push workflow:** Always run `npm run check:ci` after pushing to verify GitHub Actions and Vercel build status before notifying the user. This catches secret-scan failures, build errors, or Vercel deployment issues without manual browser checking. Once the deployment is live, run `npm run smoke:prod` with the `SMOKE_*` credentials to prove sign-in, profile and DB write still work. `.github/workflows/smoke.yml` does the same automatically after CI on `main` (add `SMOKE_PHONE`/`SMOKE_PASSWORD` repo secrets; without them it runs the public checks only).

Env vars for `check:ci` (optional):
- `GITHUB_TOKEN` — required for private repos
- `VERCEL_TOKEN` — required for Vercel deployment checks (`https://vercel.com/account/tokens`)

## Architecture

- **Next.js 16 + Turbopack** (app router, React 18, Tailwind)
- **Supabase** for auth, DB, storage
- **Capacitor** for mobile (Android/iOS)
- **Jest** unit tests (jsdom), **Playwright** E2E
- **Docker** multi-stage build with standalone output
- **PWA** with service worker, manifest.json, install prompts

## Critical: `src/proxy.ts` IS the middleware

Next.js 16 + Turbopack picks up `src/proxy.ts` as middleware despite not being named `middleware.ts`. Deleting or badly modifying it breaks ALL routing (every page returns 404).

The proxy handles: security headers (CSP, HSTS), Supabase auth session check, demo session cookies, CSRF tokens, public path whitelist, redirect unauthenticated users to `/login?redirect=<path>`.

**Do NOT create `src/middleware.ts`** — it conflicts with `src/proxy.ts`.

## Auth (post-rewrite)

- Profile fetch bypasses RLS via `/api/auth/me/` using `supabaseAdmin` (service role)
- `authInitialized` flag tracks whether initial auth check completed (not `loading`)
- `loading` only toggles during explicit login (`SIGNED_IN`); starts as `false`
- `signIn()` posts to `/api/auth/signin/` (the server resolves the phone→email map); it only falls back to racing direct Supabase identities when that POST is unreachable
- Demo mode requires `DEMO_ADMIN_PASSWORD` + `ENABLE_DEV_TEST_ROUTES` + `NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES` in `.env.local`
- Session timeout: 30 min with 5 min warning via `useSessionTimeout`

## Sign-in invariants (do not regress)

- **Never call `getSession()`, `getUser()` or `refreshSession()` inside the `onAuthStateChange` handler** (including `fetchUserData`, which it awaits). auth-js awaits that handler *while holding its storage lock*: the call waits for a lock that can only be released after the handler returns, then times out. Use the `session` the event carries; let `/api/auth/me/` decide whether the token is good; refresh only outside the callback (the 401 path).
- **Never pre-emptively refresh from the client clock** (`expires_at < Date.now()`). A device an hour ahead sees a freshly issued token as expired; this is what broke sign-in on one Windows PC while the server was returning 200. The server validates `exp`.
- `/api/auth/signin/` is the authority for the phone→email mapping. Do not re-order the client into guessing first.
- `/login`, `/register` and `/forgot-password` must keep the **long** service-worker navigation deadline; the short cached-copy deadline serves the previous deploy's JS.
- Only GoTrue's explicit credential words count as a wrong password. Timeouts, aborts and "could not start your session" are transient and must not count toward the lockout.
- Any change to a locked auth file must pass `npm run test:auth` (the pre-commit hook runs it automatically when a locked file is staged).

## Key conventions

- **"use client"** on all interactive components (no server components)
- **`@/`** path alias maps to `src/`
- **`src/lib/logger`** — isomorphic logger (use instead of `console.*`)
- **`trailingSlash: true`** in `next.config.js` — all fetch URLs to API routes need trailing slash (`/api/demo-login/` not `/api/demo-login`)
- **`useRef` / `useCallback`** must be destructured from React import (not `React.useRef`). HMR fails if dep array size changes between renders.

## Schema

- Source of truth: `supabase/schema.sql` (102 tables)
- Additional tables exist in migrations but not in `schema.sql` — be aware of drift
- Key tables: `schools`, `users`, `students`, `classes`, `fee_structure`, `events`, `academic_terms`
- Local DB: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Supabase CLI: `supabase status`, `supabase db push`
- **Apple Silicon + Rosetta trap**: if `uname -m` says `x86_64` but Docker's daemon is `aarch64`, the `supabase` CLI pulls amd64 images and every container dies with `exec /usr/bin/tini: exec format error`. Check `sysctl -n sysctl.proc_translated` (1 = under Rosetta) and `docker info --format '{{.Architecture}}'`. Fix with a native arm64 CLI build — `arch -arm64` on an x86_64 binary fails with "Bad CPU type".
- **Migration ordering**: a helper function must be defined in the FIRST migration that uses it. `update_updated_at()`, zero-arg `is_school_admin()`, `is_staff_role()` and `my_student_ids()` are each defined in their earliest consumer as well as later — removing those early copies breaks a fresh `supabase db reset`.
- **Seed data vs CHECK constraints**: `supabase/seed.sql` values must satisfy the FINAL constraints, not the ones in `000_schema.sql`. `schools.subscription_plan` allows `free_trial|starter|growth|enterprise|lifetime|basic|premium|max` (NOT `free`); `events.event_type` allows `exam|meeting|holiday|event|academic|substitution` (NOT `term`). Migrations that seed rows resolved via `SELECT id FROM <table> LIMIT 1` must no-op on an empty DB or the `NOT NULL` columns abort the reset.
- **Multiple roles per person**: rural staff routinely hold more than one role (headmaster who also teaches, bursar who is also a teacher, staff who are also parents). `users.role` stays the primary role; `user_roles` holds the full set and gates access via `canAccessAny` / `hasAnyRole`. Never "fix" a missing permission by widening a role — that grants it to everyone with that job.
- RLS on all tables. Helper functions `my_school_id()` and `is_school_admin()` use `SECURITY DEFINER`. Never put `SELECT ... FROM users WHERE auth_id = auth.uid()` inside a `users` table policy — use `my_school_id()` instead.

## CRUD / Data operations

- Insert/create Supabase calls MUST use `withTimeout()` from `src/lib/hooks/utils.ts` or they can hang forever (local Supabase is unreliable)
- `normalizeStudentInput()` in `src/lib/validation.ts` strips fields not in return object. Must include `gender` explicitly or inserts fail with NOT NULL violation.

## Onboarding / Setup

- `OnboardingFlow.tsx` — expanded to 10 steps (all required setup: terms, fees, grading, report cards, etc.)
- `PostOnboardingSetup.tsx` — 3 optional items only (SMS, Import, Signatures) with "Skip for now" buttons
- All client-side upserts use `supabase` (not `supabaseAdmin`) — RLS applies

## Docker

- `Dockerfile` — multi-stage, `DOCKER_BUILD=1` triggers `output: "standalone"`
- `docker-compose.yml` / `docker-compose.dev.yml` / `docker-compose.prod.yml`
- Healthcheck hits `/api/health/` (no auth required)
- Non-root user (`nextjs:nodejs`) in production

## Regression protection

- `src/__tests__/regression.test.ts` — 32 tests verifying critical fixes
- `.husky/pre-commit` — lint-staged → typecheck → regression tests
- CI runs secret scan (gitleaks) + build + tests + regression + build

## Common pitfalls

- **CSP blocks local Supabase**: `connect-src` only has `https://*.supabase.co` in production. Dev mode adds `http://127.0.0.1:*`. If CSP blocks auth requests, login hangs silently.
- **Demo mode env vars**: Both `ENABLE_DEV_TEST_ROUTES` (server) AND `NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES` (client) must be set. Server checks `requireDevelopmentRouteOrDeny()` and `proxy.ts`; client checks login page.
- **Calendar date off-by-one**: `new Date().toISOString()` converts local dates to UTC, shifting by timezone. Use local date formatters (`toLocalDate` in HeadmasterDashboard.tsx) for date strings.
- **Registration has no DB transaction**: `/api/register/route.ts` creates auth user → school → profile → seeds curriculum. Uses `supabaseAdmin` but manual rollbacks on failure.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

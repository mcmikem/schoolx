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
```

Pre-commit hook runs: `lint-staged → typecheck → test:regression`. All must pass.

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
- `signIn()` tries email variants (`@omuto.org`, `@omuto.sms`) then phone
- Demo mode requires `DEMO_ADMIN_PASSWORD` + `ENABLE_DEV_TEST_ROUTES` + `NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES` in `.env.local`
- Session timeout: 30 min with 5 min warning via `useSessionTimeout`

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

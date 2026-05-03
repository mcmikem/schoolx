# SkoolMate OS — Agent Guide

## Commands

```json
dev:          "next dev"
build:        "next build"
lint:         "eslint src/"
typecheck:    "tsc --noEmit"
test:         "jest --runInBand --forceExit"
test:e2e:     "playwright test"
mobile build: "MOBILE_BUILD=1 npm run build"
```

Required order before commit: `lint -> typecheck -> test`. All three must pass.

## Architecture

- **Next.js 16 + Turbopack** (app router, React 18, Tailwind)
- **Supabase** for auth, DB, storage
- **Capacitor** for mobile (Android/iOS) — `MOBILE_BUILD=1` sets `output: "export"`
- **Jest** unit tests, **Playwright** E2E

## Critical: `src/proxy.ts` IS the middleware

Next.js 16 + Turbopack picks up `src/proxy.ts` as middleware despite not being named `middleware.ts`. Deleting or badly modifying it breaks ALL routing (every page returns 404). This is project-specific behavior.

The proxy handles: security headers (CSP, HSTS), Supabase auth session check, demo session cookies, CSRF tokens, public path whitelist, redirect unauthenticated users to `/login?redirect=<path>`.

Do NOT create `src/middleware.ts` — it conflicts with `src/proxy.ts`.

## Key conventions

- **"use client"** on all interactive components (no server components)
- **`@/` path alias** maps to `src/`
- **`src/lib/logger`** — isomorphic logger (use instead of `console.*`)
- **`src/lib/api-utils`** — `requireDevelopmentRouteOrDeny()` checks `ENABLE_DEV_TEST_ROUTES` (server) while login page checks `NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES` (client). Both must be set in `.env.local` for demo mode.
- **`trailingSlash: true`** in `next.config.js` — all fetch URLs to API routes need trailing slash (`/api/demo-login/`)
- **WhatsApp support**: `256750028703` default, overridable via `NEXT_PUBLIC_SUPPORT_WHATSAPP`

## Auth

- Login: `signIn(phone, password)` in `src/lib/auth-context.tsx` — tries email variants (`@omuto.org`, `@omuto.sms`) then phone
- Demo mode: requires `DEMO_ADMIN_PASSWORD` + `ENABLE_DEV_TEST_ROUTES` + `NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES` in `.env.local`. Sets a cookie (base64 JSON) read by proxy.ts middleware.
- Registration: `/api/register/route.ts` — creates auth user → school → user profile → seeds curriculum. Uses `supabaseAdmin` (service role) but has NO database transaction. Manual rollbacks on failure.
- Session timeout: 30 min with 5 min warning via `useSessionTimeout` hook
- RLS on all tables. Helper functions `my_school_id()` and `is_school_admin()` use `SECURITY DEFINER` to avoid infinite recursion. Never put `SELECT ... FROM users WHERE auth_id = auth.uid()` inside a `users` table policy — use `my_school_id()` instead.

## Schema

- Source of truth: `supabase/schema.sql` (58 tables)
- ~25 more tables exist in migrations but NOT in `schema.sql` — be aware of drift
- Key tables: `schools`, `users`, `students`, `classes`, `fee_structure`, `events`, `academic_terms`
- Local DB: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Supabase CLI: `supabase status`, `supabase db push`

## Students

- `normalizeStudentInput()` in `src/lib/validation.ts` — strips fields not in the return object. Must include `gender` explicitly or inserts fail with NOT NULL violation.
- Insert/create Supabase calls MUST use `withTimeout()` from `src/lib/hooks/utils.ts` or they can hang forever (local Supabase is unreliable).
- `fetchStudents` already has timeouts; `createStudent` and `updateStudent` do not apply them automatically.

## Onboarding / Setup

- `OnboardingFlow.tsx` — 5 steps (Welcome, Essentials, Curriculum, Features, Launch)
- `PostOnboardingSetup.tsx` — checklist after onboarding (calendar, classes, fees, report cards, staff, SMS)
- Step 2 collects: school name, district/subcounty/parish, type, colors, logo (upload), motto, phone, email, UNEB center, ownership
- Setup auto-seeds: classes, subjects, terms, events, timetable slots, setup checklist
- All client-side upserts use `supabase` (not `supabaseAdmin`) — RLS applies. If they fail, they're caught and logged, onboarding still completes.

## Common pitfalls

- **CSP blocks local Supabase**: `connect-src` only has `https://*.supabase.co` in production. Dev mode adds `http://127.0.0.1:*`. If CSP blocks auth requests, login hangs silently.
- **`useRef` / `useCallback` dependency arrays**: Must be in the import (not just `React.useRef`). HMR can fail if dep array size changes between renders.
- **Demo mode env vars**: Both `ENABLE_DEV_TEST_ROUTES` (server) AND `NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES` (client) must be set. The server-side `requireDevelopmentRouteOrDeny()` and `proxy.ts` checks the non-public one; the login page checks the public one.
- **Trailing slash**: `trailingSlash: true` in next.config means `fetch("/api/demo-login/")` not `fetch("/api/demo-login")`.
- **Calendar date off-by-one**: `new Date().toISOString()` converts local dates to UTC, shifting by timezone. Use local date formatters (`toLocalDate` in HeadmasterDashboard.tsx) for date strings.

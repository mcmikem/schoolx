# Brutal App Critique (SchoolX)

Date: 2026-04-03

## Executive verdict

This app is ambitious, but right now it feels like a **feature dump with fragile security boundaries** rather than a hardened school system.

Main pattern: many pages exist, but core trust, authz, and ops guardrails are inconsistent.

---

## Critical bugs / security risks

### 1) `GET /api/payment/test-paypal` is a live test endpoint in production code
- The route creates real PayPal orders and exposes internals through logs/responses.
- It has no auth guard and no environment gate.
- During production build/static generation, it executes and attempts outbound network calls.
- Why this is bad: any public caller can trigger external payment side effects and noisy failures.

Evidence:
- Route implementation directly creates an order in `GET`. (`src/app/api/payment/test-paypal/route.ts`)
- Build output includes runtime invocation logs from this endpoint.

### 2) Report-generation API has weak tenancy validation
- `POST /api/reports` accepts `studentId` and `schoolId`, fetches by `studentId`, and separately fetches school by provided `schoolId`.
- No explicit check that `student.school_id === schoolId`.
- Why this is bad: cross-tenant data leakage becomes possible if caller can guess IDs.

Evidence:
- API path logic in `src/app/api/reports/route.ts`.

### 3) Several APIs use service role key without clear auth checks
- Routes initialize Supabase with `SUPABASE_SERVICE_ROLE_KEY` and then act on caller-provided IDs.
- `withSecurity` currently adds only optional rate limit/CSRF, but not identity/role authorization.
- Why this is bad: a service key bypasses RLS; without robust authorization middleware, tenant isolation depends on route discipline alone.

Evidence:
- `src/app/api/import/route.ts` uses service role.
- `src/lib/api-utils.ts` shows no auth enforcement in `withSecurity`.

### 4) Parent portal session trust is client-side and tamper-prone
- Parent session is stored in localStorage and reused to render student data context.
- Any localStorage tampering can switch display context; no signed session envelope at this layer.
- Why this is bad: browser-local trust can be abused on shared or compromised devices.

Evidence:
- `src/app/parent/page.tsx` localStorage reads/writes for `parent_session`.

---

## Reliability and engineering debt

### 5) Supabase client silently falls back to a mock client in production code
- If env config is missing/invalid, app uses a mock client that returns empty-ish successful responses.
- Why this is bad: failures are masked as “working but empty,” making incidents hard to detect.

Evidence:
- Fallback behavior in `src/lib/supabase.ts`.

### 6) Excessive debug logs in core auth/data plumbing
- Supabase URL/key prefixes and auth flow logs are printed broadly.
- Why this is bad: signal-to-noise collapse, possible leakage of sensitive operational context, and noisy production logs.

Evidence:
- Verbose logs in `src/lib/supabase.ts`, `src/lib/auth-context.tsx`, and payment routes.

### 7) Hardcoded academic defaults will age into wrong data
- Reports default to academic year `'2026'` and term `1` when inputs are absent.
- Why this is bad: data correctness silently drifts as calendar moves.

Evidence:
- Defaults in `src/app/api/reports/route.ts`.

### 8) Build process is triggering app side effects
- Build logs show payment test path executing and failing network calls.
- Why this is bad: CI builds should be deterministic and side-effect free.

Evidence:
- `npm run build` output on 2026-04-03.

---

## Product/UX critique (blunt)

1. **Too many dashboard pages, not enough coherence.** The route surface is huge, but quality/consistency likely varies massively.
2. **Security model feels bolt-on, not foundational.** You have wrappers for rate limits/CSRF, but no canonical authz boundary for tenant-sensitive routes.
3. **Operational hygiene is weak.** Debug-heavy logs and test endpoints in production paths are classic startup shortcuts that become incident magnets.
4. **“Works in demo” bias is visible.** Mock fallbacks and permissive patterns make demos smooth, but they hide real failures.

---

## Priority fix order (if you want this to survive real schools)

1. Remove or hard-disable `/api/payment/test-paypal` outside local development.
2. Add centralized auth + role + tenant checks for all write/read APIs using service-role clients.
3. Enforce student/school tenancy assertions in report and import flows.
4. Replace localStorage session trust with server-validated session retrieval for parent portal.
5. Remove mock Supabase fallback for production builds; fail fast with explicit startup errors.
6. Strip debug logs or gate them behind strict development flags.

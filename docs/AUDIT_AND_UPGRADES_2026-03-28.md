# SchoolX Audit & Upgrade Suggestions (2026-03-28)

## Scope

- Quick codebase health audit for build/test readiness and upgrade planning.
- Focused on static checks, build pipeline behavior, and dependency-maintenance readiness.

## Checks Run

1. `npm run build`
2. `npx tsc --noEmit`
3. `npm audit --json`
4. `npm outdated`
5. `npm run lint`

## Findings

### 1) Build blocker in CSS (fixed)

- The build previously failed due to a CSS parser error: an extra closing brace in `src/app/globals.css` near the mobile topbar rules.
- This has been corrected by keeping topbar responsive rules inside the `@media (max-width: 480px)` block and removing the stray brace.

**Impact:** Restores stylesheet parsing and unblocks downstream compile/lint/type phases in build.

### 2) Production build still fails during prerender

- `next build` now compiles, but export/prerender fails for many dashboard routes with:
  - `Error: useTheme must be used within a ThemeProvider`
- The provider chain is mounted in `src/app/providers.tsx`, but some route trees/components are still rendering `useTheme()` without guaranteed provider context at build-time/static render.

**Impact:** App cannot complete production export and is not release-ready.

### 3) TypeScript check is passing

- `npx tsc --noEmit` succeeded.

**Impact:** Type-level regressions are not currently blocking.

### 4) Linting is not yet automatable in CI

- `npm run lint` opens Next.js interactive ESLint setup prompt because an explicit ESLint config has not been committed.

**Impact:** Lint cannot run non-interactively in CI/CD; quality gates are missing.

### 5) Dependency audit/outdated checks blocked by registry policy

- `npm audit --json` and `npm outdated` both failed with npm registry `403 Forbidden` in this environment.

**Impact:** Security/advisory and version-drift visibility is currently unavailable from this environment.

## Recommended Upgrades (Prioritized)

## P0 (Immediate)

1. **Fix theme-context prerender safety**
   - Ensure every component calling `useTheme()` is a client component (`'use client'`) and always rendered under `ThemeProvider`.
   - For pages that should not be statically prerendered, set route strategy explicitly (e.g., dynamic rendering) rather than relying on default static export behavior.
   - Verify with `npm run build` until zero prerender errors.

2. **Add committed ESLint config**
   - Create and commit `.eslintrc.*` and update lint script to run fully non-interactive.
   - Add lint to CI pipeline.

## P1 (Near-term)

3. **Harden external font strategy**
   - Current build logs show Google Fonts download warnings.
   - Move to `next/font` (self-hosting optimization path) or local font assets to reduce build-time network dependency and improve reliability.

4. **Formalize dependency hygiene workflow**
   - Because `npm audit` is blocked here, run dependency checks in an environment with approved npm registry access.
   - Add a scheduled dependency report (weekly) and lockfile update cadence.

5. **Create build gate in CI**
   - CI should fail on `npm run build` and `npx tsc --noEmit` failures.
   - Add artifact retention for build logs to speed up diagnosis.

## P2 (Quality-of-life)

6. **Improve observability around provider assumptions**
   - Add lightweight runtime guard logging around provider boundaries in dev.
   - Add route-level smoke tests for key dashboard pages to catch missing providers early.

## Suggested Execution Plan

1. Theme-context/prerender fix (P0)
2. ESLint configuration + CI lint gate (P0)
3. Build gate enforcement in CI (P1)
4. Font loading upgrade (P1)
5. Dependency governance automation (P1)

## Success Criteria

- `npm run build` completes with no prerender exceptions.
- `npm run lint` runs non-interactively and passes in CI.
- `npx tsc --noEmit` remains green.
- Dependency/security report is available on a fixed schedule.

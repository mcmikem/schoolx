# Omuto / SkoolMate Upgrade Map

Use this file only when the current repo is the Omuto School Management System.

## Current Shape

- Stack: Next.js App Router, React, TypeScript, Supabase, Tailwind, Capacitor.
- Strengths: strong UX ambition, mobile awareness, Uganda-specific workflows, broad product surface.
- Risk pattern: breadth exceeds backend depth.

## High-Signal Evidence

- Route-heavy app: more than one hundred `page.tsx` routes.
- Moderate API surface: a few dozen `route.ts` files.
- Strong unit coverage exists, but the heaviest risks are integration and trust-boundary issues.
- Several major screens are very large, especially student, fees, messages, settings, grades, staff, and super-admin pages.
- Demo data and mock-path behavior are substantial parts of the codebase.

## Known Priority Risks

1. Authorization and tenancy checks are not centralized enough.
2. Production behavior can be obscured by mock Supabase fallback.
3. Parent portal trust depends too heavily on client-managed session state.
4. Large page components hold too much business logic.
5. Route-specific not-found and invalid-resource handling are incomplete.
6. Feature breadth likely overstates module maturity in some areas.

## Recommended Upgrade Order

### Phase 1: Trust Boundary

- Centralize authn, authz, and tenant validation for all sensitive routes.
- Remove or strictly isolate demo and mock fallbacks from production paths.
- Review service-role usage and require explicit justification per route.

### Phase 2: Data and Workflow Integrity

- Audit core flows: student lifecycle, fees, grades, attendance, parent visibility, reports.
- Move critical workflow decisions out of page components into reusable server-side logic.
- Add integration tests for cross-tenant access, invalid IDs, and state transitions.

### Phase 3: Structural Refactor

- Split the largest page files into feature modules, hooks, and service layers.
- Reduce client-only data orchestration where server boundaries are cleaner.
- Normalize error, loading, empty, and not-found states.

### Phase 4: Product Polish

- Tighten dashboard IA and remove weak or overlapping routes.
- Unify parent, dashboard, and public-shell UX patterns.
- Improve accessibility, mobile consistency, and resilient offline messaging.

### Phase 5: Release Discipline

- Make `build`, `lint`, tests, and smoke checks mandatory release gates.
- Add stronger e2e coverage for login, dashboard, parent portal, and fees.
- Track operational readiness: logs, monitoring, feature flags, and rollback expectations.

## Comparison Lens Against OpenEduCat

- OpenEduCat wins on ERP depth, model-driven workflows, configurability, and institutional maturity.
- SkoolMate wins on UX, speed of use, localization for Ugandan schools, and product-market sharpness.
- The upgrade goal is not to copy OpenEduCat’s stack. It is to match its operational seriousness while preserving SkoolMate’s product advantages.

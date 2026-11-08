# 50 Top Upgrades for SkoolMate OS — EGM Style Review

## Offline & Connectivity (10 upgrades)

1. Add `useOfflineDashboard` hook — unified offline state for all dashboard sections
2. IndexedDB queue persistence — store pending actions in IndexedDB with automatic retries
3. Cache API for static student data — 5-minute Cache API storage, reducing Supabase reads
4. Service worker caching for reports — cache `/dashboard/report-cards/` for 30 minutes
5. Connection status indicator — `useOnlineStatus` hook disabling non-critical UI offline
6. Background sync for fee payments — automatic send when network restores
7. Pre-fetch on route enter — `prefetchQuery` pattern for next page data caching
8. Lazy load offline modules — dynamic `import()` for currently visible section only
9. WebSocket keepalive for real-time — ping Supabase subscriptions, exponential backoff reconnect
10. Sync conflict resolution — `ConflictResolutionDialog` with Keep mine/Server wins/Merge options

## Performance & Speed (10 upgrades)

11. reduce-reducer pattern for form state — single re-render batch instead of N re-renders
12. Virtual scrolling for large lists — react-virtual, DOM-render visible rows + 2 buffer
13. Memoized `canAccess` calls — `useMemo(() => canAccessAny(userRole, [])), [userRole]`
14. Next/image optimization for avatars — `<Image>` with width/height/fill for WebP/AVIF
15. Deferred heavy component renders — `ssr: false` and `loading` skeleton for TeacherDashboard
16. Computed table summaries — `useDerivedSummary` with running totals O(1) vs O(n)
17. API response compression middleware — `compression` in `src/proxy.ts` for gzip/br
18. Selective re-validation — `refetchOnWindowFocus: true` only, `refetchOnMount: false`
19. Image preload for avatar hover states — `<link rel="preload"> as="image"`
20. Next.js bundle analyze in CI — `ANALYZE=true npm run build`, fail if >5% growth

## Reliability & Stability (10 upgrades)

21. Error boundary wrapping for all dashboards — wrap Students/Grades/Attendance/Fees/Reports
22. Supabase connection timeout — `options: { global: { timeout: 5000 } }` preventing hanging requests
23. Axios/fetch abort controller cleanup — `AbortController` in useEffect cleanup
24. RLS policy audit script — CI script verifying all 102 tables have RLS enabled
25. Database connection pool monitor — `/api/health/db` with `pg_stat_activity` query
26. Form validation abort on cancel — `AbortController` on form cancellation
27. Missing field alerts — warning log when gender/date_of_birth missing from normalizeStudentInput
28. Unhandled promise rejection listener — `window.addEventListener('unhandledrejection'`
29. Circuit breaker for Supabase — short-circuit after 5 failures in 30s
30. Test coverage for edge cases — offline+sync, concurrent submissions, token expiration

## Efficiency & Effectiveness (10 upgrades)

31. Single source of truth for role permissions — derive `roleBasedRoutes` from `ROLE_PERMISSIONS`
32. Remove duplicate `canAccess` calls — `useRolePermissions` hook returning all enabled permissions
33. Billing entitlement feature flags — `useFeatureFlags` mapping `subscription_plan` to booleans
34. Consolidate navigation entries — merge "Take Attendance" + "Period Attendance" into one
35. Unify gender handling — `ensureGender` utility mapping Male/Female/Other to M/F/O
36. Single API pattern for create-or-update — `upsert` pattern with `onConflict` in Supabase
37. Default values from schema, not hardcoded — `useSchemaDefaults` reading Supabase defaults
38. Consolidate duplicate API routes — `/api/subscription-payments/` and `/api/fee-invoices/`
39. Teacher self-reporting shortcut — `/dashboard/quick-actions` / `api/quick-action`
40. Server-side search for teacher lists — `/api/search/` RPC with `ilike` and `limit`

## Build & Dev Experience (10 upgrades)

41. Next.js standalone output profiling — analyze `standalone/` size, ensure <200MB for Capacitor
42. Type-safe env validator — `src/lib/env.ts` with zod/jose, clear message on missing vars
43. Husky pre-commit improved — parallel typecheck & lint, add `test:auth`
44. Component docgen in CI — generate `docs/components.md` from `/* @component */` JSDoc
45. Storybook for dashboard modules — `TeacherDashboard`, `StudentTable`, `GradeInlineEdit`
46. ESLint plugin for Next.js 16 — `next/core-web-vitals` + `no-restricted-globals`
47. Docker healthcheck endpoint — check Supabase connectivity + JWT validity + CSP nonce
48. Commit lint messages — Conventional Commits format in pre-commit
49. Snapshot tests for permission gates — serialize `roleBasedRoutes` and `ROLE_PERMISSIONS`
50. EGM-style upgrade tracking — this `UPGRADES.md` file with checkboxes, track progress
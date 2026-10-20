# Key page dependencies

## `/dashboard/sync-center` — offline queue and sync status
Entry: `src/app/dashboard/sync-center/page.tsx`
- `src/app/dashboard/layout.tsx`
  - `src/components/dashboard/SidebarShell.tsx`
  - `src/components/dashboard/TopBar.tsx`
  - `src/components/dashboard/MobileBottomNav.tsx`
  - `src/components/OfflineIndicator.tsx`
  - `src/components/ui/Breadcrumbs.tsx`
- `src/app/dashboard/sync-center/page.tsx`
  - `src/components/PageErrorBoundary.tsx`
  - `src/lib/auth-context.tsx`
  - `src/lib/offline.ts`
  - `src/components/MaterialIcon.tsx`
  - `src/components/ui/PageHeader.tsx`
  - `src/components/ui/Card.tsx`
  - `src/components/ui/index.tsx`
  - `src/lib/logger.ts`

## `/dashboard` — role dashboard
Entry: `src/app/dashboard/page.tsx`
- `src/app/dashboard/layout.tsx`
- `src/app/dashboard/DashboardRouter.tsx`
- Role dashboards in `src/app/dashboard/dashboards/`

## `/dashboard/attendance` — primary offline workflow
Entry: `src/app/dashboard/attendance/page.tsx`
- `src/app/dashboard/layout.tsx`
- `src/lib/offline-hooks.ts`
- `src/lib/hooks/attendance.ts`
- `src/lib/offline.ts`
- Shared UI: `PageHeader`, `Card`, `Modal`, `Button`, `MaterialIcon`

## `/dashboard/grades` — primary offline workflow
Entry: `src/app/dashboard/grades/page.tsx`
- `src/app/dashboard/layout.tsx`
- `src/lib/offline-hooks.ts`
- `src/lib/hooks/grades.ts`
- `src/lib/offline.ts`
- Shared UI: `PageHeader`, `Card`, `Modal`, `Button`, `MaterialIcon`

## `/dashboard/fees` — payment and cached ledger workflow
Entry: `src/app/dashboard/fees/page.tsx`
- `src/app/dashboard/layout.tsx`
- `src/lib/offline-hooks.ts`
- `src/lib/hooks/fees.ts`
- `src/lib/offline.ts`
- Shared UI: `PageHeader`, `Card`, `Modal`, `Button`, `MaterialIcon`

Route inventory is in `routes.md`. The trees identify key dependencies; inspect page render branches before generating a reproduction.

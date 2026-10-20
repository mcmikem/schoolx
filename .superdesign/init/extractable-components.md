# Reusable design components

## Layout components

### DashboardShell
- Source: `src/app/dashboard/layout.tsx`
- Category: layout
- Description: Authenticated shell with top bar, responsive navigation, breadcrumbs and offline state.
- Extractable props: active route, user role, school identity.
- Hardcoded: navigation structure, icon names and responsive classes.

### Sidebar
- Source: `src/components/dashboard/SidebarShell.tsx`
- Category: layout
- Description: Role-filtered desktop rail and mobile drawer.
- Extractable props: active route, groups, expanded state.
- Hardcoded: brand treatment, icons, labels and styles.

### TopBar
- Source: `src/components/dashboard/TopBar.tsx`
- Category: layout
- Description: Dashboard header with search, notifications and account actions.
- Extractable props: route, role, notification state.
- Hardcoded: icon names, action labels and styling.

### MobileBottomNav
- Source: `src/components/dashboard/MobileBottomNav.tsx`
- Category: layout
- Description: Touch-first bottom navigation for dashboard destinations.
- Extractable props: active route, available roles.
- Hardcoded: navigation labels, icons and touch sizing.

### OfflineIndicator
- Source: `src/components/OfflineIndicator.tsx`
- Category: basic
- Description: Connection state and queued-change status with Sync Center link.
- Extractable props: online state, pending count, syncing state.
- Hardcoded: status copy, icon names and status colors.

## Shared UI

### PageHeader
- Source: `src/components/ui/PageHeader.tsx`
- Category: basic
- Description: Page title, supporting text and actions.
- Extractable props: title, description, actions.

### Card
- Source: `src/components/ui/Card.tsx`
- Category: basic
- Description: Surface container with optional header and body.
- Extractable props: title, description, children.

### Button and Input
- Source: `src/components/ui/index.tsx`
- Category: basic
- Description: Theme-aware touch-size button and labeled form field.
- Extractable props: variant, size, label, loading/error state.

### Breadcrumbs
- Source: `src/components/ui/Breadcrumbs.tsx`
- Category: basic
- Description: Dashboard hierarchy and back navigation.
- Extractable props: breadcrumb items.


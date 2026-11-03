# Adding a new feature page

Follow this checklist so a new feature lands consistently with the rest of the app.

## 1. Route + page

- Create `src/app/dashboard/<feature>/page.tsx`.
- Wrap the default export in `PageErrorBoundary` (see `src/app/dashboard/students/page.tsx`).
- Use `PageHeader` for the title/subtitle and `EmptyState` / `LoadingState` / `ErrorState` for non-happy states — do not hand-roll overlays.

## 2. Permissions

- Add the permission key to `RolePermissions` in `src/lib/roles.ts`.
- Set `true`/`false` for every role in `ROLE_PERMISSIONS` (the `Record<UserRole, RolePermissions>` will not compile otherwise).
- Add a label in `PERMISSION_LABELS` if the key is user-facing.
- Gate the page with `canAccess(user.role, "<key>")` (or `canAccessAny` for multi-role staff).

## 3. Navigation

- Add an entry to the role nav tree in `src/lib/navigation.ts`.
- Set `roles` so only entitled roles see it.
- Add an icon (Material Symbol name) and a short label.

## 4. Data layer

- Add a hook in `src/lib/hooks/<domain>.ts` (or a sub-folder for large domains).
- Re-export from `src/lib/hooks/index.ts`.
- Use `withTimeout()` for every Supabase read/write.
- Cache reads with `dedupeRead` / `queryCache` where appropriate; document cache keys.

## 5. Styling

- Use design tokens (`--surface`, `--t1..--t4`, `--primary`, `--green`, `--amber`, `--red`) — never raw hex or Tailwind palette tints.
- Use the shared `<Button>`, `<Modal>`, `<Card>` primitives; compose classes with `cn()`.
- Touch targets must be at least 44px (`min-h-11`).

## 6. Tests

- Add a unit test in `src/__tests__/` for pure logic.
- Add a regression test in `src/__tests__/regression.test.ts` if the change fixes a previously-broken invariant.

## 7. Verify

- `npm run lint && npm run typecheck && npm test` must all pass.
- Run `npm run test:auth` if any auth/role file changed.
- Run `npm run test:regression` before committing.
# SkoolMate visual and workflow upgrade — 2026-10-14

## Previous handoff

The working tree began at f82ce0ff, after fee revival, grading-track, report-layout and new finance-page commits. Six files were already staged. Those staged changes were retained; this pass adds unstaged repairs on top.

The October 13 shell audit covered layouts for seven staff roles. Drawer targets, pin sizing, accordion affordances and interaction checks remained open. Later commits had implemented dashboard headings but left incompatible prop declarations. The wider route inventory remains a backlog.

## Confirmed findings

| Severity | Surface | Evidence and repair |
| --- | --- | --- |
| P0 | Fee Structure, Payment Ledger, Grading Configuration | Initial type checking found missing hooks/state and incompatible Select props. Ledger queried a nonexistent direct class relationship. Add Fee did not open a create form. Rebuilt destinations using existing hooks and shared components, with working forms, search/filter, details, pagination and retry states. |
| P0 | Grades | Two identical settings effects and secondary-only track selection on primary classes. Replaced with one cached settings load and class-based track resolution; keep individual assessment headers distinct. |
| P1 | Report cards | Settings Promise cast to a layout string. Await settings before applying format; guard against old school responses. Demo settings apply within the session. |
| P0 | Fee metadata | Missing page-state fields, normalization dropped applicability/frequency/zone, annual fees failed term validation. Preserve supported metadata; annual/one-off terms are null. Edits preserve stored year, term and due date. Both student types maps to database NULL. |
| P1 | Balances/invoices | Global fees could be omitted or counted twice; boarding charges did not distinguish day students. Normalize the global-class key and use shared class/student-type eligibility. |
| P1 | Add Payment | Dropdown-only student selection, no received-date control, unassociated detail labels, save actions outside the visible form, assistant over fields. Search by name/number/class with keyboard selection, explicit received date, sticky actions, associated labels and hidden assistant during modal tasks. |
| P1 | Payment writes | Dates replaced by today; unknown write results could proceed; duplicate guard ignored received date/reference. Preserve dates, reject timeout/null results, distinguish backdated receipts. Receipt shows this payment and its received date; print content is connected to the existing handler. |
| P0 | Notifications | User supplied a timeout with a 10,388-character URL from a school-wide student-ID filter. Fee alerts used a similar list and naive arithmetic. Use a school-joined attendance count and existing fee aggregate RPC, local date, role-filtered financial access and no live demo queries. |
| P0 | Fees during this pass | User reported 42703 after description was selected from a deployed table lacking that column. Removed the dependency and unsaveable description field. No remote schema change is required for this repair. |
| P1 | New route access | New destinations lacked access/module mappings. Added finance permission for fee structure/ledger, settings permission for grading configuration, catalog entries and role-filtered navigation. |
| P1 | Sidebar | Search matches stayed hidden in closed groups; recents persisted across roles. Expand matches while searching and restrict recents to current authorized destinations. |
| P2 | Shared shell | Clipped greetings, short drawer targets and shrinking pin target. Wrap greetings; use 44px drawer/group/recents targets and a nonshrinking pin. Add explicit collapsed-state hints to bursar panels. |
| P0 | Database migration | Boarding migration used a TypeScript union as a SQL type. Corrected to TEXT/CHECK while preserving the original default. Not applied to any database in this pass. |
| P0 | Production build | Four App Router entrypoints exported arbitrary runtime helpers/constants. Extracted grading workflow, report access and homework helpers to library modules; removed an unused template alias. Behavior remains covered by the existing tests. |

## Visual evidence

Browser-plugin execution failed due to missing tool sandbox metadata. The repository's Playwright workflow provided browser testing and screenshots instead.

The new tests/e2e/upgrade-visual-audit.spec.ts checks five finance screens at 320, 390 and 1280 pixels, headings, overflow and absence of app error screens. It exercises annual fee creation/editing, grading setting persistence, payment details, student search and a historical payment. Desktop checks wait for the rail transition before measuring overlap.

Local captures are under test-results/upgrade-audit/, including record-payment-390.png, student-payment-search-390.png, grading-settings-390.png and finance route/viewport images. Representative screenshots were visually reviewed. Geometry alone is not considered a visual sign-off.

## Validation

Final lint and TypeScript checks passed. The complete unit suite passed 1,455 tests in 118 suites; the regression suite passed 163 tests. All five new browser workflows passed. The existing teacher layout sweep also passed: 15 routes at 390px and 1280px, with no document overflow or app error screens.

The combined browser run completed with six passing tests and one existing failure. The teacher deep-link test expects /dashboard/settings/ to redirect to no-access, but the current role-tab policy intentionally gives teachers general and notifications tabs. The unit route-guard tests cover this settings-lite access. The stale E2E expectation is left unchanged rather than narrowing legitimate teacher access or silently reporting a fully green combined suite.

After moving the invalid exports, npm run build -- --webpack passed compilation, TypeScript, static generation of 256 pages and build-trace collection.

Turbopack production compilation hit an environment worker-port restriction even after escalation. The supported Webpack production build passes as a separate compilation check; the standard Turbopack build path is not claimed verified.

## Remaining coverage

Demo browser tests do not prove production RLS, actual payment-provider integration or every school's deployed schema. No production payments, remote migrations, commits or pushes were performed. Specialist routes, super-admin, parent/student portals, exhaustive offline/error states and financial totals beyond paginated client data need dedicated audit coverage. Keep the broader audit checklist open.

Localhost is run separately from the browser tests so their cleanup does not shut down the user's preview.

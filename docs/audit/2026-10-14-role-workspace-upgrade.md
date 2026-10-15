# Role workspace UI/UX upgrade — first rollout

## Scope

- Bursar, teacher, and headmaster dashboard daily workflows use one shared action panel with named navigation, keyboard focus, readable labels, and large touch targets. Existing destinations and teacher subscription filtering are preserved.
- Bursar actions move ahead of analytics; fee metrics use a two-column phone layout.
- Teacher class cards are visible in a responsive grid rather than a horizontal strip. Teachers with more than four classes can search class names; empty search results have a clear message.
- School identity headings wrap; repeated dates are removed from the shared hero.
- Shared page headers improve title/action hierarchy, wrapping, and touch targets across students, attendance, fees, grades, report cards, timetable, messages, and other consumers.
- Attendance gets consistent page padding, section spacing, and bottom clearance; grade actions wrap on narrow screens.
- Shared metric cards wrap long values and descriptions instead of clipping them.

## Verification

- Role dashboard and shared UI unit tests cover navigation, heading ownership, page actions, and metric context.
- `tests/e2e/role-workspace-upgrade.spec.ts` covers all three dashboards at 320, 390, and 1280 pixels, teacher search/empty results, and common role pages at 390 and 1280 pixels. It checks heading counts, horizontal overflow, runtime exceptions, and action target height, and saves screenshots.
- Screenshots are saved under `test-results/role-workspace-upgrade/` for visual review.
- Tests reuse the existing localhost server; they do not own or stop it.

## Remaining scope

This is a shared visual foundation and the first three-role rollout, not a claim that every module has been redesigned or every live-data workflow audited. Detail pages, full table/filter redesigns, and other role-specific dashboards remain separate follow-up work. Demo-session screenshots do not verify production database writes or live school totals.

## Shared-page continuation — 15 October

- Added a reusable labeled search field with a touch-sized clear action that returns focus to search. Student registry, grade filters, report cards, and shared filter bars use the same pattern.
- Student advanced filters fit narrow screens, focus the first control when opened, close with Escape, and return focus to their trigger. Registry paging wraps on phones.
- Grade workflow filters expose their selected state, support one-click reset, search names and student numbers, and reset paging on search changes.
- Report-card search now filters already-generated results instead of altering the roster used for generation. Name/number search, empty results, reset controls, visible-result counts, and filtered-print wording stay available after no matches. Changing class clears the search.
- Report cards use a two-column metric/card treatment on phones, with editable labeled comments and print/SMS actions retained. Desktop keeps its table.
- Timetable class selection has a visible associated label. Shared pagination has 44px controls and correct ranges for the All rows option.
- Grade save/submit controls fit the phone viewport; the assistant launcher sits above the action bar instead of covering submission.
- Interaction coverage: `tests/e2e/common-page-workflows.spec.ts`; screenshots: `test-results/common-page-workflows/`.
- Existing demo reports can show averages over 100%; their grading calculation/data is outside this visual/search pass and has not been changed or certified.

# Batch 1 Audit Log — Shell, Navigation, Role Dashboards

**Date:** 2026-10-13
**Batch:** 1 (shared shell, role-based navigation, bottom navigation, 8 role dashboards, route permissions)
**Auditor:** agent session
**Status:** Route/layout pass complete for 7 of 8 roles. Interaction, keyboard and empty/offline/error states remain unaudited.

---

## Method actually used

Playwright + the repo's existing demo seeding helper. New spec:
`tests/e2e/batch1-shell-audit.spec.ts` (the helper was extended to cover the
7 roles `src/proxy.ts` permits; `super_admin` is cross-tenant and cannot be
seeded against a single demo school, so it is **not** covered).

- Roles: headmaster, dean_of_studies, bursar, teacher, secretary, dorm_master, marketer
- Widths: 320, 390, 768, 1280
- Captured: horizontal overflow, `<main>` presence, heading outline, nav labels per
  role, nav tap-target geometry, 400-char content sample
- Screenshots: `test-results/batch1-audit/*.png` (28 files)
- Measurements: `test-results/batch1-audit/measurements.json`

Screenshots were inspected visually, not only measured.

---

## Verified findings

### B1-01 · `TRENDING_FLAT` renders as literal text — P0 — **FIXED**

**Route:** any screen using `StatCard` with a flat or downward trend. Confirmed
visible on `/dashboard` for **bursar** (Collected card) at 320/390/768/1280.
**Roles:** all that reach a StatCard with `trend.direction` `down`/`flat`.
**Severity:** P0 — it is the most-used dashboard in the app and it renders raw
ligature source into the UI.

**Status:** fixed in `afd9f156`'s follow-up (see "Fix" below). Verified by
re-capturing the bursar dashboard at 390px: the card now reads
`→ 0% vs last month` with a real glyph and the literal text is gone.

**Evidence**

Screenshot `bursar-w390.png`: the green "Collected UGX 6.1M" card displays
`TRENDING_FLAT` as large literal text, overlapping the card, with a clipped
`0% v...` at the right edge.

Code path — `src/components/dashboard/StatCard.tsx:37`:

```ts
const trendIcon =
  trend?.direction === "up" ? "trending_up" : trend?.direction === "down" ? "trending_down" : "trending_flat";
```

The icon name is built in a **local variable assignment**, never as
`icon="..."`, `icon: "..."`, `icon={...}`, or `<MaterialIcon>` children.

Root cause confirmed by running the repo's own subsetter:

```
collector found: 333 icons
  trending_up    -> FOUND
  trending_down  -> MISSING
  trending_flat  -> MISSING

shipped font public/fonts/material-symbols-outlined.woff2:
  trending_up    -> YES
  trending_down  -> NO
  trending_flat  -> NO   (308 ligatures in subset)
```

`scripts/build/material-symbols-subset.py:collect_icon_names()` recognises six
reference shapes; `const trendIcon = cond ? "a" : "b"` is none of them. The
ligature was never collected, never subset into the font, so the browser cannot
resolve it and renders the ligature source.

**Fix applied:** the collector now also gathers quoted literals from ternary
assignments, admitting only those that resolve to a real ligature in the source
font (blind collection matched 214 candidates, 187 of them ordinary strings).
Subset regenerated: 308 → 323 ligatures. Guard in
`src/__tests__/icon-font-subset.test.ts`.

**Note on detection:** a DOM-based detector cannot find this. Material Symbols
substitutes at the font level, so `textContent` is the ligature name whether or
not it renders — every `<MaterialIcon>` matches. The defect is only visible in
a screenshot or by inspecting the font's GSUB ligature records.

**Verification:** `icon-font-subset.test.ts` asserts the runtime-constructed
icons resolve in the shipped font; plus the bursar dashboard screenshot.

---

### B1-02 · Role-aware quick action is identical for 6 of 7 roles — P1 — **FIXED**

**Route:** `/dashboard`, mobile bottom nav
**Severity:** P1 — the feature exists and is named as role-aware, but does not
actually vary.

**Status:** fixed. `ROLE_QUICK_ACTION` in `MobileBottomNav.tsx` declares the
action per role; the capability priority chain is gone. Verified in Chromium at
390px — see the table under B1-03. Guard:
`src/__tests__/mobile-bottom-nav-quick-action.test.tsx` (verified to fail 9 of
11 against the old behaviour).

**Evidence**

`src/components/dashboard/MobileBottomNav.tsx:52-61` picks the quick action by
priority `students > attendance > fees > fallback`. From `src/lib/roles.ts`:

| role | students | attendance | fees | quick action rendered |
|---|---|---|---|---|
| teacher | true | true | false | **Add Student** |
| dean_of_studies | true | true | false | **Add Student** |
| bursar | true | false | true | **Add Student** |
| headmaster | true | true | true | Add Student |
| secretary | true | false | false | **Add Student** |
| dorm_master | true | true | false | **Add Student** |
| marketer | false | false | false | Open Dashboard |

Because `students: true` for every staff role except marketer, `students` always
wins. Confirmed in screenshots: `teacher-w390.png` and `bursar-w390.png` both
show a bottom nav whose centre action is labelled **STUDENTS**.

A bursar's primary phone action is "Add Student"; a teacher's is "Add Student".
For the bursar the obvious primary action is Collect Fees; for the teacher,
attendance or marks.

**Proposed change:** derive the quick action per role from what that role
actually does, not from a global capability priority — e.g. teacher →
attendance/marks, bursar → collect fees, dorm master → roll call, secretary →
notices/SMS. Also demote "Add Student" to admin roles where it belongs.

**Verification:** assert the rendered bottom-nav centre label per role in an
e2e table; assert it is not "Add Student" for teacher/bursar/dorm_master/secretary.

---

### B1-03 · Quick-action label promises an action but navigates to a list — P1 — **FIXED**

**Route:** `/dashboard`, mobile bottom nav
**Severity:** P1

**Status:** fixed with B1-02. Every label now names its destination, and the
contextual swaps — which changed the button's meaning depending on route —
were removed so the action is constant per role.

Rendered centre action at 390px, from `b1-02-verify` (Chromium):

| role | centre label | href | other bar items |
|---|---|---|---|
| headmaster | Students | /dashboard/students/ | Home, Attend, Fees, More |
| dean_of_studies | Academic Reports | /dashboard/reports/ | Home, Attend, More |
| bursar | Invoices | /dashboard/invoicing/ | Home, Fees, More |
| teacher | Enter Marks | /dashboard/grades/ | Home, Attend, More |
| secretary | Messages | /dashboard/messages/ | Home, More |
| dorm_master | Dorm Attendance | /dashboard/dorm-attendance/ | Home, Attend, More |
| marketer | Open Dashboard | /dashboard/ | Home, More |

No centre action duplicates Home, Attend or Fees, and no role is offered
"Add Student".

**Evidence**

`MobileBottomNav.tsx:53` returns
`{ label: "Add Student", navLabel: "Students", href: "/dashboard/students" }`.
`/dashboard/students` is the roster list, not an add form. The `aria-label`
and `title` both say "Add Student"; tapping it lands on a list.

**Proposed change:** either point the action at the actual add affordance, or
rename to the destination ("Students").

**Verification:** e2e click-through asserting the resulting route matches the label's promise.

---

### B1-04 · Teacher dashboard has no `<h1>` — P1

**Route:** `/dashboard` for teacher
**Severity:** P1 — heading hierarchy is a documented audit axis and screen-reader
navigation depends on it.

**Evidence** from `measurements.json`:

```
headmaster  @ w390  ["H1:Good Morning, John", "H2:Common actions", ...]
bursar     @ w390  ["H1:Fees overview", ...]
dorm_master@ w390  ["H1:Good Morning, Deborah"]
teacher    @ w390  ["H2:Quick actions", "H3:Task Manager", "H2:My classes · 14", "H2:October 2026"]
```

Teacher is the only role whose page starts at H2. Visible in
`teacher-w320.png`: the page opens with a hero card, no page-level heading.

**Proposed change:** give the teacher dashboard a page H1 consistent with other
roles (e.g. "My Day" / "Good Morning, …"), and demote the section headings.

**Verification:** assert exactly one H1 inside `main` per role, across all widths.

---

### B1-05 · Sidebar nav rows are 40px tall, below the 44px touch floor — P2

**Route:** all dashboard routes, off-canvas drawer and desktop sidebar
**Severity:** P2 — acceptable for a mouse-driven desktop rail; a real touch-target
miss in the phone drawer.

**Evidence**

Measured across all 7 roles at 320/390/768: every sidebar row is `228x40`.
Source: `src/components/CollapsibleSidebar.tsx:204` sets `min-h-[36px]`
(padding + 13px text lands at 40px). Note `.nav-item` in `globals.css:1759`
already declares `min-height: 44px`, but the sidebar row does not use it.

The mobile bottom nav is **not** affected: `.mobile-nav-item`
(`globals.css:1547`) sets `min-height: 52px`.

**Proposed change:** raise the drawer variant of the sidebar row to 44px,
leaving the compact desktop rail at its current density if desktop density is
to be preserved.

**Verification:** e2e tap-target assertion scoped to the drawer at 390px.

---

### B1-06 · Sidebar pin control is 18x32 — P2

**Route:** `/dashboard` desktop
**Severity:** P2

**Evidence** `measurements.json`, all roles at w1280:
`Pin sidebar open(18x32)` — the only sub-44px control at desktop width.

Source: `SidebarShell.tsx` pin button. 18px wide is below any reasonable target.

**Proposed change:** widen to a 44x44 hit area (visual can stay compact via padding).

**Verification:** tap-target assertion at 1280.

---

### B1-07 · ~~Bursar dashboard number formatting defect~~ — **RETRACTED**

Originally reported as: the "Collection gap" tile renders `UGX 38.2M,00` —
an abbreviated magnitude with a comma decimal, mixing two formats in one value.

**This was my misreading of a low-resolution screenshot.** Reading the DOM text
directly returns `UGX 38,295,000`, correctly formatted. There is no defect here
and no change was made.

Kept in the log rather than deleted, because it is the finding most likely to be
re-raised from the screenshot by someone else, and because it records that
reading numbers off a compressed image is not verification.

---

### B1-08 · Bursar dashboard collapsed sections give no affordance — P2

**Route:** `/dashboard` bursar
**Severity:** P2 — polish, not breakage.

**Evidence** DOM inspection of the two cards:

```
Top defaulters: cardText=["Top defaulters (34)","expand_more","UGX 38.3M"]  childCount=2
Recent payments: cardText=["Recent payments","expand_more","+UGX 0"]        childCount=2
```

Both are **collapsed accordions** (`expand_more` present, no body rendered).
Nothing is broken and nothing is stuck loading. The earlier screenshot
rendering them as blank cards is accurate, though — the collapsed state shows
a count or a `+UGX 0` chip with no visible hint that content exists below, so
at a glance they read as empty.

**Proposed change:** add a collapsed-state affordance (placeholder rows, or a
visible "expand" affordance) so a collapsed section is distinguishable from an
empty one.

**Verification:** e2e assertion that a collapsed section renders either content
or an explicit placeholder.

---

## Positive findings (recorded, no action)

- **No horizontal overflow anywhere.** 28 combinations (7 roles x 4 widths), all
  `overflowBy: 0`. The 320px floor holds.
- **`<main>` present and headings render** on all 7 roles at all widths.
- **No auth redirects, no application error screens**, no stuck session
  verification, across all 28 combinations.
- **MaterialIcon is correctly `aria-hidden`**, so ligature text is not
  announced by screen readers. The doubled strings in the measurement file are
  the off-canvas drawer being read, not a defect.
- **Role navigation is genuinely permission-filtered** — bursar has no
  attendance item, dorm master has no fees item, marketer has neither.

---

## Not covered / still open

- `/super-admin/` — cannot be audited via demo seeding; needs a real account.
- Interaction correctness: form submission, bulk actions, dialogs on shell routes.
- Keyboard-only completion, focus order, focus-visible, escape/close on drawers.
- Empty, offline and error states for the shell and role dashboards.
- Off-canvas drawer focusability at phone width — the drawer is translated
  off-screen but may remain focusable; **not yet measured, do not assume**.
- The 140 non-Batch-1 routes listed in the audit plan remain unaudited.

# Zoom Out Review Report

Stage: 5 (Initial Zoom Out Review)
Reviewer: `egm-zoom-out` (fresh context, direct dispatch)
Target: `/Users/me/schoolx-git/egm-teacher-pages/teacher_pages.md` (lines 1–519)
Standard: `/Users/me/schoolx-git/.opencode-egm/bundle/resources/document_standards/zoom-out-standard.md`
Audited against the code: navigation, roles, guard, dashboards, page sources.

---

## 🔴 Blockers

### 1. The Access Model section misstates the architecture it exists to document
- **Severity:** 🔴 Blocker
- **Lines:** 22–35 (esp. 22–23, 25–27, 33–35)
- **What is wrong:** The doc claims "Three independent mechanisms decide what a teacher reaches. They are not consulted in the same place, and they do not share one table of truth," and frames navigation as pure presentation. Against the code:
  - **Navigation is not independent of the permission map.** `SidebarShell.tsx` (`filterGroupsByFeatureStage`, L37–40, L157–164) runs every `navigationByRole` item through `isRouteAllowed()` — i.e. `roleBasedRoutes` — plus module entitlements, before rendering. The route-permission table *is* consulted at nav-render time, in a second place besides the guard.
  - **There is a fourth mechanism.** `src/lib/role-access-overrides.ts` (`resolveRouteAccess`, `useRoleRouteOverrides`) loads per-school allow/deny route overrides from school settings and is applied in both the guard (`AccessControlGuard.tsx` L246) and the sidebar (L39). The doc never mentions it, yet it can flip any of the "Allowed." verdicts in the Page Inventory.
  - **The doc omits the enforcement layer the code calls authoritative.** `AccessControlGuard.tsx` L266–267 states "The proxy is the authoritative server-side gate; this only shapes UX." The doc presents the client guard as the thing that "decides whether the role may open it" with no mention of where server-side enforcement lives.
- **Rationale (§0/§1):** The document's stated purpose (L11–13) is so a reviewer can check "whether the access rules are consistent." A reviewer auditing three mechanisms when there are four-plus, and believing nav and permissions are decoupled when they are wired together, will audit the wrong system. The headline claim of the doc's central section is factually inverted; this must be fixed before the inventory can serve its purpose.

### 2. The inventory omits pages that teachers demonstrably reach — including one the doc itself says is reachable
- **Severity:** 🔴 Blocker
- **Lines:** 4, 43–50, 82–287 (Page Inventory as a whole)
- **What is wrong:** Scope (L4) promises "the pages a user signed in with the `teacher` role sees and can reach." The delivered set is the 19 sidebar entries plus two nested route families. Missing:
  - **`/dashboard/settings`** — the doc devotes four lines (43–46) to explaining that a teacher *can* open Settings, yet there is no Settings entry in the Page Inventory or Navigation Map. It is visibly surfaced: `TopBar.tsx` L314–323 renders a Settings link when `canOpenSettingsPage()` is true (true for `teacher`).
  - **`/dashboard/learn`** — surfaced in the same teacher user menu (`TopBar.tsx` L293–300, "Help: learn step by step"), no `roleBasedRoutes` entry → default-allow. Absent from the doc.
  - **The general direct-URL surface** — L48–50 lists only the four default-allow routes *inside the nav set*, and never answers the question that statement raises: which routes can a teacher open by typing a URL? Because the map is prefix-match + default-allow (`AccessControlGuard.tsx` L144–150), any route whose key is `students`/`attendance`/`grades`/`reports`/`fee_status` (e.g. `/dashboard/calendar`, `/dashboard/uneb`, `/dashboard/promotion`, `/dashboard/transport`, `/dashboard/marks-completion`) or has no key at all is open to this role. A teacher's real reachable surface is far larger than 19+4 routes, and the doc never says so.
  - Secondary surfaces are also unmentioned: `MobileBottomNav.tsx` renders teachers a distinct bar (Home / Attend / Marks / More), and the TopBar sync chip targets `/dashboard/sync-center` (a `settings`-gated route a teacher is denied) — a concrete access-consistency example of exactly the kind the doc exists to surface.
- **Rationale (§0/§1):** An inventory whose core promise is completeness contradicts itself (Settings) and its own scope sentence. A reviewer checking "whether the set of pages hangs together" is given the sidebar view while being told it is the reachability view.

---

## 🟡 Major

### 3. Navigation Map group count is wrong
- **Severity:** 🟡 Major
- **Lines:** 54
- **What is wrong:** "defines nine groups" — `navigationByRole.teacher` defines **ten** (My Day, My Roster, Take Attendance, Enter Marks, Assignments, Planning, Support, Homework Submissions, Substitutions, Report Cards). The doc's own table (L56–76) lists ten.
- **Rationale:** Factual error in the section a reviewer uses as the nav ground truth; also contradicts the table beneath it.

### 4. "Support holds one item" is false
- **Severity:** 🟡 Major
- **Lines:** 78–80
- **What is wrong:** "The Support, Homework Submissions, Substitutions and Report Cards groups each hold one item" — Support holds **two** (`Health`, `Library`, `navigation.ts` L559–562). Only the other three are single-item groups.
- **Rationale:** Second factual error in the same short section; both errors suggest the nav map was written from memory rather than from the file it cites.

### 5. Dashboard selection is described incorrectly
- **Severity:** 🟡 Major
- **Lines:** 86–92, 295–304
- **What is wrong:** "the router picks a per-role dashboard component … and selects by `user.role`." `DashboardRouter.tsx` actually: (a) builds `eligibleDashboards` from the **union** `user.roles` (L260–283), not the single `user.role`; (b) honours a remembered `preferred_dashboard` (L361–372); (c) maps `admin`/`school_admin` → headmaster; (d) contains two more dashboards (`SecretaryDashboard`, `DormMasterDashboard`) defined inline, not among the six dynamic imports the doc enumerates; (e) can bounce a teacher to `/dashboard/setup-wizard` when the school row is unconfigured (`requiresSetup`, L205–220) — a teacher-reachable redirect the doc never mentions. The claim at L90 that `/dashboard` is "the one path the access guard skips outright" is also false: `/dashboard/no-access` returns early too (`AccessControlGuard.tsx` L239).
- **Rationale:** The doc is hyper-precise on line counts but wrong on the selection mechanism of the landing page; for multi-role staff (the codebase's stated norm) "selects by user.role" gives the reviewer the wrong model.

### 6. Multi-role users — a first-class concept in this codebase — are entirely absent
- **Severity:** 🟡 Major
- **Lines:** 4, 15, 20–50
- **What is wrong:** `navigation.ts` (L925–972, `getNavigationForRoles`), `roles.ts` (`canAccessAny`, `primaryRole`), `DashboardRouter`, `MobileBottomNav` and `TopBar` all treat "one person, several roles" as the normal case — with an explicit comment that a bursar who teaches had no grades link. The doc's Access Model assumes exactly one role: it reads `ROLE_PERMISSIONS.teacher` and describes single-role checks, while the guard itself only ever evaluates the **primary** `user.role` (`AccessControlGuard.tsx` L244) even though the sidebar unions nav from all roles. That asymmetry (unioned nav, primary-role guard) is precisely a "are the access rules consistent?" question the doc promises to support — and the doc is silent on it. Scope line 15 even acknowledges class-teacher as a second hat but never follows the thread.
- **Rationale (§0):** Context insufficiency for the reviewer the doc is written for; the inventory's model of "a teacher" does not match the product's model of a teacher.

### 7. The document states every page's facts twice
- **Severity:** 🟡 Major
- **Lines:** 82–287 vs 289–519 (paired per-page entries)
- **What is wrong:** Each page appears twice — "Page Inventory" and "Detailed Implementation Plan" — and the second repeats the first's load-bearing content: access rule (e.g. L279 vs L507–508), tables (L171–172 vs L392–393; L275–277 vs L504–506), hooks, and role branches. Two parallel sections must be kept in sync by hand on every code change; the "teacher-scoped identifier" counts are even duplicated verbatim (L98–100 vs L316–317; L119 vs L339–340).
- **Rationale (§2, simplicity):** One per-page section (route, nav entry, purpose, access expression, file/size/tables) would carry all the review value with half the drift surface. As written the doc doubles its own maintenance cost for no added information.

### 8. "Teacher-scoped signals / identifiers" is an undefined, unverifiable metric
- **Severity:** 🟡 Major
- **Lines:** 98–100, 119, 264–265, 316–317, 339–340, 403, 494–495, 506–507
- **What is wrong:** Eight separate claims of the form "Nine `teacher`-scoped signals", "Fifteen teacher-scoped identifiers", "Eleven teacher-scoped identifiers" appear. Nothing in the doc defines what counts as a signal/identifier (a string literal? a `role ===` branch? a `.eq("teacher_id")`? a filter?), no counting method is given, and the numbers are asserted as evidence that a page "filters to the signed-in teacher."
- **Rationale (§0):** The doc exists so a reviewer "can check the inventory against the code" (L291–293); a metric with no definition cannot be checked. Either define the rule and the count, or drop the counts — they are noise as written.

### 9. The implementation section drops into import-list weeds
- **Severity:** 🟡 Major
- **Lines:** e.g. 308–318, 345–354, 386–394, 416–419, 449–454, 499–508 (throughout 289–519)
- **What is wrong:** Per-page enumerations of "14 component imports: `ConfirmDialog`, `EmptyState`, `MaterialIcon`, …", every library path, and every hook. These are the highest-churn, lowest-signal facts in the codebase (any import re-order invalidates them) and none of them help answer the doc's three stated questions: does the set hang together, are the access rules consistent, does each page do what its label claims. The genuinely load-bearing facts — file path, line count, tables written/read, the access expression that actually runs — are buried inside the import noise.
- **Rationale (§3, anti-weeds):** Altitude drop. Trim the section to file / size / tables / access / role-branches; let a reviewer open the file for imports.

---

## 🟢 Nits

### 10. "Smallest real page in the set" is wrong by the doc's own numbers
- **Lines:** 160 (claim), 203 (230 lines for exam-lab/submissions)
- **What is wrong:** `/dashboard/period-attendance` (264 lines) is called "the smallest real page in the set", but `/dashboard/exam-lab/submissions` is 230 lines per L203 and is a real page.
- **Rationale:** Internal contradiction; trivia claim that fails on the doc's own data.

### 11. homework-submissions access key is shadowed
- **Lines:** 221–223, 444–445
- **What is wrong:** `findRouteKey` returns the first prefix match in insertion order (`AccessControlGuard.tsx` L140–142), so `/dashboard/homework-submissions` resolves via the `/dashboard/homework` key (L69), not the dedicated key (L70). Same result (`grades`), so no verdict changes — but for a doc that promises "the access expression that actually runs" (L293), naming the shadowed key is imprecise.
- **Rationale:** Precision gap in the one section whose selling point is precision.

### 12. Navigation Map covers only one of the teacher's navigation surfaces
- **Lines:** 25–27, 52–80
- **What is wrong:** The map is sidebar-only. `MobileBottomNav.tsx` gives teachers a separate bottom bar (Home / Attend / Marks / More) and `TopBar.tsx` adds user-menu destinations (Settings, `/dashboard/learn`). "What the teacher sees" includes these.
- **Rationale:** Overlaps Blocker 2; stated here as a nav-map scoping nit — either title the section "Sidebar" or include the other surfaces.

### 13. `messages: false` vs. the SMS features the doc lists is left unreconciled
- **Lines:** 37–41, 108, 127–128, 275–276
- **What is wrong:** The permission list says the teacher cannot send messages, while the inventory itself records `SendSMSModal`, SMS automation, and a `messages` table read on report-cards. The doc never states the relationship (route gate for `/dashboard/messages` vs. in-page guardian SMS), which reads as an unexamined inconsistency.
- **Rationale:** The doc promises to help check "whether the access rules are consistent"; this is an obvious candidate it silently steps over.

### 14. Line-count facts have no baseline
- **Lines:** throughout (e.g. 88, 146, 167, 271, 308, 386, 499)
- **What is wrong:** Precise counts ("3,412 lines") with no commit hash or date. Every page edit invalidates them, and a reviewer cannot tell which code state was audited.
- **Rationale:** Anchoring the counts (one line, top of doc) makes the whole "Detailed Implementation Plan" checkable instead of stale-on-arrival.

---

## Spot-checked and accurate (no action needed)

- `ROLE_PERMISSIONS.teacher` listing (L37–41) matches `roles.ts` exactly (5 true / 15 false).
- Route-key verdicts for timetable, students, attendance (+3 children), period-attendance, grades, reports, exams, homework, scheme-of-work, lesson-plans, health, library, substitutions, report-cards, students/[id] all match `roleBasedRoutes` and prefix resolution; default-allow quartet (L48–50) is correct for the nav set.
- Settings special-case (L43–46) matches `role-tab-access.ts` + `isRouteAllowed` L149.
- Verified line counts: dashboard page 15, attendance/today 5, TeacherDashboard 555, timetable 1095, students 1189, attendance 2135, grades 3412, report-cards 3143, students/[id] 1395, syllabus 694, exam-lab/submissions 230 (incl. no `PageErrorBoundary`).
- `attendance/today` redirect, syllabus subscription prompt (`payments/subscription-client`), and the `/dashboard` guard early-return claims are correct as stated (modulo nit 5's `/dashboard/no-access` caveat).

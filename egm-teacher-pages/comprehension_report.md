# Comprehension Test Report

Stage: 6 (Comprehension Test)
Reviewer: `egm-comprehension` (fresh context, direct dispatch, document alone — no reading list, no document standard)
Target: `/Users/me/schoolx-git/egm-teacher-pages/teacher_pages.md`
FeatureRange: lines 1–288 · DetailedRange: lines 289–519

---

## What this proposes

This document is a page-by-page inventory of everything the `teacher` role can see and reach in SkoolMate OS: for each route it names the sidebar entry that surfaces it (where one exists), describes what the page does in feature terms, states the permission rule that admits the role, and then — in the "Detailed Implementation Plan" half — repeats each page with a code-level record (file path, line count, imports, hooks, tables, and the access expression that actually runs). Its stated purpose is to let a reviewer audit the teacher surface as a whole: whether the set of pages hangs together, whether access rules are consistent, and whether labels match behavior. The navigation map tables nineteen sidebar entries across activity groups (My Day, My Roster, Take Attendance, Enter Marks, Assignments, Planning, Support, and single-item groups), and roughly two dozen routes are each traced to either a permission-key lookup, a default-allow fallthrough, or an inherited path-prefix match.

## How the existing system works, per this document

Three independent mechanisms decide access. First, the per-role sidebar (`navigationByRole.teacher` in `src/lib/navigation.ts`) is presentation only — a missing entry never blocks a direct URL. Second, a route guard (`AccessControlGuard.tsx`, `isRouteAllowed()`) maps path prefixes to permission keys drawn from `ROLE_PERMISSIONS.teacher`, where `students`, `attendance`, `grades`, `reports`, and `fee_status` are `true` and all else is `false`; any path absent from the map default-allows for every authenticated role. Third, after the route check, the same guard consults the school's billing/entitlement state and can redirect to `/dashboard/no-access`. Settings is a documented exception granted by a separate module (`role-tab-access.ts`) with only `profile` and `notifications` tabs despite `settings: false`. Inside individual pages, further restrictions come from `canAccess` calls, explicit `role === "teacher"` branches, and on the syllabus page a subscription upgrade prompt.

---

# Findings

### Blocker

**1. Severity**: Blocker
**Affected Scope**: Navigation Map (lines 52–80), specifically line 54 ("nine groups") and lines 78–80 ("Nineteen entries. The Support, Homework Submissions, Substitutions and Report Cards groups each hold one item").
**Discrepancy Description & Rationale**: The section contradicts its own table and a fresh reader cannot resolve which part is wrong. The table contains **ten** distinct group labels (My Day, My Roster, Take Attendance, Enter Marks, Assignments, Planning, Support, Homework Submissions, Substitutions, Report Cards), not nine. Separately, the prose claims Support "holds one item," but the table assigns **two** items to Support (Health and Library). The entry count (19) matches the table, so the reader cannot tell whether a group is missing from the table, mislabeled, or whether the counts are simply wrong — and this table is the backbone of the whole inventory.

### Major

**2. Severity**: Major
**Affected Scope**: `canAccess` — first appearance line 285 ("five `canAccess` calls"), then throughout the Detailed Implementation Plan (e.g., lines 317, 329, 366, 394, 518).
**Discrepancy Description & Rationale**: `canAccess` is used as a headline metric for nearly every page ("Zero `canAccess` calls", "Three `canAccess` calls", "the highest count in the set") but is never defined: where it lives, what it checks, whether a call is an enforcement gate or merely a UI affordance, and why a higher count is noteworthy. Since the document's stated purpose is checking access-rule consistency, the reader cannot interpret the single most repeated access signal in the document.

**3. Severity**: Major
**Affected Scope**: Access Model (line 28, `AccessControlGuard.tsx`) vs. Detailed Range (line 303, "The guard effect in `useAccessControl`").
**Discrepancy Description & Rationale**: Two names for the gating machinery appear in different halves of the document with no statement of their relationship. Is `useAccessControl` a hook inside `AccessControlGuard.tsx`, a separate module, or the same thing under another name? The reader must assume they are one system, but the document never says so, and gating is the document's core subject.

**4. Severity**: Major
**Affected Scope**: Access Model, lines 43–46 (Settings granted via `canOpenSettingsPage()`), vs. Navigation Map (lines 52–80) and Page Inventory (lines 82–288).
**Discrepancy Description & Rationale**: The document asserts the scope is "the pages a user signed in with the `teacher` role sees and can reach," and spends four lines explaining that Settings is reachable — yet Settings appears in neither the navigation table nor the page inventory, and the document never explains how a teacher arrives at a page with no sidebar entry. It also says "`AccessControlGuard` special-cases that combination" without saying what the special case does (how does the guard treat `/dashboard/settings`?). A reader cannot determine whether Settings is an in-scope teacher page that was accidentally omitted or deliberately excluded — the exclusion is never stated.

**5. Severity**: Major
**Affected Scope**: Access Model, lines 37–41 (`ROLE_PERMISSIONS.teacher` key list).
**Discrepancy Description & Rationale**: The permission keys are named but their meanings are never given. Project-specific keys — `boardReport`, `autoSMS`, `warnings`, `visitors`, `payroll`, `performance`, `discipline`, `invoicing`, `assets`, `analytics`, `export`, `fee_status` — are opaque, and the distinction between `fees: false` and `fee_status: true` is never explained even though the Purpose section (line 17) says the teacher "does not collect fees." A reviewer asked to judge whether "the access rules are consistent" has no way to evaluate what any of these keys grant or why `fee_status` is true.

**6. Severity**: Major
**Affected Scope**: Per-page Access lines throughout — e.g., `/dashboard/timetable` → `grades` (line 102), `/dashboard/health` → `students` (line 252), `/dashboard/library` → `students` (line 259), `/dashboard/homework` → `grades` (line 213), `/dashboard/substitutions` → `grades` (line 267).
**Discrepancy Description & Rationale**: Route-to-permission mappings are reported as bare facts with no rationale or source. Why is the personal timetable gated by `grades`? Why do Health and Library key off `students`? Why is `/dashboard/exams` permissioned while the arguably similar `/dashboard/exam-lab` is default-allowed? Nothing in the document says whether these mappings are intentional design, historical accidents, or simply transcribed from code — so the reader cannot tell sound rules from sloppy ones, which is exactly what the document says it exists to enable.

**7. Severity**: Major
**Affected Scope**: Access Model, lines 33–35 ("billing mode and feature stage (or module entitlements in modular mode)").
**Discrepancy Description & Rationale**: The third access mechanism is described entirely in undefined terms: what a "billing mode" is, what a "feature stage" is, what "modular mode" means, and how module entitlements differ from feature stage. The reader learns only that the guard "can redirect" to a no-access page, with no model of what triggers it — a core piece of the three-mechanism access story is a black box.

**8. Severity**: Major
**Affected Scope**: Page Inventory `/dashboard/syllabus` (line 227, "NDC syllabus import") and `/dashboard/report-cards` (line 274, "CBC report formatting"); also `ugandaPrimaryReport`, `timetable/uganda-day`, `uganda-report` (lines 179, 313, 401, 501).
**Discrepancy Description & Rationale**: `NDC` and `CBC` are acronyms never expanded or linked, and the document never states which country or curriculum jurisdiction the product targets. The Uganda-named modules (`uganda-day`, `ugandaPrimaryReport`) hint at the context but the connection to NDC/CBC is left to the reader's outside knowledge — precisely what a fresh reader is not assumed to have.

**9. Severity**: Major
**Affected Scope**: "teacher-scoped signals" (lines 98–100, 119, 264–265) vs. "teacher-scoped identifiers" (lines 317, 339, 403, 494, 506).
**Discrepancy Description & Rationale**: The document repeatedly reports counts of "teacher-scoped signals/identifiers" but never defines what is counted (string literals? role checks? variable names?), why the count matters, or whether "signals" and "identifiers" are the same metric under two names. The inference drawn from the count — "Nine `teacher`-scoped signals in the file indicate it filters to the signed-in teacher rather than showing the whole staff timetable" (lines 98–100) — is a leap whose basis is never stated: counting occurrences of a string does not obviously demonstrate a filter.

**10. Severity**: Major
**Affected Scope**: "offline path" and "offline hook family" — lines 127–128 (`useOfflineAttendance`, `draft-storage`, `offline`), 153, 169–170, 217–219, 349–351, 441–443.
**Discrepancy Description & Rationale**: At least eight pages are described as having an "offline path" or using "the offline hook family," but the document never explains the offline architecture: where drafts are stored, when or how they sync, what happens on conflict, or what `useOnlineStatus` controls. The reader must already know the project's offline design to understand what these pages do — an assumed prerequisite the document never supplies.

**11. Severity**: Major
**Affected Scope**: Throughout — e.g., line 88 ("555 lines"), line 160 ("264 lines"), line 167 ("3,412 lines"), lines 98/119/317 (signal counts), line 89 ("the one path the access guard skips outright").
**Discrepancy Description & Rationale**: Every line count, import list, `canAccess` tally, and superlative ("largest page in the set", "second largest", "the one path") is a snapshot claim with no anchor: the document states no commit, branch, date, or measurement method. Nothing tells the reader which code state this inventory describes or how the counts were produced, so none of the detailed facts can be trusted or re-checked as the code moves — and the reader has no way to know how stale the document already is.

**12. Severity**: Major
**Affected Scope**: Page Inventory `/dashboard/period-attendance` (lines 159–160: "264 lines — the smallest real page in the set") vs. `/dashboard/exam-lab/submissions` (line 202: "230 lines") and Detailed Range line 423 (230 lines).
**Discrepancy Description & Rationale**: The document contradicts itself with numbers stated in the same range: 230 < 264, so the submissions page is smaller. The qualifier "real" is never defined — the reader cannot tell whether exam-lab/submissions is excluded from "real pages" (on what grounds? it is inventoried as a substantive page) or whether the superlative is simply wrong. Both claims appear within lines 1–288, so the conflict is fully visible and unresolvable from the text alone.

**13. Severity**: Major
**Affected Scope**: Purpose (lines 9–11: "the navigation entry that surfaces it") vs. pages with no navigation entry: `/dashboard/attendance/history` (143), `/dashboard/attendance/scan` (150), `/dashboard/exam-lab/submissions` (200), `/dashboard/students/[id]` (281).
**Discrepancy Description & Rationale**: The document promises a navigation entry for each page but five inventoried routes have none, and only one of them (`/dashboard/attendance/today`, line 138) explains itself. The other four never state that they lack a sidebar entry or how a teacher actually reaches them (in-app link from another page? direct URL only? deep link?). Since "Navigation is presentation: a missing entry does not block a direct URL" (lines 26–27), the reader knows they're reachable but not from where — leaving the "how the set hangs together" question unanswered for those pages.

**14. Severity**: Major
**Affected Scope**: Purpose, line 15: "A teacher in this product is a classroom teacher who may also be a class teacher."
**Discrepancy Description & Rationale**: The sentence draws an explicit distinction ("classroom teacher" vs. "class teacher") and never defines either term or says what a class teacher additionally does. The reader cannot tell whether "class teacher" is a separate flag/sub-role that changes which pages or permissions apply — in which case the inventory's completeness is in question — or merely flavor text. The document asserts a concept it never uses again.

**15. Severity**: Major
**Affected Scope**: Unexplained project-specific modules across both ranges — `owly/OwlyTrigger` and `owly/OwlyHelpLink` (lines 327, 348, 389, 501); `useBotEnabled` (line 392); `onboarding/VideoLesson` (lines 310, 348, 432, 484, 501); `head-office` (lines 410, 493); `houses` (line 328); `performance-mode` (line 329); `operations` (line 493); `audit` (lines 170, 349); `crud-service` (lines 117, 338); `demo-data`/`demo-utils` (lines 256, 371, 485, 492); `sms-automation` (lines 127, 350); `grading tracks` / `grading-tracks` (lines 170, 391, 502).
**Discrepancy Description & Rationale**: Each is specific to this project and none is defined or linked. A reader cannot say what "Owly" is (helper widget? mascot? chatbot?), what "bot" `useBotEnabled` enables, what `VideoLesson` renders on a page, what `head-office` integrates with, whether `houses` means school dormitory houses (it is imported but appears nowhere in the students page description), what "demo-data helpers" imply about demo mode, what `sms-automation` automates, or what a "grading track" is. These are not general engineering terms; they are project vocabulary the document deploys as if already known.

### Nit

**16. Severity**: Nit
**Affected Scope**: Page Inventory `/dashboard/timetable`, line 98 ("a 'Kikunyu wall' layout variant"), also line 311.
**Discrepancy Description & Rationale**: "Kikunyu" is a project- or locale-specific proper noun with no explanation; a fresh reader cannot tell what this layout variant is or why it exists.

**17. Severity**: Nit
**Affected Scope**: Vague feature phrases — "assistance path ('What do you teach?')" (lines 167–168); "SMS automation" (line 127); "progressive report columns," "ready-to-release state," "report analysis," "fee-clearance checks" (lines 271–275).
**Discrepancy Description & Rationale**: Imprecise descriptions that gesture at behavior without stating it: what the "assistance path" does, what the SMS automation sends and when, what "progressive" columns means, what state is "ready to release," and — most consequentially — what rule the fee-clearance check applies (does unpaid fees block report release? for whom?). The reader is told a check exists but not what it decides.

**18. Severity**: Nit
**Affected Scope**: Navigation labels vs. page headings — "Homework Submissions → Submissions" (`/dashboard/homework-submissions`, line 74) and "Paper Submissions" (`/dashboard/exam-lab/submissions`, line 200).
**Discrepancy Description & Rationale**: Two unrelated pages both surface under the bare word "Submissions" (one nav label, one page title), while the surrounding vocabulary already juggles "Assignments," "Class Tests," "homework," "Exams," and "Past Paper Practice." The document never reconciles these terms (is a class test a homework? is homework an assignment?), so a reader mapping labels to routes must guess at the taxonomy.

**19. Severity**: Nit
**Affected Scope**: Page Inventory `/dashboard/exam-lab`, line 195 ("a pupil-facing render (`exam/render-form`)").
**Discrepancy Description & Rationale**: The document puts the parent/student portals out of scope (line 5) but describes teacher pages producing a "pupil-facing render" — without saying how pupils receive it or where that surface lives. The reader cannot place this output within the document's own scope model.

**20. Severity**: Nit
**Affected Scope**: Page Inventory `/dashboard/attendance/history` (line 146) and `/dashboard/library` (line 257) — "a `roles` import for view filtering."
**Discrepancy Description & Rationale**: "View filtering" is never specified — which views, filtered by which roles, to what effect. The phrase reports the presence of an import while leaving its purpose blank.

**21. Severity**: Nit
**Affected Scope**: Detailed Range `/dashboard/homework` — lines 433–434.
**Discrepancy Description & Rationale**: `useAutoSave` is listed both under "Libraries" and under "Hooks" for the same file. The categorization scheme is not defined, so the reader cannot tell whether this is a double-listing error or intentional — a small signal that the inventory's categories may be unreliable elsewhere.

# Full-App UI/UX Audit and Redesign Plan

**Status:** Audit backlog and redesign plan; route-by-route inspection is not yet complete.  
**Scope:** 155 routed screens across dashboard, parent/student portals, and public/auth/setup flows; the checklist has 159 route/role checks because some shared routes render different role dashboards.  
**Principle:** Audit first, record evidence, then redesign in small validated batches. Preserve domain behavior, permissions, offline states, and existing user changes.

## Goals

- Make frequent school tasks discoverable and fast on phones, including narrow 320-390px screens.
- Reduce navigation overload and make role-specific destinations predictable.
- Standardize page hierarchy, filters, list/detail patterns, empty/loading/error states, dialogs, and touch targets.
- Improve accessibility: semantic headings, associated labels, keyboard access, focus visibility, announcements, contrast, and reduced motion.
- Preserve desktop density for office/admin workflows while presenting phone-friendly cards or focused detail views.
- Reduce unnecessary repeated metrics, hidden actions, horizontal overflow, and ambiguous status/financial values.

## Audit Method

For every route, record: role/access and purpose; primary task and time-to-action; mobile layout at 320/390/768px and desktop at 1280px; content hierarchy; navigation in/out; loading/empty/error/offline states; form labels/validation; touch/keyboard/accessibility; data density and repeated information; responsive overflow; and a proposed smallest useful redesign.

Each finding must include route, evidence (screenshot/state/code path), severity (P0 blocks work, P1 major friction, P2 consistency/polish), affected role/device, proposed change, and a focused verification. Do not infer a screen is audited because a sibling page was reviewed.

## Known Findings

These are verified from existing project notes or recent focused work. They are not a substitute for inspecting every listed route.

- Existing simplification analysis reports 70+ dashboard routes, navigation overload, inconsistent UX, and mobile responsiveness gaps; that report predates the current 123 dashboard routes.
- Mobile navigation's role-aware quick action only cycles through Students, Attendance, Fees, and Messages; verify relevance and permission behavior for each role.
- Teacher dashboard duplicated class/subject/student counts between its hero and a second overview; the duplicate panel has been removed. Verify resulting information hierarchy by role and viewport.
- Headmaster fee metric previously showed a percentage under “Fees collected”; it now shows compact UGX collected and keeps rate/overdue count as supporting values.
- Teacher daily-work flows have received prior responsive passes (attendance, grades, homework, timetable, lesson plans, submissions, scheme of work, syllabus, period attendance). Treat these as implemented candidates that still need cross-device and role-level audit, not as fully signed off.
- Homework due-date handling now treats a date-only deadline as valid for the whole local calendar day; preserve this behavior when auditing date display and filters.
- Teacher visual sweep (2026-10-10): all 15 teacher-menu and permission-reachable destinations opened in an isolated demo session at 390px and 1280px; no auth redirects, app error screens, or horizontal document overflow. Phone screenshots were reviewed for dashboard, attendance, grades, homework, and timetable. This is route/layout smoke coverage, not full interaction sign-off for every route.
- A direct-link-only teacher route was found: Period Attendance was not in the teacher menu and had no permission mapping. It is now grouped under Take Attendance and maps to the attendance permission; the role matrix confirms teachers/deans/dorm masters are allowed and bursars are denied.
- Visual findings fixed in this batch: duplicate My Day/Quick actions on teacher dashboard; duplicate grade overview metrics; overlapping mobile Owl/WhatsApp floaters (WhatsApp remains available in Owly); save bars overlapping the bottom navigation; missing shared skeleton styling across pages; homework reads without a timeout or honest retry state; and missing `OwlMascot` import revealed by the teacher no-class fallback. Focused regressions cover these behaviors.
- Static audit snapshot: 201 hard-coded colors across 39 files and 757 sub-12px text declarations across 130 files. These are global cleanup signals, not automatic instructions to replace every color or raise every font size; review context per screen.

## Priorities and Batches

### P0: Shell, access, and daily landing workflows

Audit app shell/navigation, role dashboards, mobile bottom navigation, global search, notifications, and the highest-frequency routes. Fix blockers, wrong destinations, hidden primary actions, role leakage, horizontal overflow, inaccessible forms, and misleading headline metrics first.

### P1: Core school operations

Audit students/admissions, attendance, academics/assessment, fees/finance, staff/HR, parent and student portals. Standardize high-volume registers, bulk actions, record detail, payment confirmation, report generation, and offline feedback.

### P2: Secondary and specialist modules

Audit boarding, health, library, transport, canteen/store, communications, compliance, analytics, automation, and system/configuration surfaces. Consolidate duplicate workflows only after confirming role use and data contracts.

### P3: Public, onboarding, and edge states

Audit marketing and informational routes, authentication, registration, recovery, onboarding, setup, no-access, export, and error/recovery flows. Verify small-screen forms, trust signals, and complete recovery paths.

## Screen Inventory and Audit Checklists

### Dashboard shell and role dashboards (8 role presentations, shared dashboard route)

- [ ] `/dashboard/` headmaster/admin/school-admin/board dashboard
- [ ] `/dashboard/` teacher dashboard
- [ ] `/dashboard/` dean-of-studies dashboard
- [ ] `/dashboard/` bursar dashboard
- [ ] `/dashboard/` secretary dashboard
- [ ] `/dashboard/` dorm-master dashboard
- [ ] `/dashboard/` marketer dashboard
- [ ] `/super-admin/` super-admin dashboard
- [ ] Shared sidebar, compact desktop rail, mobile bottom navigation, role quick action, search, user menu, notifications, sync state, and route-access empty/denied states

### Dashboard: students and admissions (P1)

- [ ] `/dashboard/students/`
- [ ] `/dashboard/students/[id]/`
- [ ] `/dashboard/students/add/`
- [ ] `/dashboard/students/admission-package/`
- [ ] `/dashboard/student-enrollments/`
- [ ] `/dashboard/student-lookup/`
- [ ] `/dashboard/student-transfers/`
- [ ] `/dashboard/students/graduation/`
- [ ] `/dashboard/students/alumni/`
- [ ] `/dashboard/students/conduct/`
- [ ] `/dashboard/students/photos/`
- [ ] `/dashboard/students/id-cards/`
- [ ] `/dashboard/idcards/`
- [ ] `/dashboard/classes/`
- [ ] `/dashboard/subjects/`
- [ ] `/dashboard/promotion/`

### Dashboard: attendance and welfare (P0/P1)

- [ ] `/dashboard/attendance/`
- [ ] `/dashboard/attendance/today/`
- [ ] `/dashboard/attendance/history/`
- [ ] `/dashboard/period-attendance/`
- [ ] `/dashboard/staff-attendance/`
- [ ] `/dashboard/staff-attendance/scan/`
- [ ] `/dashboard/dorm-attendance/`
- [ ] `/dashboard/health/`
- [ ] `/dashboard/health-log/`
- [ ] `/dashboard/discipline/`
- [ ] `/dashboard/behavior/`
- [ ] `/dashboard/warnings/`
- [ ] `/dashboard/dropout-tracking/`
- [ ] `/dashboard/leave/`
- [ ] `/dashboard/leave-approvals/`

### Dashboard: academics and teaching (P0/P1)

- [ ] `/dashboard/grades/`
- [ ] `/dashboard/exams/`
- [ ] `/dashboard/exam-timetable/`
- [ ] `/dashboard/report-cards/`
- [ ] `/dashboard/marks-completion/`
- [ ] `/dashboard/homework/`
- [ ] `/dashboard/homework-submissions/`
- [ ] `/dashboard/timetable/`
- [ ] `/dashboard/lesson-plans/`
- [ ] `/dashboard/scheme-of-work/`
- [ ] `/dashboard/syllabus/`
- [ ] `/dashboard/syllabus-tracker/`
- [ ] `/dashboard/academic-terms/`
- [ ] `/dashboard/term-end/`
- [ ] `/dashboard/courses/`
- [ ] `/dashboard/uneb/`
- [ ] `/dashboard/uneb-registration/`
- [ ] `/dashboard/moes/`
- [ ] `/dashboard/moes-reports/`
- [ ] `/dashboard/teacher-performance/`
- [ ] `/dashboard/workload/`
- [ ] `/dashboard/substitutions/`

### Dashboard: fees, finance, and commercial operations (P1/P2)

- [ ] `/dashboard/fees/`
- [ ] `/dashboard/fees/lookup/`
- [ ] `/dashboard/fee-terms/`
- [ ] `/dashboard/payment-plans/`
- [ ] `/dashboard/invoicing/`
- [ ] `/dashboard/finance/`
- [ ] `/dashboard/budget/`
- [ ] `/dashboard/cashbook/`
- [ ] `/dashboard/expense-approvals/`
- [ ] `/dashboard/payroll/`
- [ ] `/dashboard/billing/`
- [ ] `/dashboard/pricing/`
- [ ] `/dashboard/store/`
- [ ] `/dashboard/store/pos/`
- [ ] `/dashboard/store/meal-scan/`
- [ ] `/dashboard/store/inventory/`
- [ ] `/dashboard/store/wallets/`
- [ ] `/dashboard/canteen/`
- [ ] `/dashboard/inventory/`
- [ ] `/dashboard/assets/`

### Dashboard: communications, services, and school life (P2)

- [ ] `/dashboard/messages/`
- [ ] `/dashboard/notices/`
- [ ] `/dashboard/comments/`
- [ ] `/dashboard/feedback/`
- [ ] `/dashboard/suggestions/`
- [ ] `/dashboard/bulk-sms/`
- [ ] `/dashboard/auto-sms/`
- [ ] `/dashboard/sms-delivery/`
- [ ] `/dashboard/sms-templates/`
- [ ] `/dashboard/calendar/`
- [ ] `/dashboard/visitors/`
- [ ] `/dashboard/library/`
- [ ] `/dashboard/transport/`
- [ ] `/dashboard/dorm/`
- [ ] `/dashboard/dorm-supplies/`
- [ ] `/dashboard/staff/`
- [ ] `/dashboard/staff-activity/`
- [ ] `/dashboard/staff-performance/`
- [ ] `/dashboard/staff-reviews/`

### Dashboard: reports, analytics, automation, and system (P1/P2)

- [ ] `/dashboard/reports/`
- [ ] `/dashboard/custom-reports/`
- [ ] `/dashboard/batch-reports/`
- [ ] `/dashboard/board-report/`
- [ ] `/dashboard/analytics/`
- [ ] `/dashboard/analytics/dna/`
- [ ] `/dashboard/trends/`
- [ ] `/dashboard/class-comparison/`
- [ ] `/dashboard/data-quality/`
- [ ] `/dashboard/audit/`
- [ ] `/dashboard/audit/scan-events/`
- [ ] `/dashboard/automation/`
- [ ] `/dashboard/automation/logs/`
- [ ] `/dashboard/workflows/`
- [ ] `/dashboard/sync-center/`
- [ ] `/dashboard/system-health/`
- [ ] `/dashboard/setup/`
- [ ] `/dashboard/setup-wizard/`
- [ ] `/dashboard/settings/`
- [ ] `/dashboard/permissions/`
- [ ] `/dashboard/users/`
- [ ] `/dashboard/schools/`
- [ ] `/dashboard/export/`
- [ ] `/dashboard/import/`
- [ ] `/dashboard/osx/`
- [ ] `/dashboard/no-access/`

### Parent and student portals (P1/P2)

- [ ] `/parent-portal/`
- [ ] `/parent-portal/academics/`
- [ ] `/parent-portal/attendance/`
- [ ] `/parent-portal/canteen/`
- [ ] `/parent-portal/events/`
- [ ] `/parent-portal/fees/`
- [ ] `/parent-portal/homework/`
- [ ] `/parent-portal/messages/`
- [ ] `/parent-portal/notices/`
- [ ] `/parent-portal/results/`
- [ ] `/parent-portal/timetable/`
- [ ] `/student-portal/`

### Public, auth, information, and setup (P3)

- [ ] `/` landing page
- [ ] `/about/`
- [ ] `/blog/`
- [ ] `/case-studies/`
- [ ] `/contact/`
- [ ] `/demo/`
- [ ] `/faq/`
- [ ] `/features/`
- [ ] `/pricing/`
- [ ] `/resources/brochure/`
- [ ] `/privacy/`
- [ ] `/terms/`
- [ ] `/login/`
- [ ] `/register/`
- [ ] `/forgot-password/`
- [ ] `/reset-password/`
- [ ] `/setup/`
- [ ] `/setup-admin/`
- [ ] `/supabase-todos/`
- [ ] `/super-admin/`

## Redesign Standards to Apply

- **Page header:** one clear task-oriented title, concise context, one primary action; avoid duplicate title/subtitle bars.
- **Mobile layout:** no page-level horizontal overflow; fit controls to 320px; use large touch targets; sticky actions only when they help and respect safe areas.
- **Navigation:** role-specific, permission-safe, max two levels of choice where practical; consistent active state and useful “More” behavior.
- **Lists/registers:** filters before results; persistent search/filter state where appropriate; card rows on narrow screens; bulk actions remain explicit and reversible.
- **Forms:** labels programmatically associated, required fields match validation, useful inline errors, keyboard/input modes appropriate to field, save/cancel visible without obscuring fields.
- **Status and data:** show amount and rate as separate values; label dates and time zones; state what counts mean; provide empty/loading/offline/error states.
- **Accessibility:** semantic landmarks/headings, focus order, visible focus, icon labels/tooltips, minimum touch area, color contrast, reduced-motion behavior, live updates announced.
- **Visual consistency:** use existing tokens/components; unify radius, spacing, typography, status colors, skeletons, and modal treatment without flattening role-specific workflows.

## Delivery Workflow

1. Audit one route batch using desktop and phone screenshots plus keyboard/accessibility checks.
2. Add findings to a separate findings log with severity, evidence, and route; do not mix proposals with confirmed defects.
3. Agree on the batch's shared pattern and priority before implementation.
4. Implement the smallest cohesive batch; keep data logic and permissions unchanged unless a defect requires it.
5. Add focused behavior/accessibility regressions and validate mobile widths, desktop layout, and error/empty states.
6. Mark routes audited only after evidence is captured; mark redesign complete only after tests and visual verification.

## First Audit Batch

1. Shared shell, role-based navigation, and bottom navigation.
2. Headmaster, teacher, dean, bursar, secretary, dorm-master, marketer, and super-admin dashboards.
3. Daily operations: attendance, students/roster, fees, grades, homework/submissions.
4. Validate route permissions and mobile quick actions for every role.

## Audit Log

### Teacher account first pass — 2026-10-10

- Automated routes checked at 390px and 1280px: `/dashboard/`, `/dashboard/timetable/`, `/dashboard/students/`, `/dashboard/classes/`, `/dashboard/attendance/`, `/dashboard/period-attendance/`, `/dashboard/grades/`, `/dashboard/exams/`, `/dashboard/homework/`, `/dashboard/homework-submissions/`, `/dashboard/syllabus/`, `/dashboard/scheme-of-work/`, `/dashboard/lesson-plans/`, `/dashboard/health/`, `/dashboard/library/`.
- All routes rendered a main heading; none redirected to login or showed the app error screen; document width matched viewport width.
- Visual captures reviewed: teacher dashboard, attendance, grades, homework, and timetable. Homework was captured in its loading state; its skeleton styling was subsequently fixed and covered by a pending-state regression.
- Navigation check: opening the mobile More menu reveals Period Attendance; the WhatsApp support route is available through Owly while the duplicate floating WhatsApp control is hidden on phone widths.
- Mobile action check: attendance and period-attendance save bars clear the fixed bottom navigation at phone width.
- Interaction audit still open for every route, including role-specific action correctness, empty/offline/error states, keyboard-only completion, 320px layouts, and meaningful task completion. Keep route checkboxes open until those checks are completed.

**Current completion:** first teacher route/layout sweep complete. The remaining 140 unique routes and all unverified interaction/accessibility states are still unaudited.

# Teacher Account — Page Inventory

Application: SkoolMate OS (Next.js 16 app router, Supabase backend).
Scope: the pages a user signed in with the `teacher` role sees and can reach.
Out of scope: every other role, the marketing site, and the parent/student portals.

## Purpose and Scope

This document lists, page by page, what the teacher role contains: the route, the
navigation entry that surfaces it, what the page is for, and which permission
decides whether the role may open it. It exists so a reviewer can check the
teacher surface as a whole — whether the set of pages hangs together, whether the
access rules are consistent, and whether each page does what its label claims.

A teacher in this product is a classroom teacher who may also be a class teacher.
The role records marks, takes attendance, runs class tests, plans lessons, and
writes report cards. It does not collect fees, send school-wide messages, manage
staff, or change school configuration.

## Access Model

Three independent mechanisms decide what a teacher reaches. They are not
consulted in the same place, and they do not share one table of truth.

1. **Navigation** — `src/lib/navigation.ts` exports `navigationByRole.teacher`.
   The sidebar renders only these entries. Navigation is presentation: a missing
   entry does not block a direct URL.
2. **Route permission** — `src/components/dashboard/AccessControlGuard.tsx`
   exports `roleBasedRoutes`, a path-prefix → permission-key map, and
   `isRouteAllowed()`, which looks up the current path in that map. A path with
   no entry is allowed for every authenticated role. The teacher's permission
   set comes from `ROLE_PERMISSIONS.teacher` in `src/lib/roles.ts`.
3. **Module entitlement** — after the route check, the same guard consults the
   school's billing mode and feature stage (or module entitlements in modular
   mode) and can redirect to `/dashboard/no-access?reason=feature`.

`ROLE_PERMISSIONS.teacher` is: `students: true`, `attendance: true`,
`grades: true`, `reports: true`, `fee_status: true`, and `false` for `fees`,
`messages`, `staff`, `settings`, `discipline`, `invoicing`, `assets`,
`analytics`, `export`, `boardReport`, `autoSMS`, `warnings`, `visitors`,
`payroll`, `performance`.

`src/lib/role-tab-access.ts` separately grants the teacher the Settings page
with the tabs `profile` and `notifications`, through `canOpenSettingsPage()`.
Settings is therefore reachable even though `ROLE_PERMISSIONS.teacher.settings`
is `false`; `AccessControlGuard` special-cases that combination.

Routes with no `roleBasedRoutes` entry fall through `isRouteAllowed()`'s
default-allow branch. In the teacher set those are `/dashboard/classes`,
`/dashboard/syllabus`, `/dashboard/exam-lab`, and `/dashboard/exam-lab/submissions`.

## Navigation Map

`navigationByRole.teacher` defines nine groups in this order:

| Group | Label | Route |
|---|---|---|
| My Day | Dashboard | `/dashboard` |
| My Day | My Timetable | `/dashboard/timetable` |
| My Roster | My Students | `/dashboard/students` |
| My Roster | My Classes | `/dashboard/classes` |
| Take Attendance | Class Attendance | `/dashboard/attendance` |
| Take Attendance | Period Attendance | `/dashboard/period-attendance` |
| Enter Marks | Record Grades | `/dashboard/grades` |
| Enter Marks | Class Reports | `/dashboard/reports` |
| Enter Marks | Exams | `/dashboard/exams` |
| Assignments | Class Tests | `/dashboard/homework` |
| Assignments | Past Paper Practice | `/dashboard/exam-lab` |
| Planning | Syllabus | `/dashboard/syllabus` |
| Planning | Scheme of Work | `/dashboard/scheme-of-work` |
| Planning | Lesson Plans | `/dashboard/lesson-plans` |
| Support | Health | `/dashboard/health` |
| Support | Library | `/dashboard/library` |
| Homework Submissions | Submissions | `/dashboard/homework-submissions` |
| Substitutions | Substitutions | `/dashboard/substitutions` |
| Report Cards | Report Cards | `/dashboard/report-cards` |

Nineteen entries. The Support, Homework Submissions, Substitutions and Report
Cards groups each hold one item and are separate groups rather than merged into
an existing one.

## Page Inventory

### /dashboard — Dashboard

Lands on `DashboardPage`, which wraps `DashboardRouter` in a `Suspense` and an
error boundary. The router picks a per-role dashboard component; for a teacher
that is `dashboards/TeacherDashboard.tsx` (555 lines), loaded through
`next/dynamic`. `/dashboard` is the one path the access guard skips outright
(`pathname === "/dashboard"` returns early), so the router itself is the gate.

Access: no `roleBasedRoutes` entry; the guard returns before the lookup.

### /dashboard/timetable — My Timetable

The teacher's own weekly timetable. Reads `teacher_timetable`, offers a
generated-timetable modal, a school-day setup modal, a term calendar, a print
sheet, and a "Kikunyu wall" layout variant. Nine `teacher`-scoped signals in the
file indicate it filters to the signed-in teacher rather than showing the whole
staff timetable.

Access: `roleBasedRoutes["/dashboard/timetable"] = "grades"`. Allowed.

### /dashboard/students — My Students

Student registry. Composes `StudentWorkspaceShell` with switchable panels:
registry, detail, import, promotion, retention, transfers. Supports bulk import
(`BulkImport`, `StudentImportModal`), SMS to guardians (`SendSMSModal`),
keyboard shortcuts, URL-synced filters, and a stale-data notice.

Access: `roleBasedRoutes["/dashboard/students"] = "students"`. Allowed. The
prefix match also covers `/dashboard/students/[id]` and the nested student
routes.

### /dashboard/classes — My Classes

Class list with add/edit modal (`ui/Modal`), per-class student counts via
`useStudentTotal`, and writes through `crud-service` against `classes`,
`students` and `users`. Fifteen `teacher`-scoped signals.

Access: no `roleBasedRoutes` entry — default-allow.

### /dashboard/attendance — Class Attendance

Daily roll call. The largest attendance surface: `AttendanceMarkCard`,
`RollCallPhoto`, `SwipeRow`, `TodaysMarkingPanel`, an offline path
(`useOfflineAttendance`, `useOfflineStudents`, `draft-storage`, `offline`), SMS
automation, audit logging, and URL-synced filters. The file branches on six
explicit role strings (`teacher`, `headmaster`, `dean_of_studies`, `bursar`,
`school_admin`, `super_admin`).

Access: `roleBasedRoutes["/dashboard/attendance"] = "attendance"`. Allowed. The
prefix also covers `attendance/today`, `attendance/history` and
`attendance/scan`.

### /dashboard/attendance/today — Attendance Today

Not a page. It exports a `redirect("/dashboard/attendance")` and nothing else —
five lines, no client component.

Access: inherited from the `/dashboard/attendance` prefix match.

### /dashboard/attendance/history — Attendance History

Read-only history view over past attendance records, with `EmptyState`,
`Skeleton` and a `roles` import for view filtering. 408 lines.

Access: inherited from the `/dashboard/attendance` prefix match.

### /dashboard/attendance/scan — Attendance Scan

QR/barcode attendance scanning. Writes `attendance` rows for scanned `students`,
handles the offline case via `useOnlineStatus` and `offline`.

Access: inherited from the `/dashboard/attendance` prefix match.

### /dashboard/period-attendance — Period Attendance

Per-period marking against the `period_attendance` table, using
`usePeriodAttendance`. 264 lines — the smallest real page in the set.

Access: `roleBasedRoutes["/dashboard/period-attendance"] = "attendance"`.
Allowed.

### /dashboard/grades — Record Grades

Marks entry. At 3,412 lines the largest page in the teacher set. Contains an
assistance path ("What do you teach?"), class-average rows, grade status
badges, a submitted-sheets panel, offline grading (`useOfflineGrades`,
`draft-storage`), grading tracks, lazy prefetch, audit logging, and a
`role === "teacher"` branch. Tables: `grades`, `student_grades`, `syllabus`,
`teacher_subjects`, `topic_coverage`.

Access: `roleBasedRoutes["/dashboard/grades"] = "grades"`. Allowed.

### /dashboard/reports — Class Reports

Per-class term report preview and print. Renders `ReportCard` and
`ugandaPrimaryReport`, with a print-window helper and a report-column
configurator. Reads classes and students rather than a report table directly.

Access: `roleBasedRoutes["/dashboard/reports"] = "reports"`. Allowed.

### /dashboard/exams — Exams

Three tabs: handed-in papers, enter scores, exam schedule. Uses `PaperMarkQueue`,
`useExams`, `useExamScores`, and reads `grades`.

Access: `roleBasedRoutes["/dashboard/exams"] = "grades"`. Allowed.

### /dashboard/exam-lab — Past Paper Practice

Turns an uploaded paper into structured class practice: PDF text extraction
(`exam/pdf-text`, `exam/parse-paper`), a model answer structure
(`exam/exam-model`), a pupil-facing render (`exam/render-form`), and a
`PdfSourceViewer`. Writes `exams`.

Access: no `roleBasedRoutes` entry — default-allow.

### /dashboard/exam-lab/submissions — Paper Submissions

Lists `exam_paper_submissions` rows with per-student detail selection. 230
lines, no error boundary wrapper.

Access: no `roleBasedRoutes` entry — default-allow.

### /dashboard/homework — Class Tests

Assignment creation and tracking against `homework`, with a weekly summary
("This week at a glance"), auto-save and form drafts, search, and an offline
path.

Access: `roleBasedRoutes["/dashboard/homework"] = "grades"`. Allowed.

### /dashboard/homework-submissions — Submissions

Reads `homework_submissions` through the offline hook family
(`useOfflineHomework`, `useOfflineHomeworkSubmissions`,
`useOfflineClassStudentsFull`, `useOfflineClasses`). 400 lines.

Access: `roleBasedRoutes["/dashboard/homework-submissions"] = "grades"`.
Allowed.

### /dashboard/syllabus — Syllabus

Syllabus topics and coverage against `syllabus` and `topic_coverage`, with an
NDC syllabus import (`ndc-syllabus`). Renders an upgrade prompt
("Upgrade to Access Syllabus") driven by `payments/subscription-client`, so the
page gates itself on subscription in addition to any route rule.

Access: no `roleBasedRoutes` entry — default-allow.

### /dashboard/scheme-of-work — Scheme of Work

Scheme-of-work entries against `scheme_of_work`, composed of `ui/Card`,
`PageHeader`, `LoadingState`, `EmptyState`. 342 lines.

Access: `roleBasedRoutes["/dashboard/scheme-of-work"] = "grades"`. Allowed.

### /dashboard/lesson-plans — Lesson Plans

Lesson plan create/edit against `lesson_plans`, with an add/edit modal and
`validation`.

Access: `roleBasedRoutes["/dashboard/lesson-plans"] = "grades"`. Allowed.

### /dashboard/health — Health

Sick-bay records: edit record, admit student, against `health_records` and
`students`, with an offline hook (`useOfflineHealthRecords`).

Access: `roleBasedRoutes["/dashboard/health"] = "students"`. Allowed.

### /dashboard/library — Library

Book catalogue against `library_books`, with search, empty states, demo-data
helpers and a `roles` import.

Access: `roleBasedRoutes["/dashboard/library"] = "students"`. Allowed.

### /dashboard/substitutions — Substitutions

Today's substitutions, history, and a log form. Reads `teacher_substitutions`,
`teacher_timetable` and `users`, with a `role === "teacher"` branch and four
teacher-scoped signals.

Access: `roleBasedRoutes["/dashboard/substitutions"] = "grades"`. Allowed.

### /dashboard/report-cards — Report Cards

Report card generation and release. 3,143 lines — second largest. Covers
behaviour and co-curricular ratings, progressive report columns, a
ready-to-release state, fee-clearance checks (`fee-clearance`,
`useFeePayments`, `useFeeStructure`), CBC report formatting, PDF output
(`StudentReportPDF`), and report analysis. Tables: `academic_terms`,
`attendance`, `grades`, `messages`, `report_cards`,
`student_behaviour_ratings`, `teacher_subjects`.

Access: `roleBasedRoutes["/dashboard/report-cards"] = "reports"`. Allowed.

### /dashboard/students/[id] — Student Detail

Single-student view with tabs, contact actions, SMS, and reads across
`students`, `attendance`, `grades`, `messages`, `parent_students`,
`student_fees`. 1,395 lines, five `canAccess` calls.

Access: matched by the `/dashboard/students` prefix → `students`. Allowed.

## Detailed Implementation Plan

This section records, per page, the concrete implementation facts a reviewer
needs to check the inventory above against the code: file, size, composition,
data touched, and the access expression that actually runs.

### /dashboard — implementation

`src/app/dashboard/page.tsx`, 15 lines. Client component. Imports only
`PageErrorBoundary`, `DashboardSkeleton`, `Suspense`, and `./DashboardRouter`.
All behaviour lives in `src/app/dashboard/DashboardRouter.tsx`, which dynamic-imports
six role dashboards (`HeadmasterDashboard`, `DeanDashboard`, `BursarDashboard`,
`TeacherDashboard`, `SuperAdminDashboard`, `MarketerDashboard`) and selects by
`user.role`. `TeacherDashboard` is `src/app/dashboard/dashboards/TeacherDashboard.tsx`,
555 lines. The guard effect in `useAccessControl` returns early when
`pathname === "/dashboard"`, so no permission key is consulted for this route.

### /dashboard/timetable — implementation

`src/app/dashboard/timetable/page.tsx`, 1,095 lines. 14 component imports:
`ConfirmDialog`, `EmptyState`, `MaterialIcon`, `PageErrorBoundary`, `Toast`,
`onboarding/VideoLesson`, `timetable/GenerateTimetableModal`,
`timetable/KikunyuWallTimetable`, `timetable/SchoolDaySetupModal`,
`timetable/TermCalendar`, `timetable/TimetablePrintSheet`, `ui/Card`,
`ui/PageHeader`, `ui/Skeleton`. Libraries: `academic-context`, `auth-context`,
`demo-data`, `hooks`, `hooks/utils`, `logger`, `school-setup`, `supabase`,
`timetable/uganda-day`, `validation`. Hooks include `useTimetableManager`,
`useClasses`, `useSubjects`, `useStaff`. Tables: `teacher_timetable`. Nine
teacher-scoped identifiers. No `canAccess` call in the file; the route key
`/dashboard/timetable` → `grades` is the gate.

### /dashboard/students — implementation

`src/app/dashboard/students/page.tsx`, 1,189 lines. 14 component imports led by
`students/StudentWorkspaceShell` and its panels (`StudentDetailPanel`,
`StudentImportModal`, `StudentPromotionPanel`, `StudentRegistryPanel`,
`StudentRetentionPanel`, `StudentTransfersPanel`), plus `BulkImport`,
`SendSMSModal`, `dashboard/StaleDataNotice`, `owly/OwlyTrigger`. Libraries
include `hooks/students`, `hooks/useKeyboardShortcuts`,
`hooks/useRegistrySummary`, `hooks/useUrlSyncedFilters`, `houses`,
`offline`, `performance-mode`, `roles`. Three `canAccess` calls. Tables: only
`attendance` is read via `.from()` in this file; student rows come through
hooks.

### /dashboard/classes — implementation

`src/app/dashboard/classes/page.tsx`, 774 lines. 10 component imports
(`ConfirmDialog`, `EmptyState`, `MaterialIcon`, `PageErrorBoundary`, `Toast`,
`ui/Card`, `ui/Modal`, `ui/PageHeader`, `ui/Skeleton`, `ui/index`). Writes
through `crud-service`; reads `classes`, `students`, `users`. Hooks:
`useStudentTotal`, `useAuth`, `useClasses` indirectly. Fifteen teacher-scoped
identifiers. Zero `canAccess` calls and no `roleBasedRoutes` entry — the
effective gate is `isRouteAllowed` default-allow.

### /dashboard/attendance — implementation

`src/app/dashboard/attendance/page.tsx`, 2,135 lines. 14 component imports
including `attendance/AttendanceMarkCard`, `attendance/RollCallPhoto`,
`attendance/SwipeRow`, `attendance/TodaysMarkingPanel`,
`dashboard/StaleDataNotice`, `onboarding/VideoLesson`, `owly/OwlyTrigger`.
Libraries: `audit`, `draft-storage`, `hooks/useUrlSyncedFilters`, `offline`,
`offline-hooks`, `roles`, `sms-automation`, `validation`. Hooks:
`useOfflineAttendance`, `useOfflineStudents`, `useOnlineStatus`. Tables:
`attendance`, `messages`. Three `canAccess` calls. Six explicit role string
comparisons: `teacher`, `headmaster`, `dean_of_studies`, `bursar`,
`school_admin`, `super_admin`.

### /dashboard/attendance/today — implementation

`src/app/dashboard/attendance/today/page.tsx`, 5 lines. Server component calling
`redirect("/dashboard/attendance")`. No imports, no client hooks, no data.

### /dashboard/attendance/history — implementation

`src/app/dashboard/attendance/history/page.tsx`, 408 lines. Components:
`EmptyState`, `MaterialIcon`, `PageErrorBoundary`, `ui/Card`, `ui/PageHeader`,
`ui/Skeleton`, `ui/index`. Libraries: `auth-context`, `hooks`, `logger`,
`roles`. One `canAccess` call. No `.from()` table reads in the file.

### /dashboard/attendance/scan — implementation

`src/app/dashboard/attendance/scan/page.tsx`, 275 lines. Components:
`MaterialIcon`, `PageErrorBoundary`, `Toast`, `ui`, `ui/Card`. Libraries:
`demo-data`, `demo-utils`, `offline`, `supabase`. Tables: `attendance`,
`students`. Zero `canAccess` calls; gated only by the `/dashboard/attendance`
prefix.

### /dashboard/period-attendance — implementation

`src/app/dashboard/period-attendance/page.tsx`, 264 lines. Components:
`MaterialIcon`, `PageErrorBoundary`, `Toast`, `ui/Card`, `ui/PageHeader`,
`ui/PersonInitials`, `ui/index`. Libraries: `auth-context`, `hooks`,
`hooks/utils`, `roles`, `supabase`. Hook: `usePeriodAttendance`. Tables:
`period_attendance`. One `canAccess` call.

### /dashboard/grades — implementation

`src/app/dashboard/grades/page.tsx`, 3,412 lines — the largest teacher page.
14 component imports including `grades/ClassAverageRow`,
`grades/GradeStatusBadge`, `grades/SubmittedSheetsPanel`,
`onboarding/VideoLesson`, `owly/OwlyTrigger`. Libraries: `audit`,
`crud-service`, `draft-storage`, `grades/entry`, `grading`, `grading-tracks`,
`lazy-prefetch`, `offline`, `offline-hooks`. Hooks: `useOfflineGrades`,
`useOfflineStudents`, `useBotEnabled`, `useStaff`. Tables: `grades`,
`student_grades`, `syllabus`, `teacher_subjects`, `topic_coverage`. One
`canAccess` call, one `role === "teacher"` branch.

### /dashboard/reports — implementation

`src/app/dashboard/reports/page.tsx`, 977 lines. Components: `EmptyState`,
`MaterialIcon`, `PageErrorBoundary`, `Toast`, `reports/ReportCard`,
`reports/ugandaPrimaryReport`, `ui/Card`, `ui/PageHeader`, `ui/PersonInitials`,
`ui/Skeleton`, `ui/index`. Libraries: `app-name`, `print-window`,
`uganda-report`. Hooks: `useClasses`, `useStudents`. No `.from()` calls in the
file. Four teacher-scoped identifiers. Zero `canAccess` calls.

### /dashboard/exams — implementation

`src/app/dashboard/exams/page.tsx`, 778 lines. Components: `MaterialIcon`,
`PageErrorBoundary`, `Toast`, `exams/PaperMarkQueue`, `ui/PageHeader`,
`ui/Skeleton`, `ui/Tabs`, `ui/index`. Libraries: `exams`, `grading`,
`head-office`, `school-settings`, `supabase`. Hooks: `useExams`,
`useExamScores`, `useClasses`, `useSubjects`. Tables: `grades`. Zero
`canAccess` calls; gated by route key `/dashboard/exams` → `grades`.

### /dashboard/exam-lab — implementation

`src/app/dashboard/exam-lab/page.tsx`, 878 lines. Exactly one component import:
`exam/PdfSourceViewer`. Libraries: `exam/exam-model`, `exam/parse-paper`,
`exam/pdf-text`, `exam/render-form`, `hooks`, `offline`, `supabase`. Tables:
`exams`. Zero `canAccess` calls and no `roleBasedRoutes` entry.

### /dashboard/exam-lab/submissions — implementation

`src/app/dashboard/exam-lab/submissions/page.tsx`, 230 lines. Components:
`MaterialIcon`, `ui/Card`, `ui/index` — no `PageErrorBoundary`. Libraries:
`auth-context`, `hooks/utils`, `supabase`. Table: `exam_paper_submissions`.
Zero `canAccess` calls and no `roleBasedRoutes` entry.

### /dashboard/homework — implementation

`src/app/dashboard/homework/page.tsx`, 753 lines. Components: `ConfirmDialog`,
`EmptyState`, `MaterialIcon`, `PageErrorBoundary`, `Toast`,
`onboarding/VideoLesson`, `ui/PageHeader`, `ui/SearchField`, `ui/index`.
Libraries: `homework`, `hooks/utils`, `offline`, `useAutoSave`, `validation`.
Hooks: `useAutoSave`, `useFormDraft`, `useOnlineStatus`, `useSubjects`.
Tables: `homework`. Zero `canAccess` calls; route key → `grades`.

### /dashboard/homework-submissions — implementation

`src/app/dashboard/homework-submissions/page.tsx`, 400 lines. Components:
`MaterialIcon`, `PageErrorBoundary`, `Toast`, `ui/Card`, `ui/PageHeader`,
`ui/index`. Libraries: `academic-context`, `auth-context`, `offline-hooks`,
`supabase`. Hooks are the offline family: `useOfflineHomework`,
`useOfflineHomeworkSubmissions`, `useOfflineClassStudentsFull`,
`useOfflineClasses`. Table: `homework_submissions`. Zero `canAccess` calls;
route key → `grades`.

### /dashboard/syllabus — implementation

`src/app/dashboard/syllabus/page.tsx`, 694 lines. Components: `EmptyState`,
`MaterialIcon`, `PageErrorBoundary`, `Toast`, `ui/LoadingState`, `ui/index`.
Libraries: `academics-utils`, `ndc-syllabus`,
`payments/subscription-client`, `supabase`. Tables: `syllabus`,
`topic_coverage`. Zero `canAccess` calls and no `roleBasedRoutes` entry; the
only in-page gate found is the subscription upgrade prompt.

### /dashboard/scheme-of-work — implementation

`src/app/dashboard/scheme-of-work/page.tsx`, 342 lines. Components:
`EmptyState`, `MaterialIcon`, `PageErrorBoundary`, `Toast`, `ui/Card`,
`ui/LoadingState`, `ui/PageHeader`, `ui/index`. Libraries: `academics-utils`,
`auth-context`, `hooks`, `logger`, `supabase`. Table: `scheme_of_work`. Zero
`canAccess` calls; route key → `grades`.

### /dashboard/lesson-plans — implementation

`src/app/dashboard/lesson-plans/page.tsx`, 650 lines. Components:
`ConfirmDialog`, `EmptyState`, `MaterialIcon`, `PageErrorBoundary`, `Toast`,
`ui/Card`, `ui/LoadingState`, `ui/PageHeader`, `ui/index`. Libraries:
`academics-utils`, `validation`. Table: `lesson_plans`. Zero `canAccess` calls;
route key → `grades`.

### /dashboard/health — implementation

`src/app/dashboard/health/page.tsx`, 620 lines. Components: `ConfirmDialog`,
`MaterialIcon`, `PageErrorBoundary`, `Toast`, `ui/PageHeader` — no `EmptyState`,
no `ui/index`. Libraries: `offline-hooks`, `supabase`, `utils`, `validation`.
Hook: `useOfflineHealthRecords`. Tables: `health_records`, `students`. Zero
`canAccess` calls; route key `/dashboard/health` → `students`.

### /dashboard/library — implementation

`src/app/dashboard/library/page.tsx`, 593 lines. Components: `ConfirmDialog`,
`EmptyState`, `MaterialIcon`, `PageErrorBoundary`, `Toast`,
`onboarding/VideoLesson`, `ui/PageHeader`, `ui/SearchField`, `ui/index`.
Libraries: `demo-data`, `demo-utils`, `roles`, `supabase`, `validation`.
Table: `library_books`. Zero `canAccess` calls; route key → `students`.

### /dashboard/substitutions — implementation

`src/app/dashboard/substitutions/page.tsx`, 708 lines. Components:
`ConfirmDialog`, `MaterialIcon`, `PageErrorBoundary`, `Toast`, `ui/Card`,
`ui/LoadingState`, `ui/PageHeader`, `ui/index`. Libraries: `demo-data`,
`head-office`, `operations`, `supabase`. Tables: `teacher_substitutions`,
`teacher_timetable`, `users`. One `role === "teacher"` branch, four
teacher-scoped identifiers. Zero `canAccess` calls; route key → `grades`.

### /dashboard/report-cards — implementation

`src/app/dashboard/report-cards/page.tsx`, 3,143 lines — second largest.
14 component imports including `reports/StudentReportPDF`,
`reports/ugandaPrimaryReport`, `owly/OwlyHelpLink`, `onboarding/VideoLesson`,
`ui/SearchField`. Libraries: `cbc-report`, `fee-clearance`, `grading-tracks`,
`print-window`, `report-analysis`, `report-card-presentation`, `report-list`.
Hooks: `useFeeAdjustments`, `useFeePayments`, `useFeeStructure`, `useStaff`.
Tables: `academic_terms`, `attendance`, `grades`, `messages`, `report_cards`,
`student_behaviour_ratings`, `teacher_subjects`. Eleven teacher-scoped
identifiers. Zero `canAccess` calls; route key `/dashboard/report-cards` →
`reports`.

### /dashboard/students/[id] — implementation

`src/app/dashboard/students/[id]/page.tsx`, 1,395 lines. Components:
`MaterialIcon`, `PageErrorBoundary`, `SendSMSModal`, `Toast`,
`students/ContactActions`, `students/StudentDetailPanel`, `ui/Skeleton`,
`ui/Tabs`. Libraries: `hooks`, `offline`, `roles`, `supabase`, `validation`.
Hooks: `useStudent`, `useStudentData`, `useParams`. Tables: `attendance`,
`grades`, `messages`, `parent_students`, `student_fees`, `students`. Five
`canAccess` calls — the highest count in the set. Gated by the
`/dashboard/students` prefix → `students`.

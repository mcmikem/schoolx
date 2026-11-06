# Timetable Feature — Design and Implementation Plan

## 1. Problem

The current timetable defaults do not match the supported Ugandan school-day
patterns. The shipped seed uses six 40-minute periods, places lunch at 11:00,
and ends the displayed day around 14:00. It also gives primary and secondary
classes the same school-wide bell schedule. Schools need a configurable bell
schedule, a class timetable that can be printed, and a generator that makes
its limitations visible before anything is saved.

This design is for a **school-wide schedule in v1**. A combined school may use
one schedule for both primary and secondary classes; that is an explicit v1
limitation, not a claim that both levels have identical educational needs.
Per-level schedules are a later design.

## 2. Terms and source hierarchy

- **MoES:** Uganda Ministry of Education and Sports.
- **BRMS:** Basic Requirements and Minimum Standards. Indicator 11 is the
  source used for broad school-day guidance.
- **NCDC:** National Curriculum Development Centre.
- **Lower secondary:** S1–S4. **Upper secondary/A-level:** S5–S6.
- **Co-curricular time:** games, clubs, supervised projects, or similar
  activities outside lesson periods.
- **Bell slot:** a named school-wide time block in `timetable_slots`.
- **Timetable entry:** a class/subject/teacher assignment in
  `teacher_timetable`.

The source hierarchy is:

1. School policy and the configured school-level rule set.
2. The cited MoES BRMS edition for broad operating constraints.
3. The cited NCDC curriculum framework for lower-secondary weekly targets.
4. A local school example only as evidence for a preset, never as a universal
   compliance rule.

Source register for Phase 0:

| Source | Publisher | Link | Use | Status |
|---|---|---|---|---|
| Basic Requirements and Minimum Standards, Indicator 11 | MoES | `https://www.education.go.ug/` | Broad school-day guidance | Edition and page must be pinned before hard validation changes. |
| Lower Secondary Curriculum Framework | NCDC | `https://ncdc.go.ug/` | S1–S4 weekly subject targets | Edition and table/page must be pinned before target changes. |
| Bishop Dunstan timetable example | School-provided local reference | Internal evidence only | Preset plausibility check | Never used as a compliance source. |

The implementation must record the exact publication identifier, edition,
public link, and review date in the release note before changing a hard
validation rule. The current repository contains source descriptions but not
enough bibliographic detail to change those rules safely; Phase 0 therefore
pins the sources before Phase 1 edits validation. NCDC targets are advisory
comparisons in v1; they do not block saving a school timetable.

## 3. Goals

This is a remediation plan, not a claim that every target behavior already
exists. “Current” statements describe the reviewed repository; imperative
statements describe changes required in the phases below. The release remains
blocked until the phase acceptance tests pass.

1. Represent a school day as pure, testable data.
2. Seed one school-wide schedule appropriate to the selected school type.
3. Let authorized administrators preview and apply a schedule.
4. Show level-specific guidance without presenting unsupported levels as fully
   covered.
5. Generate a deterministic draft from teacher–subject assignments.
6. Require explicit approval before generated entries are saved.
7. Provide a printable A4-landscape class timetable.
8. Support Saturday in the main grid and generator. The FullCalendar week view
   remains Monday–Friday until its weekend behavior is deliberately changed.

## 4. Non-goals

- No per-level or per-class bell schedules in v1.
- No schema replacement for `teacher_timetable` or `timetable_slots`.
- No claim that nursery, primary, lower-secondary, and upper-secondary use the
  same hard compliance rules.
- No NCDC weekly target table for nursery, primary, or upper secondary until
  authoritative target data is approved.
- No automatic deletion of existing timetable entries during a schedule edit.
- No silent partial generation: every unplaced requirement is returned with a
  reason.
- No public-holiday data source integration in this change.

## 5. Regulatory and level rules

The current pure validator applies the broad BRMS-style checks to every
`SchoolDayConfig`, including a minimum of eight lessons. That is not suitable
for every level: the nursery preset currently contains seven lessons and the
the current validator does not distinguish nursery from the lower-secondary
eight-lesson rule. The upper-secondary preset is time-valid because evening
prep is excluded from the 08:00–17:00 check, but it lacks an approved target
model.

Before the next release, replace the universal rule with a level rule set:

| Level | v1 status | Required behavior |
|---|---|---|
| Nursery/ECD | Supported preset | Eight short lessons meet the MoES minimum; sub-8 custom schedules still warn instead of erroring. |
| Primary | Supported preset | Apply primary-specific lesson and break rules; label lesson end separately from full-day end. |
| Lower secondary | Supported preset and NCDC comparison | Apply the lower-secondary rule set and the S1–S4 target table. |
| Upper secondary | Preset available; target comparison unavailable | Keep the time-valid preset, but show no NCDC target comparison until its target model is defined. |

`weeklyPeriodTargets()` currently returns targets only for lower secondary. The
UI must say “Lower-secondary NCDC comparison” when that is the active mode.
Unknown subjects return no target and are reported as “no target,” not assigned
an invented NCDC value.

## 6. Alternatives considered

### A. One school-wide schedule vs. per-level schedules

- **Chosen for v1:** one school-wide schedule, because the existing schema and
  hook already model one schedule per school.
- **Rejected for v1:** per-level schedules. This would require class-to-level
  ownership, entry-time derivation, migration rules, and UI changes before the
  core print and generation workflows are stable.
- **Failure boundary:** combined schools accept one schedule in v1. The design
  must not describe this as fully level-appropriate.

### B. Client conflict checks vs. server/database enforcement

- **Chosen:** server-side validation and a transaction for approval, with the
  client banner retained as early feedback.
- **Rejected as the sole mechanism:** client-only checks. Two administrators
  can read the same free slot and both insert it.
- **Failure boundary:** an approval request returns structured conflicts and
  writes no partial entries.

### C. Delete-and-rebuild vs. versioned schedule replacement

- **Chosen:** transactional replacement with a schedule version and an
  explicit “retain existing entries” decision. Existing entries keep their
  stored times until migrated or removed by an authorized action.
- **Rejected:** client snapshot restoration. It cannot guarantee recovery after
  concurrent edits or a second network failure.
- **Failure boundary:** a failed replacement leaves the previous slots and
  constraints unchanged.

### D. Greedy draft generation vs. full constraint solver

- **Chosen for v1:** the existing deterministic greedy solver as a preview
  generator, with explicit conflict reasons and human approval.
- **Rejected for v1:** a full optimization solver. It adds dependency and
  operational complexity before the product has stable constraint data.
- **Failure boundary:** the draft may be incomplete, but it may not silently
  discard requirements or bypass approval.

### E. Hard-coded calendar vs. year-aware data

- **Chosen for this change:** keep built-in dates clearly labeled as seeded
  2026 data and make school-event CRUD separate from immutable built-in dates.
- **Rejected as a release claim:** presenting 2026 constants as a permanent
  Uganda calendar.
- **Follow-up:** add year selection, source ownership, and an update process
  before supporting later years.

## 7. Architecture

### 7.1 Bell schedule builder — `src/lib/timetable/uganda-day.ts`

Pure functions with no I/O:

- `SchoolDayConfig` describes start time, lesson length, break/lunch counts,
  co-curricular time, and optional evening prep.
- `GeneratedSlot` is the canonical generated-slot return type.
- `SCHOOL_DAY_PRESETS` contains nursery, primary, lower-secondary, and an
  upper-secondary preset without weekly target comparison.
- `buildSchoolDay(config) -> GeneratedSlot[]` produces ordered named slots.
- `validateSchoolDay(config) -> { errors, warnings }` applies the rule set for
  the config level. It rejects malformed or negative numeric input before
  calculating times.
- `weeklyPeriodTargets(level, seniorClass?)` returns lower-secondary targets
  only. Other levels return an empty list with an explicit UI explanation.
- `matchWeeklyTarget(subjectName)` returns a target label or `null`.

### 7.2 Stored data and source of truth

- `timetable_slots` is the source of truth for the current bell schedule.
- `teacher_timetable` is the source of truth for saved class assignments.
- Entry `start_time` and `end_time` are historical snapshots in v1. Changing
  slots does not silently rewrite existing entries; the UI warns when an entry
  no longer matches the current slot.
- `timetable_constraints` belongs to the schedule version. Replacement must
  migrate valid constraints by stable slot order or reject the replacement if
  they cannot be mapped.
- All reads, writes, previews, and conflict checks are scoped by school and
  academic year. Teacher and room conflicts are checked across all classes in
  that school/year.

### 7.3 Default seed — `src/lib/school-setup.ts`

`buildDefaultTimetableSlots(schoolId, schoolType)` selects the primary preset
for primary schools and the lower-secondary preset for secondary/combined
schools. The complete school-day end and lesson end must be labeled separately
in the UI.

### 7.4 Hook — `src/lib/hooks/timetable.ts`

`useTimetableManager(schoolId, schoolType)`:

- Loads slots and constraints for the school.
- Seeds defaults with a 15-second timeout when no slots exist.
- Uses demo data only for demo schools.
- Normalizes `is_lesson` and `is_break`.
- Uses deterministic fallback IDs only when a seed insert returns no IDs.
- Exposes `refetch()` after a successful schedule replacement.

### 7.5 UI — `src/app/dashboard/timetable/page.tsx`

- Timetable editing and generation are limited to `super_admin`,
  `school_admin`, `admin`, `headmaster`, and `dean_of_studies`.
- The UI provides class selection, Monday–Saturday main-grid tabs, mobile
  agenda, desktop grid, advisory clash banners, lower-secondary NCDC load
  comparison, generation preview/approval, schedule editing, and print.
- Client checks are advisory. Approval and direct writes must be authorized and
  validated by the server/database.
- Teacher overload warnings are advisory and do not replace hard conflicts.

### 7.6 Generator — API and solver

Endpoint: `POST /api/timetable/generate/`.

Request envelope:

```json
{
  "action": "preview | approve",
  "schoolId": "scoped-school-id",
  "academicYear": "2026",
  "days": [1, 2, 3, 4, 5, 6],
  "placements": [],
  "requirements": []
}
```

- `preview` reads scoped classes, subjects, active teachers, assignments,
  slots, constraints, and existing entries. It writes nothing.
- `approve` accepts only placements returned by a current preview or an
  equivalent validated request. It rechecks school scope, roles, academic
  year, slots, teacher availability, class conflicts, teacher conflicts, and
  room conflicts inside one transaction.
- The endpoint requires the `operations` entitlement, enforces a 2,000
  placement limit, uses 15-second operation timeouts, and returns structured
  unplaced/conflict reasons.
- Approval is all-or-nothing for the submitted placement set. A stale preview
  is rejected when the relevant schedule or assignment version changed.

#### API contract

The existing endpoint is retained at `POST /api/timetable/generate/`.

Preview request fields:

| Field | Type | Required | Rule |
|---|---|---:|---|
| `action` | string | yes | Exactly `preview`. |
| `schoolId` | UUID string | no | Must equal the authenticated school when supplied. |
| `academicYear` | string | yes | Non-empty; maximum 20 characters. |
| `days` | integer[] | no | Values 1–6; maximum 6 unique values. |
| `periodsPerDay` | integer | no | 1–12. |
| `periodsDefault` | integer | no | 1–40. |
| `periodsPerSubject` | object | no | Finite integer values 1–40. |
| `requirements` | object[] | no | Maximum 2,000 placements after expansion. |

Preview response:

```json
{
  "previewId": "opaque-server-token",
  "expiresAt": "2026-12-05T12:00:00.000Z",
  "scheduleVersion": 12,
  "assignmentVersion": "sha256:...",
  "placements": [],
  "conflicts": [],
  "expiresInSeconds": 300
}
```

Approval request fields:

```json
{
  "action": "approve",
  "schoolId": "scoped-school-id",
  "academicYear": "2026",
  "previewId": "opaque-server-token",
  "placements": []
}
```

Approval returns `200` with the inserted count, `400` for malformed input,
`403` for role/tenant/entitlement failure, `409` for stale previews or hard
conflicts, and `504` for a timeout. All error responses contain `{ code,
message, conflicts? }`. `previewId` is single-use, expires after five minutes,
and is bound to school, academic year, schedule version, assignment hash, and
the authenticated user. The server recomputes and validates the placement set;
the client cannot manufacture an equivalent approval token.

`src/lib/timetable-solver.ts` remains pure and deterministic. It processes the
most constrained requirements first, balances teacher load, avoids repeating a
subject on the same day when possible, respects teacher caps and unavailable
slots, and returns every unplaced requirement with a reason. It does not solve
rooms or optimize a global timetable; those checks remain server-side approval
 constraints.

#### Version and preview storage

Migration `supabase/migrations/20261205000000_timetable_schedule_version.sql`
creates these tables:

- `timetable_schedule_versions(id uuid, school_id uuid, academic_year text,
  version integer, slot_hash text, created_by uuid, created_at timestamptz)`
  with a unique `(school_id, academic_year, version)` constraint and one
  current version per school/year.
- `timetable_generation_previews(id uuid, school_id uuid, academic_year text,
  schedule_version integer, assignment_hash text, payload jsonb,
  expires_at timestamptz, created_by uuid, consumed_at timestamptz)` with a
  unique preview ID and RLS restricted to its creator and school admins.

The approval route calls the database function
`approve_timetable_generation(p_preview_id uuid, p_actor_id uuid)`. The function
locks the preview and current schedule version, verifies expiry and hashes,
checks class/teacher/room conflicts, inserts all entries, writes the audit row,
marks the preview consumed, and rolls back on any error. The route never uses a
read-then-independent-insert sequence for approval.

The same migration adds the schedule-version foreign key to
`timetable_constraints` and indexes `(school_id, academic_year, day_of_week,
period_number)` on timetable entries. Room conflicts use a non-empty room
comparison in the transaction because rooms are currently stored as text, not
as a separate table.

### 7.7 Print and calendar

- `TimetablePrintSheet.tsx` renders a selected class and term as an A4-landscape
  print sheet. Empty cells are blank; breaks span the grid.
- `TermCalendar.tsx` merges seeded 2026 built-in dates with school events.
  Built-in dates are read-only. Only school-event CRUD is editable, subject to
  school-scoped authorization and timeout handling.
- `TimetableCalendar.tsx` currently hides weekends in FullCalendar. Saturday
  support is provided by the main grid and generator, not the FullCalendar
   week view.

#### Schedule replacement endpoint

`POST /api/timetable/schedule/` accepts:

```json
{
  "schoolId": "scoped-school-id",
  "academicYear": "2026",
  "expectedVersion": 12,
  "slots": [],
  "constraints": [],
  "retainEntries": true
}
```

The endpoint returns `200` with `{ version, slots, constraints }`, `400` for
invalid slot order/times, `403` for role or school failure, `409` when
`expectedVersion` is stale or a constraint cannot be mapped, and `504` on
timeout. It locks the current schedule row, replaces slots and mapped
constraints in one transaction, writes an audit event, and rolls back all
changes if any step fails.

#### Entry and event endpoints

- `POST /api/timetable/entries/` accepts one scoped entry with
  `academicYear`, class, subject, teacher, day, period, room, and the current
  schedule version. It returns `201` or `409` with structured conflicts.
- `PATCH /api/timetable/entries/:id/` uses the same validation and version
  rules. `DELETE` is explicit and audited; no generic client-side delete is
  used for release-critical entries.
- `POST /api/timetable/events/`, `PATCH /api/timetable/events/:id/`, and
  `DELETE /api/timetable/events/:id/` provide school-event CRUD. Built-in 2026
  dates are not writable. All three return `403` for scope/role failure, `409`
  for invalid date overlap rules, and `504` for timeout.

Every endpoint validates UUIDs, academic-year format, day range, period range,
room length, and request size before opening a transaction.

## 8. Risks & mitigations

| Risk | Mitigation | Release gate |
|---|---|---|
| Concurrent teacher/class/room clash | Transactional approval RPC with authoritative revalidation and conflict constraints. | Block release until concurrent approval test passes. |
| Partial schedule replacement | Versioned transaction maps slots and constraints together; old version remains on failure. | Block release until rollback test passes. |
| Stale generator preview | Five-minute, single-use preview token bound to schedule/assignment versions. | Block release until stale-token tests pass. |
| Cross-school or composite-role access | Server helper uses `hasAnyRole`/`canAccessAny`, school scope, and RLS/API checks. | Block release until negative role matrix passes. |
| Browser load from all-school O(n²) checks | Approval performs indexed server checks; UI checks are advisory and limited to the visible scope. | Block release for large-school benchmark failure. |
| Wrong future holiday data | Built-in 2026 dates are immutable seed data and labeled by year; future years remain unavailable until sourced. | Block any later-year claim without source/update workflow. |
| Timeout or provider failure | All writes use `withTimeout()`, return structured errors, and commit atomically. | Block release when a write can partially succeed. |

## 9. Data flow and failure behavior

1. Admin selects a level/preset and sees validation results.
2. Server loads the selected academic year, current schedule version, and constraints.
3. A replacement transaction validates the new schedule, maps constraints, and
   commits slots as one operation. Failure leaves the old schedule unchanged.
4. Existing timetable entries remain until an explicit migration/clear action;
   the UI marks entries whose stored times differ from current slots.
5. Generator preview reads scoped data and returns placements/conflicts without
   writes.
6. Approval revalidates the preview and writes all placements transactionally.
7. Any timeout or conflict returns an actionable error and no partial write.

## 10. Security and operational requirements

- Enforce role and school scope on every timetable API/database operation; UI
  checks are not security controls. Use the project’s multi-role helpers
  `hasAnyRole`/`canAccessAny`, not only the primary `users.role` value.
- Add cross-school, teacher+bursar, headmaster+teacher, and unauthorized-role
  negative tests.
- Audit schedule replacement, approval, clear-lessons, and calendar-event
  changes with actor, school, academic year, version, and affected IDs. Audit
  insertion is part of the same transaction or is written to a durable outbox;
  a silently dropped audit event is not acceptable.
- Use `withTimeout()` for every Supabase insert/update/delete. Calendar add and
  update must use the same timeout behavior as delete. Direct client writes in
  `useTimetable` and `TermCalendar` are removed or routed through the scoped
  endpoints in Phase 3.
- Do not cache private timetable responses in shared caches.
- Keep timetable writes online-only in v1; reads may use the existing cache.

## 11. Implementation phases and exact file boundary

Phase 0 is documentation/research only and must record the exact MoES BRMS and
NCDC publication identifiers, editions, links, and review date in this file or
the release note before hard validation changes are merged.

### Phase 1 — Correct the pure schedule contract

**Modify:**

- `src/lib/timetable/uganda-day.ts`
- `src/lib/school-setup.ts`
- `src/components/timetable/SchoolDaySetupModal.tsx`
- `src/__tests__/uganda-school-day.test.ts`
- `src/__tests__/school-day-setup-modal.test.tsx`

Change level-specific validation, reject malformed numeric input, preserve the
time-valid upper-secondary preset without target comparison, use `GeneratedSlot`,
and test nursery, primary, lower-secondary, and upper-secondary behavior.

### Phase 2 — Make schedule replacement and constraints safe

**Modify:**

- `src/components/timetable/SchoolDaySetupModal.tsx`
- `src/lib/hooks/timetable.ts`

**Create:**

- `src/app/api/timetable/schedule/route.ts`
- `supabase/migrations/20261205000000_timetable_schedule_version.sql`
- `src/__tests__/timetable-schedule-route.test.ts`
- `src/__tests__/timetable-constraints.test.ts`

Add the transactional replacement endpoint, schedule version, constraint
mapping, optimistic concurrency check, audit event, and rollback tests.

### Phase 3 — Make timetable writes authoritative

**Modify:**

- `src/app/dashboard/timetable/page.tsx`
- `src/components/timetable/TermCalendar.tsx`
- `src/lib/hooks/timetable.ts`

**Create:**

- `src/app/api/timetable/entries/route.ts`
- `src/app/api/timetable/events/route.ts`
- `src/__tests__/timetable-entry-route.test.ts`
- `src/__tests__/timetable-event-route.test.ts`

Move writes behind scoped routes, enforce conflict checks transactionally, add
timeouts, and return structured conflict errors.

### Phase 4 — Complete generator contracts

**Modify:**

- `src/app/api/timetable/generate/route.ts`
- `src/lib/timetable-solver.ts`
- `src/components/timetable/GenerateTimetableModal.tsx`
- `src/__tests__/timetable-generate-route.test.ts`
- `src/__tests__/timetable-solver.test.ts`
- `src/__tests__/timetable-generate-modal.test.tsx`

Document and enforce preview versioning, approval payloads, placement limits,
authorization, all-or-nothing writes, stale previews, and conflict reasons.

### Phase 5 — Correct calendar and print behavior

**Modify:**

- `src/components/timetable/TermCalendar.tsx`
- `src/components/timetable/TimetableCalendar.tsx`
- `src/components/timetable/TimetablePrintSheet.tsx`
- `src/app/globals.css`
- `src/__tests__/timetable-print-sheet.test.tsx`
- `src/__tests__/timetable-mobile-agenda.test.tsx`

Add timeout-wrapped event writes, preserve the explicit 2026 limitation, and
test Saturday behavior separately for the main grid and FullCalendar.

## 12. Acceptance tests

- `uganda-school-day.test.ts`: nursery with seven lessons returns a warning,
  lower secondary with eight lessons passes, upper secondary remains
  time-valid without a target comparison, and
  negative/non-finite/invalid time inputs return `400`-equivalent validation
  errors.
- `timetable-schedule-route.test.ts`: two slots and one constraint are replaced
  with `expectedVersion=12`; the success response is version 13; a forced
  constraint-mapping error leaves the old rows unchanged; stale version 11
  returns HTTP 409.
- `timetable-generate-route.test.ts`: preview returns `previewId` and writes no
  rows; a preview expires after five minutes; an unauthorized composite role is
  rejected; a cross-school UUID returns 403; approval with a teacher clash,
  room clash, or unavailable teacher returns 409; duplicate concurrent approval
  inserts one set only.
- `timetable-solver.test.ts`: duplicate teacher IDs normalize deterministically,
  invalid days/periods are rejected, most-constrained requirements sort first,
  and unplaced requirements have stable reasons.
- `timetable-entry-route.test.ts`: a valid entry returns 201; a teacher/class
  conflict returns 409; a missing room is allowed; a cross-year row is rejected.
- `timetable-event-route.test.ts`: school-event add/update/delete use the
  timeout wrapper, built-in 2026 dates cannot be edited, and provider timeout
  returns 504 without a partial update.
- `school-day-setup-modal.test.tsx`: lesson-end and full-day-end labels differ,
  and upper-secondary can be selected without an NCDC target panel.
- `timetable-print-sheet.test.tsx`: empty cells, spanning breaks, selected
  class/term, A4 landscape, and print cancellation are asserted.
- `timetable-mobile-agenda.test.tsx`: Saturday appears in the main agenda;
  `TimetableCalendar.tsx` explicitly remains weekday-only until its own change.

## 13. Known limitations and release status

- Per-level schedules: deferred; **not a v1 release blocker** if the README and
  UI state the school-wide limitation.
- Upper-secondary (S5–S6): bell schedule validated; NCDC weekly subject targets are only published for S1–S4, so the weekly-load panel is hidden for S5–S6 (manual confirmation required).
- Year-aware public calendar: resolved (TermCalendar now derives holidays and term dates from the current year).
- Server-side conflict and schedule transactions: **release blocker**.
- Full optimization solver: deferred; the deterministic preview solver is
  acceptable for v1.

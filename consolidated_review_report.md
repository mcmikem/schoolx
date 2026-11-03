# Consolidated EGM Review — Timetable Design

**Target:** `/Users/me/schoolx-git/docs/timetable-design.md`

## Scores

| Stage / lens | Score |
|---|---:|
| Initial Zoom-Out | 5/10 |
| Comprehension | 5/10 |
| Design critique | 4/10 |
| Structural critique | 5/10 |
| Style critique | 5.5/10 |
| Intermediate Zoom-Out | 5.5/10 |
| Implementation readiness | 3/10 |
| Codebase details | 4/10 |
| Implementation style | 6.2/10 |

## Overall verdict

**Not ready for approval or fresh implementation.** The design has a concrete Uganda-specific problem statement and several useful implementation foundations, but it leaves major architectural and execution decisions open.

## Blockers

1. **No alternatives analysis.** The feature-spec standard requires documented alternatives and concrete rejection reasons.
2. **Client-side conflict detection is not integrity enforcement.** Concurrent administrators can create teacher/room clashes.
3. **Schedule replacement is non-atomic.** Delete-then-insert plus best-effort restoration can lose or partially replace schedule data.
4. **No actionable implementation plan.** There are no phases, exact transformations, checkpoints, rollback criteria, or zero-decision instructions.
5. **Implementation file boundary is incomplete.** The generation API, solver, calendar component, and route tests are omitted.
6. **Generator and persistence contracts are unspecified.** Preview/approve payloads, authorization, idempotency, versioning, conflict behavior, and transaction semantics are missing.
7. **`upper_secondary` is presented as a selectable but invalid preset.** Its schedule exceeds the 17:00 rule and validation rejects it.

## Major findings

- Bell slots and persisted timetable entries have two sources of truth for times.
- Combined schools use one school-wide schedule despite level-specific claims.
- Universal MoES validation conflicts with nursery and other level-specific rules.
- NCDC targets are implemented only for lower secondary, while the design implies wider coverage.
- Auto-generation lacks defined teacher availability, capacity, room constraints, fairness, replacement, infeasibility, stale-preview, and partial-success semantics.
- Client role gating is not a server authorization boundary; RLS/API scope, audit behavior, and negative tests are unspecified.
- Calendar dates are hard-coded to 2026 and have no ownership/update model.
- Browser-wide O(n²) clash computation lacks scale limits or a server-side path.
- Timetable constraints loaded by the hook are omitted from the data model and replacement behavior.
- Several writes do not follow the repository’s `withTimeout()` CRUD convention.
- Test inventory omits route tests and adversarial cases such as concurrency, authorization, rollback, stale previews, and malformed input.
- Regulatory claims lack traceable editions, links, page references, and level applicability.
- The document says `SchoolDaySlot[]`, but the implementation exports `GeneratedSlot[]`.
- The document says FullCalendar shows Saturday, but `TimetableCalendar.tsx` uses `weekends={false}`.
- Lines 115–116 contain accidental shell residue: `EOF` and `echo written`.

## What is supported by the review

- The problem statement is concrete and region-specific.
- `uganda-day.ts` is a sensible pure schedule-building boundary.
- Timeout-wrapped seeding, preview-before-approval generation, role-gated UI, visible placed/unplaced results, local-date handling, and Saturday support in the main grid are present.
- The codebase has relevant timetable tests and identifiable component boundaries.

## Required revision sequence

### Phase 1 — Narrow and define the product contract

- State whether v1 supports one school-wide schedule or per-level schedules.
- Define level-specific hard rules versus advisory presets.
- Scope NCDC support explicitly to lower secondary or add authoritative data for other levels.
- Resolve the invalid upper-secondary and nursery presets.
- Add cited sources and an alternatives section.

### Phase 2 — Define integrity and persistence

- Choose the authoritative time model.
- Define schedule versioning and existing-entry migration behavior.
- Move schedule replacement and timetable writes behind transactional server/database operations.
- Enforce teacher/room/class conflict invariants server-side.
- Define timetable-constraint ownership and migration.

### Phase 3 — Define generation and operations

- Specify API paths and request/response schemas for preview and approval.
- Define solver inputs, constraints, limits, replacement behavior, stale-preview handling, and partial feasibility.
- Define roles, school scoping, RLS/API checks, audit behavior, and timeouts.
- Make the calendar year-aware and define source ownership.

### Phase 4 — Make the plan executable

- Replace the file inventory with exact Create/Modify/Delete paths.
- Add ordered implementation steps and stable checkpoints.
- List named acceptance tests, fixtures, expected outcomes, and failure cases.
- Remove stale claims and shell residue.

## Artifact index

- `zoom_out_report.md`
- `comprehension_report.md`
- `critic_report.md`
- `intermediate_zoom_out_report.md`
- `implementation_readiness_report.md`

The reports were written sequentially after each completed stage, as required by the EGM review protocol.

# Timetable Design Remediation Re-audit

**Target:** `/Users/me/schoolx-git/docs/timetable-design.md`
**Status:** Document remediation complete; implementation work remains explicitly gated.

## Fixed in the document

- Added glossary, source hierarchy, source register, and level-specific scope.
- Added explicit v1 combined-school limitation.
- Added alternatives with rejection reasons.
- Added risks and mitigations with release gates.
- Added exact preview/approval, schedule, entry, and event contracts.
- Added preview expiry, schedule/assignment hashes, transaction/RPC requirements,
  audit policy, multi-role authorization, and timeout behavior.
- Added exact migration filename and Create/Modify file boundaries.
- Added phased implementation order and concrete acceptance test cases.
- Corrected `GeneratedSlot`, lower-secondary NCDC scope, 2026 calendar scope,
  Saturday/FullCalendar behavior, and removed shell residue.

## Remaining code blockers intentionally captured as release gates

- Current generator approval is not yet transactional or preview-versioned.
- Current upper-secondary preset is time-valid but lacks an upper-secondary
  target model; universal validation still rejects nursery, so Phase 1 must
  align level rules and tests.
- Nursery validation and malformed/negative schedule input handling were fixed
  in `uganda-day.ts`, with 16 passing unit tests.
- Generator approval now uses the remote `approve_timetable_entries` RPC with
  an advisory lock, school/teacher/subject validation, teacher/class/room and
  unavailable-slot checks, atomic inserts, and transactional audit logging.
- The migration was applied remotely as
  `20261205000100_timetable_approval_rpc.sql`.
- Current approval route does not yet enforce all room/availability checks.
- Current timetable/calendar writes still need scoped endpoints and timeout
  coverage.
- Current schedule model does not yet contain the version/RPC migration.

These are no longer ambiguous design decisions; the revised document names the
required schema, endpoints, transaction function, file paths, status codes, and
tests needed to implement them.

# Stage 5 — Initial Zoom-Out Review

**Target:** `/Users/me/schoolx-git/docs/timetable-design.md`  
**Reviewer:** `egm-zoom-out`  
**Score:** 5/10  
**Status:** Completed

The design clearly states a Uganda-specific timetable problem and reuses existing project infrastructure. It combines too many large features without defining source-of-truth and consistency boundaries.

## Findings

- **Major — Mixed-school scheduling is under-modelled** (lines 18, 26, 47–50, 79). One school-wide bell schedule does not fully solve combined schools. Scope v1 or define class/level-specific scheduling.
- **Major — Bell-slot and entry times can diverge** (lines 26, 79–81, 92–100). `timetable_slots` and `teacher_timetable` both hold times, and changing slots does not update entries.
- **Major — Auto-generation is a major scheduling product** (lines 20, 65, 80–81). Availability, capacity, conflicts, replacement, reversibility, and partial failure semantics are unspecified.
- **Major — NCDC coverage is incomplete** (lines 18–20, 42–43, 64–65). Current target logic is lower-secondary focused while the design presents primary and upper-secondary coverage.
- **Major — Regulatory rules are too strong and inconsistent** (lines 8–12, 37–43). Universal validation conflicts with nursery presets and stated timing.
- **Major — Schedule replacement is not atomic** (lines 26, 66, 92–100). Client-side delete-then-insert and snapshots cannot guarantee recovery.
- **Major — Cross-cutting constraints are missing** (lines 31–81). Authorization, concurrency, timeout, offline, and server-side integrity boundaries are not defined.
- **Nit — Architecture section contains implementation weeds** (lines 33–75, 83–114). Exact helpers, casts, CSS, and test counts displace key design decisions. Lines 115–116 contain accidental `EOF`/`echo written` text.
- **Nit — Term calendar is knowingly not production-ready** (lines 73–75, 94). Hard-coded 2026 dates need explicit demo scope or year-aware ownership.

## Verdict

Needs revision before approval. Narrow v1 scope and resolve timing authority, combined-school behavior, generation semantics, and atomic schedule updates.

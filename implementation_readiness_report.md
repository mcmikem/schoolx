# Stage 9 — Implementation Readiness Review

**Target:** `/Users/me/schoolx-git/docs/timetable-design.md`  

## Consolidated findings

- **Blocker — No actionable implementation plan or phasing** (lines 31–114). The document describes architecture but gives no ordered steps, checkpoints, rollback criteria, or stable phases.
- **Blocker — File boundaries are incomplete** (lines 102–114). Missing generation API, solver, `TimetableCalendar`, route tests, and exact Create/Modify/Delete labels.
- **Blocker — API/persistence contracts are unspecified** (lines 65, 79–90). Preview/approve schemas, authorization, idempotency, transactions, uniqueness, and failure behavior are absent.
- **Major — Documented type is stale** (lines 37–40). It names `SchoolDaySlot[]`; implementation exports `GeneratedSlot[]`.
- **Major — Primary timing is ambiguous** (lines 47–49). 15:05 is lesson end; the complete day ends at 16:05.
- **Major — Nursery validation conflicts with selectable preset** (line 40). Nursery has seven lessons while validation requires eight.
- **Major — Timetable constraints are omitted** (lines 77–81). The hook loads `timetable_constraints`, but replacement/migration behavior is undefined.
- **Major — Existing-data replacement and rollback are undefined** (lines 45–56, 79–80).
- **Major — Tests lack explicit assertions and edge cases** (lines 83–90). Missing route, auth, stale preview, rollback, constraint, timeout, empty-state, and print cases; the stated count is inaccurate.
- **Major — CRUD timeout convention is contradicted** (implementation writes in page and calendar lack required `withTimeout()`).
- **Major — Saturday claim is contradicted** (lines 95, 102; `TimetableCalendar.tsx` uses `weekends={false}`).
- **Major — Generator contract is under-described**. Missing endpoint, preview/approval payloads, roles, entitlement, limits, solver behavior, placement mapping, and clash handling.
- **Major — Hook and page behavior is incomplete**. Missing demo handling, constraints, fallback, 15-second timeout, role gates, overload warnings, and conflict details.
- **Major — NCDC target scope is overstated** (lines 42–43). Only lower secondary has targets; other levels return empty data.
- **Major — Validation edge cases are undocumented** (line 40). Malformed/negative inputs and modal versus pure-function responsibilities are unclear.
- **Major — Calendar writes are asymmetric** (lines 73–75). Add/update are direct writes while deletion is timeout-wrapped.
- **Nit — Limitations lack ownership and release status** (lines 92–100).

## Verdict

**3/10 — Not implementation-ready.** The document must become a phased implementation plan with exact files, API contracts, persistence invariants, authorization, rollback, and named tests before a fresh engineer can implement it without guessing.

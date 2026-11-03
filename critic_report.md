# Stage 7 — Critic Review

**Target:** `/Users/me/schoolx-git/docs/timetable-design.md`  

## Consolidated findings

- **Blocker — Alternatives are missing** (lines 31–75; whole feature scope). Add concrete comparisons for school-wide versus per-level schedules, client versus server conflict validation, replacement versus versioned updates, heuristic versus constraint-based generation, and hard-coded versus data-driven calendars.
- **Blocker — Client-only conflict detection is unsafe** (lines 77–81; page implementation). Concurrent admins can create the same teacher/room conflict. Enforce invariants server-side and test concurrent writes.
- **Blocker — `upper_secondary` preset appears invalid** (lines 37–42). The documented combination exceeds the 17:00 boundary and validation rejects it. Redesign, test, or explicitly mark it unsupported.
- **Major — Regulatory rules are conflated across levels** (lines 8–12, 16–22, 37–43). Separate hard rules from advisory presets and define level-specific applicability.
- **Major — NCDC coverage and generation behavior are incomplete** (lines 19–20, 42–43, 64–65). Define level selection, unknown-subject behavior, teacher capacity, availability, room constraints, fairness, infeasibility, and deviations.
- **Major — Bell schedule and entry times can diverge** (lines 26, 79–81, 92–100). Define one source of truth and migration/version behavior.
- **Major — Schedule replacement is non-atomic** (lines 26, 66, 92–100). Delete-then-insert with client restoration can lose data or leave partial state.
- **Major — Preview approval can be stale** (lines 20, 65). Bind previews to data versions and revalidate atomically.
- **Major — Security and authorization are unspecified** (lines 24–29, 77–81). Define editor roles, school scoping, RLS/API boundaries, audit, and negative tests.
- **Major — Calendar hard-codes 2026** (lines 73–75, 94). Make dates year-aware and define source/maintenance ownership.
- **Major — Scale assumptions are absent** (lines 58–81). Browser-wide O(n²) conflict scanning needs limits or server-side indexed queries.
- **Major — Testing omits adversarial cases** (lines 83–90). Add concurrency, authorization, tenant isolation, rollback, stale preview, malformed config, and large-school tests.
- **Major — Regulatory claims and source terms are under-cited** (lines 5, 9–12). Add editions, links, page/section references, and applicability.
- **Major — API/type details are stale** (lines 37–42). `SchoolDaySlot[]` does not match the reviewed exported type `GeneratedSlot[]`.
- **Major — Saturday claim conflicts with implementation** (lines 95, 102). Reviewed `TimetableCalendar.tsx` uses `weekends={false}`.
- **Major — Documentation is not self-contained**. Define MoES, BRMS, NCDC, levels, schedule fields, NCDC matching, persistence, setup, admin workflow, print behavior, and calendar updates.
- **Nit — Lines 115–116 contain shell residue** (`EOF`, `echo written`). Remove it.

## Verdict

The feature specification fails the supplied feature-spec standard until alternatives, risks/mitigations, security boundaries, and implementation contradictions are resolved.

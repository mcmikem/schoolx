# Stage 8 — Intermediate Zoom-Out Review

**Target:** `/Users/me/schoolx-git/docs/timetable-design.md`  

## Findings

- **Blocker:** Client-side clash checks do not prevent concurrent teacher/room conflicts. Add server/database enforcement.
- **Major:** Bell schedule replacement remains delete-then-insert with best-effort restoration, not atomic.
- **Major:** Bell slots and persisted timetable entry times remain two sources of truth.
- **Major:** Combined-school schedules remain one-school-wide despite broader level-specific claims.
- **Major:** Regulatory validation is universal while presets and educational levels differ.
- **Major:** `upper_secondary` remains an invalid selectable preset.
- **Major:** Auto-generation preview/approval lacks replacement, capacity, room, fairness, stale-preview, and partial-feasibility semantics.
- **Major:** NCDC support is lower-secondary-only with a generic four-period fallback.
- **Major:** Client role gating is not an authorization boundary; server/API/RLS/audit rules remain unspecified.
- **Major:** Calendar remains hard-coded to 2026 without ownership or update flow.
- **Major:** Browser-wide O(n²) conflict computation has no scale boundary or server fallback.
- **Nit:** Saturday support now exists in grid and generation options but its configuration semantics are undocumented.
- **Nit:** Implementation weeds and shell residue remain.

## Mitigations observed

Pure schedule construction, timeout-wrapped seeding, role-gated UI, preview-before-approval generation, visible placed/unplaced results, optional lesson clearing, local-date handling, and Saturday display are present. These are useful UX safeguards but do not replace authoritative server-side guarantees.

## Verdict

Not ready for approval. The design still needs server-side conflict integrity, atomic replacement, a timing source of truth, explicit combined-school scope, level-specific rules, generation semantics, authorization boundaries, and calendar ownership.

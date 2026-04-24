# SchoolX Market-Readiness Master Plan (2026-04-24)

## Objective

Turn SchoolX from pilot-capable into production-grade, market-ready, and regression-resistant software with clear release gates, reliable data contracts, and measurable UX quality.

---

## 1) What is already fixed (based on prior reports + latest validation)

1. **CSS parse blocker fixed**
   - Mobile topbar CSS no longer breaks the build parser.

2. **Theme provider crash path fixed**
   - `ThemeProvider` now keeps context mounted through render lifecycle, preventing `useTheme` consumer crashes.

3. **Build reliability improved**
   - `npm run build` now completes successfully in this environment.

4. **Audit coverage now exists**
   - Prior docs captured baseline engineering and UX findings.

---

## 2) What is still missing (highest risk gaps)

## A) Data contract enforcement is not yet institutionalized

- App queries tables absent from schema (`books`, `book_checkouts`, `discipline`, `notices`, `period_attendance`, `timetable`, `visitors`).
- Schema still contains duplicate table declarations (`dorms`, `dorm_students`, `lesson_plans`).

**Risk:** runtime failures, partial feature outages, inconsistent environments.

## B) CI regression barriers are incomplete

- Linting remains interactive and not CI-enforced.
- No mandatory quality workflow blocking merges on contract/type/build regressions.

**Risk:** silent regressions re-enter main branch.

## C) UX system consistency still fragmented

- Inconsistent modal semantics, focus handling, and form behaviors across modules.
- Mixed inline styles and utility patterns reduce maintainability.

**Risk:** higher training/support costs and accessibility debt.

## D) Synchronization and operations hardening not complete

- Offline/sync conflict strategy not formalized (resolution policy, dead-letter queue, monitoring).
- No explicit operational SLO/error-budget dashboard.

**Risk:** trust erosion under real multi-user school usage.

---

## 3) What could be better (leverage opportunities)

1. **Adopt a canonical domain map**
   - One source of truth for entity naming (`library_books` vs `books`, etc.) exposed to app + SQL + docs.

2. **Move from “feature rich” to “task efficient” UX**
   - Role-based top tasks, consistent empty/error/loading states, simplified action hierarchy.

3. **Product operations automation**
   - Scheduled backups, integrity scans, anomaly alerts, and canary releases.

4. **Proactive reliability engineering**
   - Contract tests, smoke tests on critical flows, and release scorecards per deployment.

---

## 4) Bulletproof plan (no-regression operating model)

## Phase P0 (Week 1–2): Stop regressions at source

### Engineering controls

1. **Enforce DB contract checks in CI**
   - Added `scripts/check-db-contract.mjs` and `npm run check:db-contract`.
   - Fails if app references non-existent tables or schema has duplicate table definitions.

2. **Add mandatory quality workflow**
   - Added `.github/workflows/quality-gates.yml` to run:
     - DB contract check
     - Type check
     - Build check

3. **Formalize merge policy**
   - Require passing quality-gates before merging to main.

### Data controls

4. **Schema normalization sprint**
   - Resolve naming mismatches and remove duplicate `CREATE TABLE` entries.
   - Add compatibility views temporarily if renaming cannot be immediate.

### Output KPI

- 0 failing merges from contract/type/build regressions for 2 consecutive weeks.

---

## Phase P1 (Week 3–6): Stabilize high-volume user flows

1. **Critical-flow smoke suite**
   - Automate end-to-end smoke checks for: login, attendance submit, grade entry, fee payment, report export, library checkout/return.

2. **Synchronization reliability**
   - Introduce explicit sync states (`queued`, `syncing`, `failed`, `resolved`).
   - Add retry policy with exponential backoff + dead-letter queue.

3. **Observability baseline**
   - Track API error rates, sync failure rates, and top workflow completion rates.

### Output KPI

- Critical-flow pass rate >= 99% in staging and pilot schools.

---

## Phase P2 (Week 7–10): UX hardening for market adoption

1. **Shared UI primitives rollout**
   - Standardize `Modal`, `Button`, `Input`, `FormField`, `EmptyState`, `TableToolbar`.

2. **Accessibility baseline**
   - Enforce keyboard traversal + focus trap + aria labels for all modals/actions.

3. **Task-first dashboard IA**
   - Add role-specific “Top Tasks” and simplify nav grouping.

### Output KPI

- P95 time-to-complete top 5 tasks improves by >= 20%.

---

## Phase P3 (Week 11–12): Market launch guardrails

1. **Release scorecard per deploy**
   - Quality gates, smoke pass %, DB integrity checks, and rollback readiness.

2. **Canary deployment model**
   - Release to a small school subset first, monitor, then expand.

3. **Incident playbooks**
   - Define runbooks for sync failures, migration failures, and API degradations.

### Output KPI

- 4 weeks of stable canary releases with no Sev-1 regressions.

---

## 5) Immediate action backlog (next 10 business days)

1. Resolve 7 missing table references by schema migration or app query renames.
2. Remove 3 duplicate table declarations from schema.
3. Commit ESLint config and make lint non-interactive.
4. Wire quality-gates as required status checks in repository settings.
5. Add first critical smoke test pack for attendance + fees + grades.
6. Create launch readiness dashboard (build success, flow success, sync failures).

---

## 6) Definition of “Market Ready” (must all be true)

1. **Reliability:** 30 days with no critical regression in top workflows.
2. **Quality Gates:** 100% merges pass contract + type + build + smoke checks.
3. **Data Safety:** 0 unresolved schema-contract mismatches.
4. **UX:** Accessibility compliance baseline met on critical journeys.
5. **Operations:** Backup + restore + rollback tested and documented.

---

## 7) Definition of “Bulletproof” (ongoing discipline)

- Every feature must ship with:
  1. contract validation impact check,
  2. smoke-test coverage,
  3. observability events,
  4. rollback path,
  5. release note and owner.

This turns quality from a one-time cleanup into a continuous system.

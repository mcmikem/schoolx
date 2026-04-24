# SchoolX UI/UX Audit & Upgrade Plan (2026-03-28)

## Audit Goal

Evaluate current UX quality, accessibility, information architecture, and interaction consistency in the SchoolX dashboard experience, then propose concrete, staged upgrades.

## Method

- Reviewed global styling and responsive rules.
- Reviewed dashboard shell/navigation/search/notifications implementation.
- Reviewed representative feature pages (exams, notices, homework, schools, reports).
- Ran build/type checks to identify UX-affecting reliability issues.

## Current Strengths

1. **Broad feature discoverability via role-aware navigation**
   - Route lists are already segmented per role and expose many workflows directly in nav.
2. **Dense but productive dashboard workflows**
   - Many pages support in-context modals and quick actions, reducing context switching.
3. **Mobile-tailored CSS exists**
   - There are dedicated responsive blocks for smaller viewports.
4. **Keyboard support started**
   - Dashboard includes `Cmd/Ctrl + K` search shortcut and Escape close behavior.

## Key UI/UX Issues Found

## 1) Accessibility and keyboard quality are inconsistent (High)

- Several modal/panel patterns are clickable overlays without explicit dialog semantics, focus trap, or robust keyboard loop behavior.
- Many icon-only actions rely on visual affordance, but not all interactions include explicit accessible labeling.
- Focus visibility consistency depends heavily on custom styles and inline CSS patterns.

**User impact:** Keyboard and assistive-tech users may struggle to operate core workflows reliably.

## 2) Visual-system consistency is fragmented (High)

- The codebase mixes utility classes, inline styles, and bespoke style blocks extensively.
- Similar controls (buttons, labels, inputs, close actions) vary in size, color, spacing, and hover/focus behavior across pages.

**User impact:** Interface feels less predictable; increases cognitive load and lowers perceived quality.

## 3) Information density is high for first-time users (Medium)

- Dashboard navigation exposes many items at once, with badge counts and mixed hierarchy.
- Quick links/search are present but not yet task-oriented by role intent (e.g., “Start attendance”, “Record exam marks”, “Send fee reminder”).

**User impact:** New staff can take longer to find high-frequency actions.

## 4) Reliability issues degrade trust in UI flows (High)

- Production build currently fails route prerender for many dashboard pages due to `useTheme` provider-context errors.
- External font fetch warnings during build indicate network-dependent visual loading behavior.

**User impact:** UI can be fragile in production/release flows and less stable across environments.

## 5) Feedback and empty-state patterns are uneven (Medium)

- Some screens provide excellent toasts/modals; others are table-heavy with minimal progressive feedback.
- Empty, loading, and error states are not standardized across modules.

**User impact:** Inconsistent confidence when actions succeed/fail or data is unavailable.

## Recommended Upgrades (Prioritized)

## P0 — Must-do (next 1–2 sprints)

1. **Create a baseline accessibility standard for all interactive surfaces**
   - Standardize dialog behavior: `role="dialog"`, `aria-modal`, labelled title, focus trap, Escape close, focus return.
   - Ensure icon-only buttons have accessible names everywhere.
   - Add consistent `:focus-visible` styles globally.

2. **Ship a shared UI primitives layer**
   - Introduce canonical components (`Button`, `Input`, `Select`, `Modal`, `PageHeader`, `EmptyState`, `DataTableToolbar`).
   - Replace ad hoc inline styles in high-traffic pages first (attendance, grades, fees, exams).

3. **Fix theme-provider/render reliability before new feature work**
   - Resolve `useTheme` context failures in prerender/build paths.
   - Decide which routes are dynamic vs static and annotate explicitly.

## P1 — High-value improvements (2–4 sprints)

4. **Rework dashboard IA for task-first navigation**
   - Group nav by jobs-to-be-done (Teaching, Finance, Student Affairs, Administration).
   - Add “Top tasks” cards per role on dashboard landing.

5. **Standardize state design tokens**
   - Define tokens for success/warning/error/info, disabled, hover, focus, and semantic surfaces.
   - Enforce contrast thresholds and dark/light parity.

6. **Improve form UX quality**
   - Add field-level validation text, input examples, and autosave indicators where appropriate.
   - Normalize spacing, label placement, and required/optional markers.

## P2 — UX polish and scalability

7. **Introduce motion & feedback guidelines**
   - Add subtle motion for transitions and async feedback with reduced-motion support.

8. **Add UX telemetry**
   - Track search usage, zero-result searches, form abandonment, and high-error flows.
   - Use metrics to prioritize next UX fixes.

9. **Build a lightweight design system reference**
   - One internal page documenting components, spacing rules, typography scale, and examples.

## Quick Wins You Can Implement This Week

1. Add global, accessible focus ring styles for all primary interactive elements.
2. Add a reusable `ModalShell` component and migrate 2–3 busiest modals first.
3. Add standardized empty-state component with CTA and recovery actions.
4. Convert external font loading to `next/font` or local fallback stack.
5. Introduce a compact “Top tasks” module on dashboard home for each role.

## Suggested KPI Targets

- **Task completion time:** -20% for common tasks (attendance entry, fee posting, report export).
- **Error recovery:** +30% faster user recovery from failed actions.
- **Keyboard usability:** 100% of critical workflows navigable without mouse.
- **UI consistency:** 80%+ of pages migrated to shared primitives.

## Proposed Execution Sequence

1. Accessibility baseline + modal standardization (P0)
2. Shared primitives + top 5 page migrations (P0/P1)
3. Nav IA improvements and role task shortcuts (P1)
4. Design tokens + telemetry loop (P1/P2)
5. Ongoing polish and system adoption (P2)

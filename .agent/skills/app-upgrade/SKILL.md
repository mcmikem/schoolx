---
name: app-upgrade
description: Upgrade an existing application end to end. Use when the user wants a full app upgrade, modernization, hardening, or a repo-wide improvement plan covering architecture, security, UX, performance, testing, and release readiness.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# App Upgrade

Upgrade the app in phases. Do not treat route count or UI breadth as proof of maturity. Start by finding the bottleneck that most limits production readiness, then sequence work so each phase leaves the repo in a stronger releasable state.

## Workflow

1. Baseline the repo.
   - Read `README.md`, `package.json`, route structure, top-level docs, and the biggest feature files.
   - Run the fastest relevant validation first: tests, lint, build, typecheck, or targeted smoke checks.
   - Identify whether the app is primarily blocked by architecture, security, product coherence, or release hygiene.

2. Score the app across these axes:
   - Product clarity
   - Information architecture
   - Domain model depth
   - Security and tenancy
   - Data integrity
   - Performance
   - Accessibility
   - Test coverage
   - Operational readiness
   - Maintainability

3. Compare visible breadth against backend depth.
   - Count major screens, APIs, migrations, and tests.
   - Check whether critical workflows are enforced in backend boundaries or only implied in UI state.
   - Flag modules that are mostly demo-backed, placeholder-heavy, or monolithic.

4. Build an upgrade plan in this order unless the repo clearly demands a different order:
   - Trust boundaries and authz
   - Data model and migrations
   - Core workflow correctness
   - Structural refactors for the worst files
   - UX consistency and not-found/error states
   - Performance and offline behavior
   - Test expansion and release gates

5. Execute in slices.
   - Prefer one complete vertical improvement at a time.
   - For each slice: fix code, add tests, run validation, record residual risk.
   - Avoid broad rewrites until the trust boundary and data flows are stable.

## Heuristics

- A giant page file usually means domain logic is in the wrong layer.
- Mock or demo infrastructure in production paths is a release risk.
- A security helper is not a security model.
- A modern UI does not outweigh weak data ownership or weak tenancy checks.
- If the app has many routes but few durable backend workflows, optimize depth before adding features.

## Deliverables

Produce these outputs when asked for a full upgrade:

- An executive verdict
- Ranked findings with file references
- A phased upgrade roadmap
- The first implementation slice to tackle immediately
- Validation results and known gaps

## For This Repo

If working inside the Omuto / SkoolMate codebase, read `repo-upgrade-map.md` before proposing the roadmap.

# EGM Application Rating

**Application:** Omuto / SchoolX / SkoolMate OS repository  

## Local verification

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run test:regression` — passed: 164 tests.

These checks support code health, but they do not resolve the documented migration, authorization, storage, billing, or operational-readiness risks.

## Overall rating: 4.8/10

This is a feature-rich, actively tested application with meaningful Uganda-specific domain work, offline infrastructure, RLS intent, payment-ledger centralization, and release tooling. The score is held down by production-boundary risks and documentation drift, not by lack of features.

| Area | Score |
|---|---:|
| Architectural simplicity | 5.5/10 |
| Comprehension and onboarding | 5/10 |
| Architecture, security, scalability | 5/10 |
| Structure and documentation | 5/10 |
| Claim precision | 4/10 |
| Implementation/release readiness | 4/10 |
| Codebase fidelity | 4.5/10 |

## Critical blockers

1. Remove or rotate publicly documented demo credentials and make the demo flow explicitly isolated.
2. Make student photo storage private and use scoped signed access.
3. Validate a clean database bootstrap and define one authoritative migration/seed path.
4. Correct the README's mobile-money provider configuration and subscription plan matrix.
5. Make billing activation and webhook processing transactionally idempotent.
6. Restrict generic service-role sync updates with per-table field allowlists and final-state tenant validation.

## Major risks

- Broad ERP-like scope without a declared core workflow.
- Competing academic, fee, timetable, and billing models.
- Offline storage of sensitive data and retained queues on shared devices.
- In-memory rate limits in horizontally scaled deployments.
- Non-transactional registration provisioning and synchronous bulk SMS.
- Broad or migration-dependent RLS policies for sensitive domains.
- Deployment without migration verification, full CI gating, or real-backend staging evidence.
- Missing backup, restore, retention, RTO/RPO, and provider-outage runbooks.
- README claims that are stale or uncalibrated: real-time updates, offline coverage, UNEB support, plan entitlements, product identity, and testing commands.

## What is working in the evidence

- Clear Uganda-focused product direction.
- Substantial implementation across the advertised domains.
- Offline caching, queued writes, retries, conflict handling, and cache warming exist.
- RLS, CSRF, security headers, session timeout, secret scanning, regression tests, schema checks, and smoke tooling show deliberate quality work.
- Broad unit, regression, authentication, E2E, and offline test inventory.

## Recommended order of work

### P0 — before broad production use

- Remove credentials and close public student-photo exposure.
- Verify clean schema bootstrap and canonical migration/seed process.
- Audit service-role sync, RLS, role combinations, and sensitive storage with cross-tenant tests.
- Make payment/webhook state transitions atomic and amount-checked.

### P1 — before scale

- Replace process-local rate limiting with distributed atomic limits.
- Bind/encrypt/minimize offline queues and sensitive local data.
- Convert registration provisioning to durable, observable steps.
- Move bulk SMS to durable asynchronous jobs.
- Add real-backend staging tests and migration checks to deployment gates.

### P2 — reduce maintenance cost

- Pick canonical domain models and retire compatibility paths.
- Separate core school workflows from optional ERP modules.
- Define one product name and one billing vocabulary.

## Documentation repair list

- Replace the stale plan table with generated/current billing data or link to the pricing source.
- Correct mobile-money provider variables and demo instructions.
- Document Supabase setup, migrations, seeds, onboarding, role workflows, offline boundaries, and release gates.
- Add architecture, security/RLS, offline-sync, billing, and operations runbooks.
- Link README claims to source contracts and verified test commands.

## Applicability of the other EGM skills

- `egm-drift-report`: applicable in principle, but no dedicated design-document directory was supplied; this review's code/document mismatches are recorded above.
- `egm-review-loop`: not run as a repair loop because the user asked for a rating, not automated document edits; no fixes were applied.
- `egm-resolve`: not run because there was no user approval to edit findings or target documents.
- `egm-brainstorm` and `egm-draft`: not applicable to rating an existing app; they require a feature concept, clarification turns, and human approval gates before delegation.
- `egm-bootstrap`: not run because it creates or modifies README contracts rather than rating the app, and it requires a separate scope/safety approval for large trees.

## Final disposition

**Controlled pilot:** plausible after addressing the critical security and database issues.  

# EGM Codebase-Details App Review

**Target:** `/Users/me/schoolx-git/README.md`  

## Dimension scores

| Dimension | Score |
|---|---:|
| Codebase fidelity | 6/10 |
| Testability | 7/10 |
| Documentation consistency | 3/10 |

## Blockers

- Demo phone/password do not match the demo API's accepted normalized numbers, configured password, and development flags.
- README documents Flutterwave mobile-money variables, while inspected implementation uses MoneyUnify and direct MTN MoMo variables.
- Subscription table is materially stale: names, limits, offline entitlement, parent portal, and SMS behavior differ from canonical billing configuration.

## Major findings

- README says `idb`, but the implementation uses native IndexedDB and no `idb` dependency is listed.
- Testing instructions omit typecheck, regression, auth, E2E, offline, schema, production-leakage, secret, and release checks.
- Feature names are not mapped to route groups, APIs, role restrictions, subscription restrictions, or online-only boundaries.
- Runtime environment documentation omits important actual variables and setup conditions.
- Project structure is only a partial sketch.

## Positive evidence

The core advertised domains are represented in code, offline functionality is substantial, and the repository contains broad unit, regression, E2E, and migration-related test infrastructure.

# EGM Design-Critic App Review

**Target:** `/Users/me/schoolx-git/README.md` and production implementation  

## Dimension scores

| Dimension | Score |
|---|---:|
| Architecture | 6/10 |
| Scalability | 4/10 |
| Security | 4/10 |
| Operational risk | 4/10 |

## Blockers

- Demo credentials are published in the README.
- Student-photo storage is public and has broad bucket policies.

## Major risks

- Generic service-role sync can accept protected client-controlled fields.
- Billing activation and webhook processing lack clearly atomic, retry-safe state transitions.
- Mobile-money activation does not visibly compare verified amount with the ledger amount.
- Protected shells can pass through when a session exists but verification fails.
- Schema/RLS behavior depends heavily on a large migration history and contradictory canonical SQL.
- Sensitive offline data and retained sync queues can remain on shared devices after logout.
- In-memory rate limiting does not protect consistently across serverless instances.
- Registration is a long, partially non-transactional provisioning workflow.
- Bulk SMS is synchronous and can exceed request budgets.
- Financial offline mutations are generic and can split across calls.
- Broad staff policies risk overexposure of finance, payroll, health, and academic data.
- Backup, restore, retention, RTO/RPO, monitoring, and provider-outage procedures are undocumented.

## Release conclusion

Suitable for a controlled pilot after remediation; not low-risk for broad production use with sensitive pupil and financial data.

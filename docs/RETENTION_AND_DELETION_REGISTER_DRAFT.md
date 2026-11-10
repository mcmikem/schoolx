# SkoolMate Retention and Deletion Register — Draft

**Status:** Data-category inventory and decision worksheet; not an approved retention schedule
**Basis:** Repository schema and product workflows inspected 9 November 2026
**Rule:** No duration below is assumed. The school/privacy owner and Ugandan counsel must approve the purpose, lawful basis, retention trigger, period, backup expiry, and deletion method before this becomes policy or product behavior.

| Record family | Schema examples | School purpose to confirm | Retention trigger and period | Deletion/return and evidence | Decision owner |
| --- | --- | --- | --- | --- | --- |
| School/account identity | `schools`, `users`, `school_settings` | Service delivery, access control, school administration | **Not set.** Define school closure, contract termination, and account-closure triggers. | Disable access; return/export school records; delete or de-identify account data after approved hold and backup expiry. Record export/deletion receipt. | SkoolMate privacy lead + school owner |
| Learner identity and admissions | `students`, `parent_students`, `student_promotions`, `uneb_candidates` | Admission, enrolment, progression, statutory/national reporting | **Not set.** Define exit/transfer/graduation triggers and any education-record retention basis. | Correct/export to authorised school; soft-delete is not final deletion. Define hard-delete/anonymisation and orphan-link cleanup. | School controller + counsel |
| Parent/guardian contact | `parent_students`, parent contact columns in `students`, parent portal profiles | School communication, learner relationship, portal access | **Not set.** Define when a guardian relationship ends and how disputes/custody changes are handled. | Revoke relationship/portal access promptly; retain only approved evidence; verify all contact copies and message-provider copies. | School safeguarding/privacy owner |
| Attendance and staff attendance | `attendance`, `staff_attendance`, `dorm_attendance` | Attendance register, safeguarding, operational reporting | **Not set.** Set by record type, academic cycle, legal obligation, and dispute/hold requirement. | Preserve approved register exports; delete or de-identify on schedule, including cached and exported copies where feasible. | School records owner + counsel |
| Marks, exams, reports, curriculum progress | `grades`, `exam_scores`, `report_cards`, `topic_coverage`, `scheme_of_work`, `lesson_plans`, `syllabus` | Assessment, reporting, teaching and learning continuity | **Not set.** Define by record class, finalisation date, appeal period, and national examination rules confirmed by the school. | Preserve authorised final reports; remove drafts/duplicates as approved; record template/calculation version needed to interpret retained results. | Academic lead + school owner |
| Fees, receipts, and balances | `fee_structure`, `fee_payments`, `payment_plans`, `payment_plan_installments`, `expenses`, `budgets`, `budget_items` | Billing, reconciliation, accounting, audit | **Not set.** Finance owner/counsel must identify applicable accounting, tax, limitation, and audit requirements. | Never treat soft delete as erasure; retain required ledger evidence, restrict access, and remove excess copies after approved period. | Bursar + school finance owner + counsel |
| Health and safeguarding | `health_records`, `health_visits`, `behavior_logs` | Learner care and safeguarding | **Not set; high sensitivity.** Confirm strict need, authorised roles, legal basis, and retention separately for each data type. | Restrict access; preserve only required case evidence; securely delete, verify replicas/backups, and document exceptions/holds. | School safeguarding lead + privacy lead + counsel |
| Communications and notices | `messages`, `notices`, SMS/email delivery and provider logs | School-parent communication, notices, delivery evidence | **Not set.** Decide message content, attachments, delivery metadata, and proof-of-notice periods separately. | Delete content/attachments under schedule; retain only minimal delivery evidence as approved; request provider expiry where available. | School communications owner + privacy lead |
| Events and timetable | `events`, `teacher_timetable`, `academic_years`, `terms` | Scheduling, notices, historical school operations | **Not set.** Decide whether historical calendar records are needed after each school year. | Export required archive; remove personal assignments and contact data when no longer needed. | School administrator |
| Staff, payroll, and leave | `users`, `payroll_history`, `leave_requests`, `leave_approvals` | Employment, payroll, attendance and HR | **Not set.** Separate employment, payroll, leave, authentication, and audit retention; confirm applicable requirements. | Revoke account access on exit; preserve only required HR/finance records; delete credentials and excess profile data. | School HR owner + counsel |
| Device, diagnostic, and security records | `audit_log`, `error_logs`, app events, authentication and cloud logs | Security, troubleshooting, fraud prevention, audit | **Not set.** Set short operational defaults and longer incident/legal-hold exception handling. | Limit log payloads; redact identifiers where possible; expire logs; preserve incident evidence in restricted case storage. | Security lead + privacy lead |
| Offline and export copies | IndexedDB/cache, queued writes, downloaded reports, CSV/PDF files, device backups | Enable approved offline work and school reporting | **Not set.** Set maximum offline age, shared-device cleanup, export expiry, and user removal behavior. | Clear on account/school change and sign-out; handle lost devices; provide cache purge and queue ownership controls; include signed-out copies in school procedures. | Product/security lead + school owner |
| Privacy requests and agreement evidence | `privacy_requests`, `school_agreement_acceptances` | Demonstrate response handling and accepted document version | **Not set.** Decide close date, limitation/complaint hold, agreement lifecycle, and who may access evidence. | Restrict access; delete details after approved evidence window; retain only minimum version/acceptance record where required. | Privacy lead + counsel |
| Backups, replicas, and provider copies | Supabase backups, Cloudflare/provider logs, email/SMS/payment providers | Disaster recovery, security, service delivery | **Not set.** Obtain each provider’s actual backup/log expiry and contractual deletion timing. | Record provider deletion/return route and expiry evidence; define how restoration reapplies deletion requests. | Technical owner + procurement + privacy lead |

## Required approval for every row

For each record family, complete these fields in the approved controlled copy:

1. Named school and SkoolMate owner; controller/processor role for this processing.
2. Specific purpose, data fields, affected people, and lawful basis/notice evidence.
3. Retention start event, exact approved period, review date, and legal-hold exception owner.
4. Active-system deletion, soft-delete behavior, backup/replica expiry, provider deletion, export and offline-copy handling.
5. Verification evidence: query/report or deletion certificate, reviewer, date, and any records lawfully retained.

## Immediate implementation questions

- Which tables currently use soft deletion, and which purge jobs permanently delete records?
- What is the actual Supabase backup retention and how are deletion requests handled after restore?
- Can schools export their records before closure, and can SkoolMate verify export and final purge without retaining another copy?
- Which offline tables can remain on a shared device and for how long? How are old service-worker caches and exported PDFs removed?
- Are payment and statutory education records retained under school instructions, independent legal obligations, or both?

Do not put retention durations into UI, privacy notices, automated deletion jobs, or contracts until the accountable owners approve the schedule and verify that the system can carry it out.

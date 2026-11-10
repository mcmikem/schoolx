# SkoolMate Personal Data Incident Runbook

**Status:** Operational draft; owner and legal review required before adoption
**Applies to:** SkoolMate production services, support systems, and school data processed through them
**Primary record:** Create a restricted incident record; do not put learner identifiers or evidence in public tickets or chat.

## Purpose and response rule

Use this runbook when there is a suspected or confirmed loss, alteration, unauthorised disclosure, or unauthorised access to personal data. This includes learner records, parent contacts, staff records, attendance, grades, health or safeguarding notes, credentials, payment information, exports, backups, and offline devices.

Contain the exposure, preserve evidence, and notify the accountable privacy lead immediately. Do not wait for certainty before escalating internally. Do not promise that an incident is legally reportable or not reportable until the controller/processor roles and facts have been reviewed.

## Response owners

| Role | Responsibility |
| --- | --- |
| Incident lead (on-call engineering lead) | Opens incident record, coordinates response, keeps timeline, assigns tasks, and declares recovery. |
| Privacy lead / DPO contact | Assesses controller/processor duties, coordinates school and regulator contact, and tracks required notices. |
| Security/engineering lead | Contains access, preserves logs, investigates scope, validates fixes, and restores service safely. |
| School relationship owner | Contacts affected school through approved channels and coordinates its response. |
| Communications owner | Prepares approved staff, parent, and public messages; only sends after privacy lead approval. |
| Legal adviser / executive sponsor | Reviews significant incidents, statutory interpretation, external statements, and business decisions. |

Names, backups, phone numbers, escalation channel, and out-of-hours contact method must be maintained in the restricted on-call directory. This runbook is incomplete until the named rota is tested.

## First response checklist

1. **Open a restricted incident record.** Assign an incident ID and record reporter, detection time, affected service, first known facts, and current owner.
2. **Escalate immediately.** Notify the incident lead and privacy lead. If learner data, credentials, financial data, safeguarding information, or cross-school access may be involved, page the security lead and executive sponsor.
3. **Preserve evidence.** Record timestamps with timezone; preserve relevant application, database, authentication, cloud, support, and device logs. Export evidence to access-controlled storage, record who collected it, and calculate hashes when practical. Do not edit source logs.
4. **Contain safely.** Revoke exposed tokens or sessions, disable compromised accounts or integrations, restrict affected endpoints/exports, rotate secrets, or isolate a device as appropriate. Prefer reversible steps that do not destroy evidence. Record each action and time.
5. **Protect people.** If a child may face immediate physical or safeguarding risk, follow the school safeguarding escalation path and contact emergency authorities through the responsible school lead.
6. **Keep one timeline.** Record each decision, evidence item, containment action, system change, and notification, including the decision owner and reason.

## Triage and scope

Determine and record:

- What happened, when it began, when it was detected, and whether it is continuing.
- Which systems, schools, data types, records, users, and approximate numbers of people are involved.
- Whether the data was accessed, acquired, changed, deleted, exposed publicly, or only at risk; distinguish confirmed facts from assumptions.
- Whether the incident crossed school or account boundaries, involved a child, or included credentials, payment, health, disability, safeguarding, or other sensitive information.
- Which party decided the purpose and means of the affected processing, who acted as controller/processor for this dataset, and what the signed agreement requires.
- Whether backups, exports, offline queues, staff devices, third-party providers, or support tools contain additional copies.
- Likely consequences, people at risk, and immediate steps they can take to protect themselves.

Use a conservative working scope while evidence is incomplete. Keep the original scope and each later revision in the incident record.

## Uganda notification assessment

The Data Protection and Privacy Act, 2019, section 23 and the Data Protection and Privacy Regulations, 2021, regulation 33 describe notification to the Personal Data Protection Office (PDPO) when a data collector, processor, or controller believes personal data was accessed or acquired by an unauthorised person. Regulation 33 says notification is made **immediately** and lists the breach nature, affected data, categories and approximate number of people, likely consequences, remedial actions, and a DPO/contact person as information to include.

The privacy lead must promptly verify the current prescribed method/form and the applicable legal roles for the incident, then coordinate notification with the responsible organisation. Do not substitute a 72-hour assumption. Record the belief/threshold decision, its time, the decision maker, contact with the PDPO, submission receipt, and any follow-up. The Act provides for the Authority to determine whether affected data subjects should be notified; follow the current PDPO direction and obtain legal advice on any additional obligation.

For a processor acting for a school, notify the school/controller without delay under the signed agreement and provide facts needed for its assessment. For data SkoolMate controls independently, the privacy lead must assess SkoolMate's direct obligations. Do not assume every school dataset has the same role allocation.

## Recovery and closure

Before restoring normal access:

- Confirm the cause is removed or contained and credentials/secrets are rotated where needed.
- Validate tenant boundaries and affected workflows with isolated test accounts; retain the test evidence.
- Confirm data integrity, backups, queued offline writes, and any recovered/deleted records with the school owner.
- Monitor for recurrence and suspicious access for a period set by the incident lead.
- Complete required regulator, school, provider, and affected-person follow-up; retain receipts and approved messages.
- Hold a blameless review. Record root cause, contributing conditions, impact, response timeline, missed controls, corrective actions, owners, due dates, and evidence of completion.
- Update the data inventory, provider schedule, risk register, retention/deletion records, and this runbook where the incident reveals a gap.

Close only when the privacy lead and incident lead agree that containment, notifications, recovery, evidence preservation, and corrective actions have owners. Track long-term improvements to completion after incident closure.

## Tabletop exercise

Run at least one tabletop before adopting this draft and after material changes to the on-call path. Scenario: a staff account downloads a learner export and the file is shared to the wrong school WhatsApp group. The exercise must test detection, account/session revocation, scope and recipient confirmation, school escalation, PDPO decision path, evidence preservation, parent communication approval, and follow-up ownership. Record elapsed times, decisions, gaps, and actions. Do not use real learner information in the exercise.

## Authoritative references

- [Uganda Data Protection and Privacy Act, 2019 (Ministry of ICT and National Guidance copy)](https://ict.go.ug/ims/public/site/documents/Data-Protection-and-Privacy-Act-2019.pdf)
- [Data Protection and Privacy Regulations, 2021 (PDPO official copy)](https://pdpo.go.ug/media/2022/03/Data_Protection_and_Privacy_Regulations-2021.pdf)
- [PDPO official site and breach reporting entry point](https://pdpo.go.ug/)

This document is an operational draft, not a legal opinion. The privacy lead and Ugandan counsel must validate the current form, contacts, allocation of controller/processor roles, contracts, and organisation-specific response commitments before it is adopted.

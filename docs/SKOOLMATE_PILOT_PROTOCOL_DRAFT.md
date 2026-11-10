# SkoolMate school pilot protocol — draft

**Status:** Preparation template; not approval to collect pilot data. A school lead, SkoolMate owner, and privacy lead must review it before sessions are scheduled. Use synthetic learner records unless the school and privacy lead approve a documented lawful basis and participant notice for real records.

## Purpose

Check whether core SkoolMate tasks are accurate, understandable, and dependable in the conditions schools actually face. This pilot is a product-quality exercise, not a study that proves SkoolMate improves learning outcomes or a substitute for Ministry approval.

## Readiness gate

Complete these fields before inviting anyone:

| Item | Assigned owner | Status / evidence |
|---|---|---|
| Participating school and written permission | School head | ____________________ |
| Pilot dates, venue, and school timetable constraints | School coordinator | ____________________ |
| Product build/version and test tenant | SkoolMate lead | ____________________ |
| Privacy notice, consent/permission approach, and retention date | Privacy lead | ____________________ |
| Participant information sheet and voluntary participation confirmation | Session lead | ____________________ |
| Synthetic or approved test accounts; no shared production passwords | Technical lead | ____________________ |
| Android model/version, available storage, and network plan | Field lead | ____________________ |
| Support contact and stop-session/escalation path | School + SkoolMate leads | ____________________ |
| Open high-severity defects reviewed before sessions | QA lead | ____________________ |

Do not record pupil names, phone numbers, marks, medical details, or screen video unless the privacy lead has approved the purpose, access, security, retention, and participant notice. Do not use children's data just to make the demo realistic.

## Participants and sessions

Invite one or more representatives in each role: teacher, headteacher/school administrator, bursar, and parent. Record role and experience level, not unnecessary personal details. Participation is voluntary; tell participants they may stop without penalty. Do not ask a parent to expose another family's records.

Allow 30–45 minutes per role. Start with the same short orientation, then ask the participant to complete tasks without coaching. If help is needed, record the point where it was needed and continue; do not treat the session as an exam.

## Task scenarios

Use an isolated test school with synthetic records and a prepared setup checklist.

| Role | Scenario | Record |
|---|---|---|
| Teacher | Sign in, find today's assigned class, take attendance, correct one mistaken entry, review timetable, and queue a grade while offline | Completion, elapsed time, mis-taps, unclear labels, saved/sync state |
| Headteacher | Find attendance summary, create a class-only event, delegate its owner, review a report card, and locate a privacy request | Scope errors, approval clarity, missing information, elapsed time |
| Bursar | Find a learner, record a payment online, record a separate offline payment intent, reconnect, and confirm its sync state and totals | Duplicate prevention, pending-vs-confirmed display, balance accuracy, receipt clarity |
| Parent | Switch between linked children, find attendance and a result, understand a balance, open a notice, and contact the school | Child context, comprehension, readability, navigation, unresolved questions |

## Offline/device scenarios

On a supported Android phone, record model, Android version, browser/PWA version, free storage, and network type. Run each offline case with synthetic data:

1. Load the app online, select/download an assigned class, and note the displayed cache time.
2. Close the app, turn on airplane mode, relaunch from the installed PWA, and open the selected roster.
3. Take attendance and make one supported offline edit; verify the pending row and queue survive a force-close and restart.
4. Reconnect on a weak or metered connection; confirm the same record syncs once and receives a visible server-confirmed state.
5. Replay the same queue item after an interrupted response; confirm no duplicate attendance, grade, or payment.
6. Sign out, sign in as a different test user/school, and verify the prior user's private cache and queue are not visible.

Record exact observed behavior, timestamps, screenshots only if approved, and any lost, duplicated, or mis-scoped data. A claimed offline task fails if it only works after an online page load when the capability matrix promises a cold offline start.

## Measures

For each task record: completed (yes/no/with help), elapsed time, incorrect action count, points where the participant hesitated, error messages, task confidence (1–5), and exact participant quote only when the participant agrees. For offline data, separately record saved-on-device, queued, server-confirmed, conflict, and failed states. Never interpret attendance completion or click counts as proof of learning gains.

## Issue log

Create one row per issue. Keep personal data out of reproduction notes.

| ID | Role/task | Reproduction using synthetic data | Severity | Impact | Owner | Fix target | Retest result/date |
|---|---|---|---|---|---|---|---|
| PILOT-001 |  |  |  |  |  |  |  |

Severity guide: **Critical** data loss, cross-school exposure, or false financial settlement; **High** a core role cannot complete a task or a record is wrong; **Medium** workaround exists but task is confusing or slow; **Low** cosmetic or preference issue.

## Exit criteria

- No unresolved critical/high issue affects attendance, learner privacy, payment settlement, school/class scoping, or offline queue integrity.
- Every recorded issue has an owner, a severity, a reproducible scenario, and a retest result or an explicitly accepted follow-up date.
- The school receives a short findings summary that distinguishes observed usability from measured educational outcomes.
- The privacy lead confirms pilot notes and any recordings are deleted or retained only under the approved schedule.
- The school head decides whether to continue, pause, or expand the pilot; SkoolMate records that decision and its conditions.

## Session closeout

School: ____________________  Date: ____________________  Build: ____________________

School lead: ____________________  SkoolMate lead: ____________________  Privacy lead: ____________________

Decision and conditions: ______________________________________________________________

Open high-severity issues: ____________________________________________________________

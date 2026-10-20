# Ground-usability audit: 50 real school scenarios

## Scope and evidence

This is an execution ledger, not a claim that 50 workflows pass. IDs match the 50 scenarios proposed to the user. No production write tests, real SMS sends, remote migrations, or real payment-provider transactions are authorized by this ledger.

- **Partial:** a narrow part passed demo/UI checks; the full acceptance criteria remain open.
- **Open:** not yet executed end to end; a page or code path is not proof of success.
- **Fail:** a reproduced defect remains unresolved.
- **Code risk:** inspection found an unsafe/incomplete path; production behavior has not been tested.
- Current repeatable checks: `tests/e2e/ground-usability.spec.ts`, `tests/e2e/common-page-workflows.spec.ts`, `tests/e2e/role-workspace-upgrade.spec.ts`, and `tests/e2e/upgrade-visual-audit.spec.ts`.
- Ground-usability checks block database REST mutations and attach attempted write paths without payloads. They do not prove server-side permissions or database persistence. The initial report arithmetic expected failure has now become a normal regression test for the repaired numerical list and printed report.
- Use a separate school/database for write, retry, concurrency, offline replay, and cross-tenant tests. Some older browser suites target the configured live project; do not run those indiscriminately.

## Findings and repairs from the first execution batch

### G01 — blank mobile-money references (reproduced, repaired)

The form treated spaces as a transaction ID. A new unit test first failed because Record was enabled. Trim validation now blocks this in the form and its submit handler; meaningful references are trimmed before provider-prefix formatting. This does not verify a transaction with MTN/Airtel.

### G02 — overpayment acknowledgement moves under a click (reproduced, repaired)

The phone browser check could not reliably tick credit acknowledgement: blurring the amount inserted an error above the checkbox and moved the target. Show the overpayment error immediately, before blur, so the explanation and target are stable before the bursar interacts. A unit test and phone pointer test cover it. Saving/allocating a credit in the database is still unverified.

### G03 — demo report generation reaches persistence (code-confirmed, guarded)

Report generation previously called its persistence function even in demo mode. Persistence now returns before constructing or writing payloads in demo mode, including before offline queueing. Single-class and batch generation explicitly say demo previews do not save school records. A separate browser check asserts that demo generation attempts no database REST mutations.

### G04 — report totals/averages disagree (reproduced; numerical list repair implemented)

Initial demo-generated numerical reports displayed averages above 100%. The generator summed raw assessment marks and used the first recorded student's subject count as its denominator. The repaired numerical list derives subject values from the existing printed-report bucket calculation, normalizes recorded maxima, uses each student's recorded subject count, and retains zero as distinct from unknown. Invalid scores/maxima make the subject unknown instead of being clamped. Incomplete reports show provisional averages, no position, neutral comments and no official persistence or result SMS. Completed reports use existing internal primary/O-level aggregate helpers; the printed primary summary uses the same division/aggregate as the list. Nursery/A-level are not given a fabricated primary division.

This is not a grading-policy migration: the existing printed bucket weighting was preserved, not replaced with new assumed weights. CBC, the separate reports API, grade-entry final-score storage, class subject-allocation completeness, and formal examination certification still need cross-module policy reconciliation. S19 remains only partially signed off until those are verified with real class fixtures.

### G05 — more demo/live boundaries require review (code risk, OPEN)

The attendance save handler, expense approvals, and `useMoney` contain live database request paths without an equivalent early demo-only write guard in the inspected paths. This does not establish that RLS permits a write. Those save/approve actions were not exercised against production. Isolate fixtures from shared offline caches and prevent demo actions entering replay queues before broader demo mutation tests.

## Acceptance ledger

| ID | Real task | Required acceptance evidence | Current status |
| --- | --- | --- | --- |
| S01 | Find a pupil while parents queue | Disambiguate names/class/number; require selecting a result; keyboard and touch work on a large roster | Partial: name/no-match/keyboard checks |
| S02 | Enter yesterday's receipt today | Date survives save, reload, receipt and date-filtered totals | Partial: date validation/back navigation and earlier demo receipt check |
| S03 | Partial payment or excess credit | Exact remaining balance/credit agrees after save/reload across ledger and account | Partial: invalid amounts, balance preview and credit acknowledgement; G02 repaired |
| S04 | Sibling or split-channel payment | Allocations and channel receipts reconcile with one actual amount received | Open: only nonblank mobile-money reference validation tested; G01 repaired |
| S05 | Retry after an uncertain save | One financial transaction and one receipt under retries and concurrent submissions | Open: needs isolated database and fault injection |
| S06 | Day/boarding/annual transport charges | Applicable charges included once for the correct term/year/student type | Partial: fee metadata form tests only |
| S07 | Opening debt, scholarship and instalments | Adjustments explain the final balance and do not erase original history | Open |
| S08 | Retrieve a disputed receipt | Correct details, reprint, correction lineage and account linkage | Partial: ledger details open; reprint/correction unverified |
| S09 | Close and reconcile the day | Cash/MoMo/bank totals match received dates, spend and reconciliation entries | Open |
| S10 | Reconcile 1,500-student financial totals | Full-roster totals agree with ledger/export beyond request/page limits | Open: explicitly not signed off |
| S11 | Open today's correct teaching class | Assigned classes/subjects only; fast search and correct attendance/grades destinations | Partial: dashboard class search and shortcuts |
| S12 | Mark 80 pupils with five exceptions | Bulk present plus absent/late edits save and reload exactly | Open: live demo save boundary must be isolated first |
| S13 | Correct historical attendance | Date is obvious; old record is updated once with change attribution | Open |
| S14 | Lose network during attendance | Durable local status, explicit pending sync, safe replay and conflict recovery | Open: isolated offline replay needed |
| S15 | New teacher has no assignments | Honest waiting state and administrator can complete the assignment | Open: code state exists; full resolution untested |
| S16 | Enter marks with blanks and zeroes | Zero is retained; missing remains unknown; invalid maxima are rejected | Open: bounds and persistence fixtures needed |
| S17 | Resume a half-entered class elsewhere | Saved progress survives; unsaved work is clearly distinguished | Open |
| S18 | Submit, review, return and lock marks | Teacher/dean/headmaster handoff and lock enforcement work server-side | Open |
| S19 | Generate trustworthy marks and divisions | Correct normalized scores, missing-data policy, ranking and reconciled print/export | Partial: numerical and CBC list/print calculations repaired; API/export/policy reconciliation and isolated live persistence remain open |
| S20 | Find/edit generated report cards | Search/reset keeps roster unchanged; comments persist; official save is explicit | Partial: earlier UI tests; demo no-write guard G03 added |
| S21 | Admit a new student | Required fields, duplicate handling, class assignment and persisted confirmation | Open |
| S22 | Import 500 imperfect spreadsheet rows | Preview errors, preserve successes, reconcile counts and retry without duplicates | Open |
| S23 | Search/filter registry and recover no matches | Search, gender/class filters, reset and keyboard focus work on phones | Partial: common-page browser checks |
| S24 | Transfer class/school with a fee balance | Preserve attendance/marks/payments; consistent transfer statuses and history | Open |
| S25 | Promote and roll over the school year | Preview, repeaters/leavers, historical preservation and repeat-run safety | Open |
| S26 | Headmaster identifies urgent work | Accurate/fresh exceptions with relevant drill-downs and clear priorities | Partial: dashboard rendering/actions, not live data correctness |
| S27 | Approve/reject an expense | Context, permission, one decision, attribution and status across both roles | Code risk: G05; no production approval attempted |
| S28 | Investigate a vulnerable pupil | Trace a warning to evidence, contact and recorded follow-up | Open |
| S29 | Print all class reports | Accurate filtering, pagination, signatures, long names and real printer output | Open: report accuracy blocker S19 applies |
| S30 | Prepare an inspection/MOES/UNEB return | Source counts reconcile; required missing fields are explained | Open |
| S31 | Notify a parent about absence | Confirmed register, correct pupil/date/guardian and no duplicate alert | Open: use an SMS sandbox |
| S32 | Send fee reminders only to debtors | Preview recipients/amounts; exclude newly paid accounts; safe authorization | Open |
| S33 | Send a class-only announcement | Confirm exact audience/count before sending; no school-wide leakage | Open |
| S34 | Recover a failed SMS | Queued/sent/delivered/failed are distinct; safe targeted retry | Open: use an SMS sandbox |
| S35 | Parent switches between children | Clear child context; unrelated records inaccessible including direct links | Open |
| S36 | One person holds multiple roles | Additive authorized access without globally widening a job role | Open: needs real multi-role sessions |
| S37 | Leave request and substitute coverage | Approval, cover allocation, timetable and notifications remain connected | Open |
| S38 | Teacher/room timetable clash | Explain/prevent collisions and support a valid correction | Open: view/selector checks are not clash tests |
| S39 | Run and correct payroll | Draft/approved/paid states, duplicate prevention and auditable correction | Open: isolated financial fixtures required |
| S40 | Change term dates or grading settings | Show impact; protect historical records; correct track selection | Partial: setting persistence in demo; historical impact unverified |
| S41 | Evening dorm register and missing boarder | Separate classroom/dorm context, safe escalation and traceable follow-up | Open |
| S42 | Clinic visit and guardian contact | Quick entry, limited visibility, follow-up and correct contact | Open: use synthetic health data |
| S43 | Change pickup/transport route | Assignment, schedule, staff visibility and relevant charges agree | Open |
| S44 | Issue/return books or stock | Correct quantities, ownership, due dates, losses and adjustment history | Open |
| S45 | Duplicate meal/shop scan | No duplicate entitlement/deduction; explain invalid/insufficient balance | Open: concurrency fixtures needed |
| S46 | Small phone with keyboard open | Entire task completes without obscured fields/actions or horizontal document scroll | Partial: selected phone layouts; keyboard-open/device tests remain |
| S47 | Slow network, timeout and retry | Preserve input, distinguish unknown save outcomes and retry safely | Partial: local date correction preserves input; network faults untested |
| S48 | Concurrent edits on two devices | Explicit conflict/version policy; no silent data loss | Open |
| S49 | Shared device and cross-school links | Session/cache isolation and server-side tenant/role denial | Partial: teacher registry action hidden and ledger deep-link denied; isolation untested |
| S50 | New school's first useful day | Setup leads to admission, a complete register and receipt without support intervention | Open |

## Next execution order

1. S19 arithmetic and policy reconciliation with fixed assessment fixtures; never treat a bounded display as proof of correct grading.
2. Close demo/live boundaries before testing more mutations. Keep demo fixtures out of persistent sync queues.
3. S03/S05/S10 financial persistence, duplicate retry and full-roster reconciliation in a separate test database.
4. S12/S14/S17/S18 attendance and grade persistence, interrupted work and staff handoff.
5. Admissions/import/transfer/rollover, followed by SMS sandbox, specialist operations and parent/multi-role sessions.

## First execution batch results (before numerical repair)

The combined ground-usability, common-page, and finance visual suites completed 16 checks: **15 successful interactions and one reproduced expected failure (S19)**. Playwright's summary counts an expected failure as passed; it must not be reported as a successful school workflow. Of the eight new ground-usability checks, seven succeeded and one reproduced S19. Their database-write guard recorded no mutation attempts after the demo report guard was added.

The earlier failing payment unit case for blank transaction IDs is repaired. The initial phone pointer failure on credit acknowledgement is also repaired and passes without forced clicks or programmatic checkbox changes. Screenshots under `test-results/ground-usability/` include the checked credit acknowledgement and the unresolved 170% report average. No live school data, SMS delivery or provider transactions were validated by these tests.

## Numerical report repair verification

`src/__tests__/report-summary.test.ts` covers normalized maxima, recorded zero, missing/invalid marks, recorded-subject denominators, list/print average agreement, existing internal division helpers, and competition ties without ranking incomplete reports. `S19` is no longer annotated as an expected failure: it requires bounded or unknown averages, provisional labels, no position/SMS for incomplete reports, and a print popup whose average and incomplete division match the list. Current screenshots replace the initial failing screenshot; the earlier 170% evidence is recorded above.

Official-write behavior is guarded in code but has not been verified on a real test school/database. Incomplete numerical reports are skipped rather than overwriting previously persisted official reports. Their preview remains printable with the incompleteness shown. Existing published records are not recalculated or changed by this repair.

The final numerical-repair browser run passed all 16 ground-usability, common-page and finance checks with no expected-failure annotation. The formerly 170% fixture now displays 86% (172/200 across two recorded subjects), agrees with its print popup, and is visibly provisional rather than ranked against complete reports. Demo subject IDs are aligned to the current demo curriculum before aggregation; live subject matching uses IDs rather than names.

## CBC report repair

CBC calculation now preserves recorded zeroes, treats missing or invalid assessments as unknown, and normalizes exam maxima before applying the existing 20/80 weighting. Current identifier assessment rows and legacy U1/U2 pairs are supported. Missing legacy units are not silently replaced with zero. Decimal marks no longer fall between adjacent grade bands. Existing CBC grade labels and weights are preserved, not certified as a new grading policy.

Screen and print share completed-subject totals and denominators. Incomplete reports show provisional status and are excluded from rankings, official saves and results SMS. Print columns and footer totals now align; unknown values show as — rather than zero or a failing grade. The hardcoded February 2025 reopening date is removed; connecting the actual next-term date remains open. Switching format clears stale reports, and generation disables context changes and repeated generation actions while busy.

Complete CBC persistence payloads include the report format and assessment breakdown, but live writes, RLS and offline replay have not been verified against an isolated test school. Demo CBC generation uses no live grades request and does not fabricate CBC marks from numerical fixtures. Sixteen CBC unit cases cover known calculations, zero, missing/invalid data, decimal grades, component totals and rendered table alignment. The browser scenario checks the missing-data path and format reset; it is not evidence that a real school's complete CBC workflow is verified.

Separate report APIs, grade-entry final scores, class-specific subject allocations, export reconciliation and the A+/A* grading-label policy differences remain open. No existing school records are rewritten by this repair.

Verification: lint and typecheck pass; all 1,495 Jest tests across 122 suites pass, including 163 regression checks. The combined ground-usability, common-page and finance visual browser run passes all 17 checks. CBC phone and print screenshots were visually reviewed; the print table aligns and visibly identifies missing results. Localhost remains running and responds with HTTP 200. These are fixture-based checks, not a sign-off on all 50 scenarios or live school persistence.

## Bursar dashboard redesign

The bursar landing page now prioritizes daily collections, payment channels, a prominent record-payment action and four finance shortcuts. Repeated task/exception panels and the large greeting block are replaced with a compact collection overview, visible searchable receipts, and an arrears follow-up list. The school calendar remains available but starts collapsed. Fee-setup links now open the dedicated fee-structure page instead of an unsupported fees tab.

Receipts can be searched by student, student number, class or reference, with latest/today filters, reset, retry and ledger navigation. The preview sorts before limiting to five rows, retains recorded zeroes and can use joined student details outside the loaded roster. Unknown/loading/failed data is distinguished from zero collections. Labels identify demo figures, school-wide summaries and loaded-record estimates; daily and weekly figures explicitly do not promise reconciled, uncapped totals.

New component tests cover receipt filtering, sorting, empty/error/loading recovery, source boundaries, fee-setup failures and summary availability. Browser checks cover 320px/390px/desktop layouts, horizontal channel alignment, search/reset, ledger and fee-setup/arrears navigation. This redesign does not close S05/S10 persistence/concurrency/full-roster reconciliation requirements and makes no database, authorization or grading-policy changes.

Redesign validation: lint and typecheck pass; all 1,512 unit tests across 124 suites pass. All eight dashboard/finance browser checks pass, and final desktop/phone screenshots were visually reviewed. The live development server is left running; no commit or push is made for this redesign batch.

### Follow-up: dashboard hook-order crash

A reported "Rendered fewer hooks than expected" crash exposed two router memo hooks below loading, signed-out, reconnecting, setup and super-admin early returns. Six new session-transition regression cases failed against the old router, reproducing both fewer-hooks and more-hooks errors. The hooks now run before every early return and safely handle a missing user; existing role eligibility rules and access checks are unchanged. The targeted router/bursar unit run passes all 24 checks. A browser regression now explicitly refreshes the dashboard and returns from the fees page; fresh-page layout checks alone had not exercised the failing session transitions.

Hook-order fix verification: lint, typecheck, 24 targeted unit tests, 163 regression checks and all four bursar browser checks pass, including refresh/back-navigation. The first refresh-test run exceeded the five-second initial-page assertion while the dashboard subsequently rendered normally; its cold-load assertion now allows 15 seconds and still checks for runtime errors. Localhost remains running.

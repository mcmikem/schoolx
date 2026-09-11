# SkoolMate OS — Priced Roadmap: 50 Upgrades

> Source: `AUDIT_REPORT.md` (2026-07-20), `BRUTAL_CRITIQUE.md`, `MARKET_READINESS.md`, `AUTOMATION_ROADMAP.md`, live codebase (`140 pages / 78 APIs / 113 components`).
> Pricing basis (adjust to your team): **1 dev-day = $150 ≈ UGX 560k** (senior indie Uganda-remote, fully loaded). `S` = 1-2d, `M` = 3-5d, `L` = 6-10d, `XL` = 10-20d. Costs are engineering only (excludes SMS/Push/MoMo transaction fees, store fees).
> Convention: `trailingSlash: true` — all new `fetch()` to API routes must use trailing slash. All new Supabase calls must use `withTimeout()` from `src/lib/hooks/utils.ts`. No `src/middleware.ts` (proxy is `src/proxy.ts`).

## Build order (if you only have 6 weeks)

| Wave | IDs | Outcome | Cost |
|------|-----|---------|------|
| Wave 1 (wk 1-2) — Stop losing trust | 01-10 | Login works on 3G, no hangs, no cross-tenant leak, SMS actually sends | ~16d / $2,400 / UGX ~9.0M |
| Wave 2 (wk 3-4) — Daily ops <2 min | 16,20-23,28-31,34-37 | Attendance, marks entry, UNEB export, MoMo reconcile, defaulter engine | ~32d / $4,800 / UGX ~17.9M |
| Wave 3 (wk 5-6+) — Moat + growth | rest | Timetable generator, CBC, copilot, mobile hardening, multi-school | phased |

**Total for all 50:** ~147 dev-days / **~$22,050 / UGX ~82M**. P0 alone: ~19d / $2,850 / UGX ~10.6M.

---

## P0 — Reliability + Security (must-fix, do first)

### 01. Fix 7 critical automation bugs — S (2d) — $300 / UGX 1.1M
**Files:** `src/app/api/automation/auto-inventory-alerts/route.ts`, `auto-promote/route.ts:177`, `automation/term-end/route.ts:560`, `auto-fee-reminder/route.ts:161,212`, `automation/sms/run/route.ts`, `api/sync/route.ts:394`
**Tasks:**
- `auto-inventory-alerts`: `type`→`category`, `current_stock`→`quantity`, `unit_cost`→`unit_price`, `supplier_name`→`supplier`; add migration for `reorder_level`, `supplier_contact`, `last_restocked_at` on `assets`.
- `auto-promote`: replace `promoted_by: "system"` with system-user UUID (or nullable + `promoted_by_system bool`); drop non-existent `promotion_type: "promoted"`.
- `term-end:560`: include `name, code, start_date, end_date` on `academic_terms` insert (derive from `uganda-school-calendar.ts`).
- `auto-fee-reminder`: fix dedup — `messages` has no `type`/`student_id`; use `message_logs` or add migration + index.
- `sms/run`: actually call `sendAfricasTalkingSMSWithRetry` from `src/lib/africas-talking.ts`; stop logging fake "sent".
**Accept:** each route has happy-path Jest test against local Supabase; low-stock / promote / rollover verified manually.

### 02. `withTimeout()` everywhere — S (2d) — $300 / UGX 1.1M
**Files:** ~66 API routes (notably `register`, `fees`, `students`, `payment/webhook`, `auth/me`, `reports`, `sms`), `src/lib/hooks/core.ts:62` (`useSupabaseQuery`)
**Tasks:** codemod all `supabase.from(` calls to wrap with `withTimeout()`; add Biome/ESLint rule + CI check; fix `useSupabaseQuery` core.
**Accept:** `rg "supabase.from" --type ts | rg -v withTimeout` = 0 in `src/app/api`; `npm run test:regression` passes.

### 03. Fix login dead-end on slow networks — S (1d) — $150 / UGX 560k
**Files:** `src/app/login/page.tsx:220,271-280`, `src/lib/auth-context.tsx:551,682`
**Tasks:** replace 250ms poll + 2s safety timer with `await fetchUserData` + 15s timeout + explicit "Resume session" retry; cleanup `submitTimerRef`/`setTimeout` on unmount; fix comment (says 8000ms, is 2000ms).
**Accept:** throttled-3G login succeeds 5/5; no "Login succeeded but session was not established".

### 04. Kill mock-Supabase silent-empty in prod — S (1d) — $150 / UGX 560k
**Files:** `src/lib/supabase.ts:109`, `src/lib/supabase-client.ts`, `src/app/api/health/env/route.ts`
**Tasks:** mock client only when `NODE_ENV=development` + explicit flag; in prod fail fast with "Missing Supabase env" screen + log to Sentry; add `GET /api/health/env/` check to setup wizard.
**Accept:** prod build without env vars errors loudly, never renders empty dashboards.

### 05. Central tenant authz boundary — M (4d) — $600 / UGX 2.2M
**Files:** NEW `src/lib/require-school.ts`, `src/lib/api-utils.ts` (`withSecurity`), `src/app/api/reports/route.ts`, `src/app/api/import/route.ts`, `src/app/api/admin/run-sql/route.ts`, `src/proxy.ts`
**Tasks:** `requireSchool(req, schoolId)` checks session + role + `my_school_id()`; enforce `student.school_id === schoolId` on reports/import; lock `admin/run-sql` to super-admin + audit log.
**Accept:** cross-school `studentId`+`schoolId` mismatch returns 403; e2e test covers it (closes BRUTAL_CRITIQUE #2-3).

### 06. Disable `test-paypal` + test endpoints in prod — S (0.5d) — $75 / UGX 280k
**Files:** `src/app/api/payment/test-paypal/route.ts`, `src/app/api/payment/test/route.ts`, `scripts/check-production-leakage.mjs`
**Tasks:** gate behind `requireDevelopmentRouteOrDeny()`; add leakage check to `npm run check:release`.
**Accept:** prod returns 404; `check-production-leakage` passes.

### 07. Redis rate-limit for auth/OTP — S (2d) — $300 / UGX 1.1M
**Files:** `src/app/api/forgot-password/route.ts`, `reset-password/route.ts`, `src/lib/rate-limit.ts` (Redis via Upstash, fallback to memory in dev only)
**Tasks:** replace in-memory `Map`; sliding-window 5/hr per IP+identifier; return `Retry-After`.
**Accept:** limit survives cold start (test with 2 sequential invocations); 429 shape standardized.

### 08. Server-validated parent sessions — M (4d) — $600 / UGX 2.2M
**Files:** `src/app/parent/page.tsx`, `src/lib/parent-portal.ts`, NEW `src/app/api/parent/session/route.ts`
**Tasks:** httpOnly signed cookie session; server re-validates `parent_students` mapping on each load; migrate off `localStorage parent_session`.
**Accept:** tampering with localStorage cannot switch child context (closes BRUTAL_CRITIQUE #4).

### 09. OAuth `state` + OTP type fix — S (1d) — $150 / UGX 560k
**Files:** `src/app/login/page.tsx:140,159`
**Tasks:** pass `state` (PKCE/CSRF) to `signInWithOAuth`; change `verifyOtp type: "magiclink"` → correct `email`/`sms` type per flow.
**Accept:** Google + OTP login e2e passes on staging.

### 10. Missing DB indexes + FK hardening — S (1d) — $150 / UGX 560k
**Files:** NEW `supabase/migrations/XXXX_add_perf_indexes.sql`, `supabase/schema.sql`
**Tasks:** indexes on `students(school_id,class_id)`, `fee_payments(student_id)`, `attendance(student_id,date)`, `events(school_id,start_date)`, `parent_students(student_id)`, `teacher_subjects(teacher_id)`; add FKs on `payroll_deductions(payroll_record_id, staff_id)`; add `CHECK (amount_paid <= total_fees)` or trigger on `student_fees`.
**Accept:** `EXPLAIN` shows index scans on fee/attendance lists with 10k seed rows.

### 11. Unify fee/grade dual schemas — L (8d) — $1,200 / UGX 4.5M
**Files:** `fee_structure` vs `fee_terms`, `grades` vs `student_grades`, `src/app/dashboard/fee-terms/page.tsx`, `src/lib/businessRules.ts`, migration backfill script
**Tasks:** pick modern schema as canonical; backfill script + verification counts; mark legacy read-only; remove dual writes.
**Accept:** single source of truth; no divergent totals in fee reports.

### 12. Transactional registration — M (3d) — $450 / UGX 1.7M
**Files:** `src/app/api/register/route.ts`, NEW `supabase/migrations/XXXX_register_tx.sql` (`rpc register_school_tx`)
**Tasks:** single Postgres function for school+profile+seed; rollback on any failure; idempotency key on retry.
**Accept:** killing request mid-flow leaves zero orphan auth users/schools (tested 3x).

---

## P1 — Code health + Performance (13-19)

### 13. Unify Toast + Skeleton — S (1d) — $150 / UGX 560k
**Files:** `src/components/Toast.tsx` vs `src/lib/notifications.tsx`; `src/components/loaders/Skeleton.tsx` vs `src/components/ui/Skeleton.tsx` vs `src/components/Skeletons.tsx`
**Tasks:** keep one of each; codemod imports; delete dead files; add `knip` check.
**Accept:** `npm run knip` clean; no duplicate-provider runtime error.

### 14. Remove `as any` hotspots + lint gate — M (3d) — $450 / UGX 1.7M
**Files:** `ReportCard.tsx(7)`, `SchoolCalendar.tsx(5)`, `StudentTransfersPanel.tsx(4)`, `TopDefaulters.tsx`, `src/hooks/*`
**Tasks:** type top 20 files; add `no-explicit-any: warn` + CI budget (fail if count rises).
**Accept:** `as any` count drops >50%, `typecheck` clean.

### 15. Kill 17 redirect-shell pages — S (2d) — $300 / UGX 1.1M
**Files:** `src/app/dashboard/{students/add,users,feedback,class-comparison,dorm-supplies,setup,cashbook,attendance/today,…}/page.tsx`, `src/lib/navigation.ts`
**Tasks:** use server `redirect()` or delete + remove nav links; verify each target exists (`/dashboard/schools`, `/suggestions`, `/analytics`, `/dorm`, `/setup-wizard`).
**Accept:** no client-flash redirects; `npm run check:routes` 200 on all nav targets.

### 16. Headmaster dashboard code-split — M (3d) — $450 / UGX 1.7M
**Files:** `src/app/dashboard/*`, `src/lib/dashboard-data.ts`, `next.config.js`
**Tasks:** `next/dynamic` per heavy tab (analytics, DNA, board-report); React Query prefetch + stale times; `ANALYZE=true npm run build` before/after.
**Accept:** dashboard JS -30%, LCP <3s on Moto G / 3G emulation.

### 17. Router navigation (no full reloads) — S (0.5d) — $75 / UGX 280k
**Files:** `src/app/login/page.tsx` (demo login), any `window.location.href` in dashboard
**Tasks:** replace with `router.replace()`; preserve toast across nav via context.
**Accept:** demo login preserves React state, no full reload.

### 18. Real API + component test safety net — L (8d) — $1,200 / UGX 4.5M
**Files:** NEW `tests/api/*.test.ts` (webhooks, sync, term-end, reports), `tests/components/*.tsx`, replace brittle string-match in `src/__tests__/regression.test.ts`, `lockdown.test.ts`
**Tasks:** supertest-style route tests with local Supabase; Testing Library smoke for login/attendance/fees; HMAC/idempotency/refund tests for Stripe+PayPal+Flutterwave.
**Accept:** >40 new behavior tests; CI runs `test:regression` + api suite green.

### 19. Proper sign-out everywhere — S (1d) — $150 / UGX 560k
**Files:** `src/lib/auth-context.tsx`, `src/lib/auth-login.ts`, `src/app/api/auth/*`
**Tasks:** server session revoke + "Log out all devices"; clear IndexedDB offline cache scope per school.
**Accept:** revoked token rejected on next `auth/me` call.

---

## P2 — Offline-first + UX simplification (20-26)

### 20. Visible offline queue — M (4d) — $600 / UGX 2.2M
**Files:** `src/lib/offline.ts`, `src/lib/offline-hooks.ts`, `src/lib/useSyncStatus.ts`, NEW `OfflineQueueBadge.tsx`, `src/app/api/sync/route.ts`
**Tasks:** IndexedDB outbox count + per-record status + manual Retry; header badge + settings page list.
**Accept:** airplane-mode attendance shows "3 pending → synced" on reconnect.

### 21. Field-level sync merge — L (7d) — $1,050 / UGX 3.9M
**Files:** `src/app/api/sync/route.ts:394`, NEW `supabase/migrations/XXXX_sync_tombstones.sql`
**Tasks:** per-field `updated_at`, tombstones for deletes, device clocks skew guard; conflict UI ("keep mine/theirs").
**Accept:** two-device concurrent edit to different fields merges, no data loss.

### 22. Sub-2-min attendance grid — M (3d) — $450 / UGX 1.7M
**Files:** `src/app/dashboard/attendance/page.tsx`, `period-attendance/`, `dorm-attendance/`
**Tasks:** "Mark all present → tap absentees", local-first save, background sync; period/dorm switcher without nav loss.
**Accept:** 60-pupil class marked in <2 min on Tecno Spark / 3G (manual test script in `tests/e2e/`).

### 23. Role-based nav collapse — M (3d) — $450 / UGX 1.7M
**Files:** `src/lib/navigation.ts`, `src/lib/roles.ts`, `src/lib/useRoutePermissions.ts`, `src/lib/role-access-overrides.ts`
**Tasks:** 5-7 items per role (teacher/bursar/warden/parent); hide store/POS/super-admin from teachers; audit `no-access` hits.
**Accept:** teacher sees only classes/attendance/marks/homework; bursar sees fees/cashbook/payroll.

### 24. Global `Cmd+K` search — M (4d) — $600 / UGX 2.2M
**Files:** NEW `src/components/GlobalSearch.tsx`, `src/app/api/search/route.ts` (students by name/admission/phone, staff, invoices)
**Tasks:** debounced search + keyboard nav + recent items; RLS-scoped to `my_school_id()`.
**Accept:** any student found in <2s with 5k-student seed.

### 25. Print-first PDFs + thermal receipts — M (4d) — $600 / UGX 2.2M
**Files:** `src/app/dashboard/report-cards/`, `invoicing/`, `src/app/api/reports/route.ts` (use `jspdf`+`jspdf-autotable` already installed)
**Tasks:** A4 report-card + 80mm receipt layouts; school logo/header from `api/schools/logo`; offline-printable.
**Accept:** receipt prints legibly on 80mm; report card PDF in <30s per ROADMAP MVP metric.

### 26. Luganda/Swahili + low-literacy mode — M (5d) — $750 / UGX 2.8M
**Files:** `src/i18n/*`, `src/lib/i18n.ts`, parent portal pages, `src/lib/sms-automation.ts` templates
**Tasks:** `lg`/`sw` dictionaries for parent portal + SMS templates; big-button/high-contrast toggle; voice-note notice upload (Supabase Storage).
**Accept:** parent portal fully usable in Luganda; SMS templates reviewed by native speaker.

---

## P3 — Academics moat: Uganda-specific (27-33)

### 27. UNEB e-registration export — M (5d) — $750 / UGX 2.8M ⭐ tender-winner
**Files:** `src/app/dashboard/uneb/page.tsx`, NEW `src/app/api/uneb/export/route.ts`, `src/lib/student-photos.ts`
**Tasks:** PLE/UCE/UACE CSV shape + photo validator (size/background/dup) + index-number checksum; dry-run error report.
**Accept:** sample school exports accepted by UNEB format checker with 0 errors.

### 28. NCDC CBC competence tracker — L (7d) — $1,050 / UGX 3.9M
**Files:** `src/lib/ndc-syllabus.ts`, `curriculum.ts`, `curriculum-templates.ts`, `src/lib/cbc-report.ts`, grades pages
**Tasks:** strand-level rubrics (Exceeding/Meeting/Developing/Beginning) alongside CA scores; auto comment bank; new-curriculum report template.
**Accept:** P1-S6 CBC report card generates from same marks entry.

### 29. Auto timetable generator — L (8d) — $1,200 / UGX 4.5M
**Files:** `src/app/dashboard/timetable/page.tsx`, NEW `src/lib/timetable-solver.ts`, `src/app/api/timetable/generate/route.ts`
**Tasks:** constraint solver (teacher load, room, doubles, prep gaps) → draft → conflict list → Approve; keep existing CRUD as editor.
**Accept:** 20-class secondary generates clash-free draft in <60s.

### 30. Spreadsheet-mode marks entry — M (4d) — $600 / UGX 2.2M
**Files:** `src/app/dashboard/grades/page.tsx`, `marks-completion/page.tsx` (make real, not redirect), `src/app/api/import/route.ts`, `parse-import/route.ts`
**Tasks:** paste-from-Excel grid, bulk validate (0-100, missing, outliers), per-class completion bar, nudge teacher via SMS.
**Accept:** 30-pupil class entered in <5 min (MVP metric).

### 31. Transactional promotion/graduation — M (4d) — $600 / UGX 2.2M
**Files:** `src/app/api/automation/term-end/route.ts` (`buildRolloverPreview`), `promotion/page.tsx`, `term-end/page.tsx`
**Tasks:** make preview actually write (clone classes, promote, create P1/S1 entries) inside one tx + dry-run diff UI.
**Accept:** end-to-end rollover on staging clone with 0 FK/NOT NULL errors.

### 32. Lesson-plan ↔ scheme ↔ syllabus chain — M (5d) — $750 / UGX 2.8M
**Files:** `lesson-plans/`, `scheme-of-work/`, `syllabus*`, `src/lib/syllabus-planner-utils.ts`, MoES export
**Tasks:** link IDs across three layers; coverage % tracker; MoES inspection PDF export.
**Accept:** inspector can trace lesson → scheme → NCDC topic in 2 clicks.

### 33. Behavior → guardian workflow — M (3d) — $450 / UGX 1.7M
**Files:** `behavior/`, `discipline/`, `conduct*`, `src/lib/sms-automation.ts`
**Tasks:** 3-incidents/30d auto-escalation + counseling log + guardian SMS with resolution link.
**Accept:** e2e: log 3 incidents → guardian notified + case opened.

---

## P4 — Fees + Money (34-39)

### 34. MoMo pending-state machine — L (6d) — $900 / UGX 3.4M
**Files:** `src/app/api/payment/mobile-money/route.ts`, `payment/verify/route.ts`, `payment/webhook/route.ts`, `schoolpay/sync/route.ts`, parent `fees/page.tsx`
**Tasks:** `pending → confirming → success/failed` with webhook reconcile job; STK-push timeout + USSD fallback code display; auto-receipt+SMS on success.
**Accept:** Airplane-mid-payment resolves correctly on webhook replay (idempotent).

### 35. Part-payments + allocation rules — M (4d) — $600 / UGX 2.2M
**Files:** `fee_payments/`, `fee_structure`, `student_fees` GENERATED `balance`, `invoicing/page.tsx`
**Tasks:** oldest-first allocation, balance-brought-forward, overpayment guard, installment schedules UI.
**Accept:** split payment across 2 terms allocates correctly; no negative balances.

### 36. Real bursar cashbook — M (4d) — $600 / UGX 2.2M
**Files:** `src/app/dashboard/cashbook/` (replace redirect), NEW `src/app/api/cashbook/route.ts`
**Tasks:** daily open/close, cash vs MoMo vs bank splits, variance alerts, Excel export (`exceljs` already installed).
**Accept:** bursar closes day in <5 min; variance >1k UGX flagged.

### 37. Tiered defaulter engine — M (4d) — $600 / UGX 2.2M
**Files:** `src/app/api/automation/auto-fee-reminder/route.ts`, `auto-installment-reminder/route.ts`, `TopDefaulters.tsx`, `sms-delivery/page.tsx`
**Tasks:** 30/60/90-day tiers (polite→firm→principal), dedup fix from #01, cost-per-SMS + delivery receipts.
**Accept:** no duplicate SMS in 3 daily runs; DLR visible per message.

### 38. Usable payroll (tax-correct) — M (5d) — $750 / UGX 2.8M
**Files:** `src/app/api/automation/auto-payroll/route.ts`, `payroll/page.tsx`, NEW Uganda PAYE/NSSF table in `src/lib/payroll-ug.ts`
**Tasks:** ungate from `enterprise`-only (or Starter add-on); fix dead NSSF/PAYE vars; payslip PDF; Flutterwave bulk-disburse behind `ENABLE_MOMO_DISBURSEMENTS`.
**Accept:** 20-staff payroll computes PAYE/NSSF matching URA tables ±1 UGX.

### 39. Budget-vs-actual dial — S (2d) — $300 / UGX 1.1M
**Files:** `budget/page.tsx`, `src/app/api/fees/route.ts`, expenses source
**Tasks:** one headmaster card: collected vs budgeted vs spent MTD; variance sparkline (`recharts` already installed).
**Accept:** numbers reconcile with fee + expense tables to the shilling.

---

## P5 — Comms + Parents (40-44)

### 40. Real SMS queue + DLR + WhatsApp fallback — M (5d) — $750 / UGX 2.8M
**Files:** `src/lib/africas-talking.ts`, `src/lib/whatsapp.ts`, `src/lib/sms-automation.ts`, `api/sms/route.ts`, `api/sms/incoming/route.ts`, `sms-delivery/page.tsx`
**Tasks:** persistent queue table + retry/backoff + DLR webhook; cost dashboard; WhatsApp fallback when DLR fails/opted-in.
**Accept:** 500-recipient bulk SMS completes with per-recipient DLR.

### 41. Two-way parent inbox — M (4d) — $600 / UGX 2.2M
**Files:** `api/sms/incoming/route.ts`, `dashboard/messages/page.tsx`, parent `messages/page.tsx`
**Tasks:** inbound shortcode → threaded inbox; absence-excuse keyword parse ("SICK Musa P5"); auto-translate stub.
**Accept:** parent reply appears in dashboard thread <60s.

### 42. Student hub (kid PWA) — L (6d) — $900 / UGX 3.4M
**Files:** `student-portal/page.tsx`, `src/lib/student-hub.ts`, `docs/STUDENT_HUB_*`
**Tasks:** homework+results+fees+timetable in one kid-friendly view; offline cache; QR login via ID card.
**Accept:** P5 pupil finds tomorrow's homework in 2 taps (usability test x5).

### 43. Voice/IVR alerts (Luganda) — L (7d) — $1,050 / UGX 3.9M
**Files:** NEW `src/app/api/voice/route.ts`, `src/lib/africas-talking.ts` (voice), parent portal audio player
**Tasks:** TTS fee/absence alerts; opt-in per guardian; audio + SMS pairing.
**Accept:** guardian with feature phone receives intelligible Luganda alert.

### 44. Notice → poster + QR — S (1d) — $150 / UGX 560k
**Files:** `dashboard/notices/page.tsx`, `qrcode.react` (already installed)
**Tasks:** one-click A3 poster PDF with QR to parent-portal notice.
**Accept:** printed poster QR opens correct notice on phone.

---

## P6 — AI + Automation (45-47)

### 45. Headmaster copilot + at-risk predictor — L (8d) — $1,200 / UGX 4.5M
**Files:** `src/app/api/ai/chat/route.ts` (Gemini via `@google/genai`), `analytics/dna/page.tsx`, NEW `src/lib/risk-model.ts`
**Tasks:** report-comment drafter; dropout risk (attendanceΔ + fee-delay + grade-slip) with explainability; opt-out + audit log.
**Accept:** teacher accepts/edits 10 comments in <10 min; risk list precision spot-checked vs warden judgment.

### 46. Ops anomaly alerts — M (4d) — $600 / UGX 2.2M
**Files:** `src/lib/automation-engine.ts`, `automation/*`, `data-quality/page.tsx`, `src/lib/data-quality-rules.ts`
**Tasks:** ghost-student, teacher-overload, fee-leakage, inventory-stockout detectors as scheduled jobs + dashboard cards.
**Accept:** seeded anomalies all fire within 24h cron window.

### 47. Idempotent cron framework — M (3d) — $450 / UGX 1.7M
**Files:** all `src/app/api/automation/*`, `src/app/api/cron/*`, `webhook_events` table, `CRON_SECRET` wiring
**Tasks:** `Idempotency-Key` + `webhook_events` log on every job; remove hardcoded `2025` date ranges (use academic-term context); Vercel cron JSON.
**Accept:** double-fire of any job produces single side-effect.

---

## P7 — Mobile + Platform + Growth (48-50)

### 48. Capacitor hardening — L (8d) — $1,200 / UGX 4.5M
**Files:** `capacitor.config.ts`, `src/lib/capacitor-init.ts`, `src/lib/useServiceWorker.ts`, `android/`, `ios/`, push via `@capacitor/push-notifications`
**Tasks:** push (fee/absence), biometric login, QR/photo attendance (`html5-qrcode` already), offline SQLite queue, <50MB APK, splash/icon polish.
**Accept:** Tecno Spark install + offline attendance + push all pass on physical device.

### 49. Observability + hardening pass — M (3d) — $450 / UGX 1.7M
**Files:** `sentry.*.config.ts`, `src/lib/error-logger.ts`, `src/lib/logger.ts`, `src/proxy.ts` (CSP `connect-src`), `src/app/api/health/route.ts`
**Tasks:** Sentry releases + source maps; strip `console.*` (use `logger`); fix CSP blocking local Supabase; `/api/health/` + uptime monitor; remove verbose auth logs.
**Accept:** staging error reproduces with full stacktrace; CSP blocks 0 legit calls.

### 50. Multi-school + marketer payouts — L (7d) — $1,050 / UGX 3.9M
**Files:** `dashboard/schools/page.tsx`, `api/marketers/*`, `api/super-admin/*`, `subscription.ts`, `subscription-guard.ts`
**Tasks:** org switcher + consolidated billing; referral `code` attribution e2e; automated payout report + approval flow.
**Accept:** diocese with 5 schools bills once; marketer commission reconciles to paid invoices.

---

## Cost rollup

| Phase | IDs | Days | USD (@$150/d) | UGX (~560k/d) |
|-------|-----|------|---------------|---------------|
| P0 Reliability+Security | 01-12 | ~29d | $4,350 | UGX ~16.2M |
| P1 Health+Perf | 13-19 | ~18d | $2,700 | UGX ~10.1M |
| P2 Offline+UX | 20-26 | ~25d | $3,750 | UGX ~14.0M |
| P3 Academics | 27-33 | ~36d | $5,400 | UGX ~20.2M |
| P4 Fees | 34-39 | ~25d | $3,750 | UGX ~14.0M |
| P5 Comms | 40-44 | ~21d | $3,150 | UGX ~11.8M |
| P6 AI/Auto | 45-47 | ~15d | $2,250 | UGX ~8.4M |
| P7 Mobile/Growth | 48-50 | ~18d | $2,700 | UGX ~10.1M |
| **Total** | **01-50** | **~187d*** | **~$28,050** | **UGX ~105M** |

\*Sum of per-item maxes; with parallelization + batching (e.g., 13+14, 20+21, 34+37) realistic **~140-150d**. Halve it by cutting P6-P7 to stubs.
Recurring (not in build cost): Africa's Talking SMS ~UGX 30-60/SMS, push free, Supabase/Vercel scale tiers, Flutterwave/MoMo ~1-2% per txn.

## Suggested sequencing
1. **Now:** 02, 03, 06, 10 (stop hangs + login + leaks) — 1 week, 1 dev.
2. **Next:** 01, 05, 07, 08 (automations + authz + sessions) — 2 weeks.
3. **Then:** 22, 30, 27, 34, 37 (daily-ops revenue loop) — 3 weeks.
4. **Moat after revenue:** 29, 28, 45, 48.

*Generated 2026-09-11. Re-price by replacing the rate line at top; all per-item USD/UGX scale from dev-days.*

# Timetable Feature — Design Document

## 1. Problem

SkoolMate's timetable did not reflect how Ugandan schools actually allocate time. The default seed created six 40-minute periods ending at 14:00, with "lunch" at 11:00, which contradicts Ministry of Education and Sports (MoES) Basic Requirements & Minimum Standards (Indicator 11) and the NCDC Lower Secondary Curriculum Framework. Schools printing class timetables for notice boards had no print view. Primary and secondary schools shared one bell schedule despite different break/lunch norms.

## 2. Research basis (Ugandan school practice)

- **MoES BRMS (Indicator 11)**: school day 08:00–17:00; at least 8 lessons/day; mid-morning break ≤30 min; lunch ≤60 min; 1 hour co-curricular activity daily; assembly ≤40 min.
- **NCDC Lower Secondary Curriculum Framework**: 8 × 40-minute periods/day (1,600 min/week); instruction 08:00–14:40, then supervised projects/games to 16:30; fixed weekly periods per subject (English 6, Maths 5, Physics/Biology/Chemistry 3 in S1–S2 and 4 in S3–S4).
- **Real school timetable** (Bishop Dunstan, Kalangala): 40-min periods, ~20-min break around 10:40, 13:00–14:00 lunch, lessons to 16:40.
- **A-level (NCDC)**: 9 periods/week per principal subject plus practicals.

## 3. Goals

1. Model the real Ugandan school day as pure, testable data.
2. Seed new schools with a school-type-appropriate bell schedule (primary vs secondary/combined).
3. Let admins edit the bell schedule with presets and MoES compliance checks.
4. Compare planned weekly periods against the NCDC guide per subject.
5. Auto-generate a full week from teacher–subject assignments using NCDC per-subject periods.
6. Provide a printable A4-landscape class timetable for notice boards.
7. Support Saturday (day 6), which the generator and DB already support.

## 4. Non-goals

- No change to the `teacher_timetable` or `timetable_slots` schema.
- No change to RLS policies.
- No merging of double lessons into single slots (represented as same subject in consecutive periods).
- No transactional rewrite of registration seeding (out of scope).

## 5. Architecture

### 5.1 Bell schedule builder — `src/lib/timetable/uganda-day.ts`

Pure functions, no I/O:

- `SchoolDayConfig` interface: startTime, assemblyMinutes, lessonMinutes, lessonsBeforeBreak, breakMinutes, lessonsBeforeLunch, lunchMinutes, lessonsAfterLunch, coCurricularMinutes, prepMinutes, level.
- `SCHOOL_DAY_PRESETS`: nursery, primary, lower_secondary, upper_secondary.
- `buildSchoolDay(config)` → `SchoolDaySlot[]` (assembly, periods, break, lunch, games, prep).
- `validateSchoolDay(config)` → `{ errors, warnings }` enforcing MoES rules (≥8 lessons, break ≤30, lunch ≤60, co-curricular ≥60, day ends by 17:00; evening prep excluded from the 08:00–17:00 window).
- `SCHOOL_LEVEL_LABELS`, `schoolLevelFromClassName(name)`.
- `weeklyPeriodTargets(level, seniorClass?)` → NCDC periods-per-subject table.
- `matchWeeklyTarget(subjectName)` → tolerant subject matching.

### 5.2 Default seed — `src/lib/school-setup.ts`

`buildDefaultTimetableSlots(schoolId, schoolType)`:
- primary → primary preset (30-min porridge break, 15:05 finish).
- secondary/combined → lower_secondary preset (20-min break, 14:55 finish, games to 16:45).

### 5.3 Hook — `src/lib/hooks/timetable.ts`

`useTimetableManager(schoolId, schoolType)`:
- Loads slots from `timetable_slots`; seeds defaults (by school type) if empty.
- On insert timeout, mints `seed-${order_number}` ids so the UI stays usable.
- `refetch()` for re-running after bell-schedule apply.

### 5.4 UI — `src/app/dashboard/timetable/page.tsx`

- `PageHeader` + `StatStrip` (Periods, Classes, Subjects, Staff, Lessons).
- Tabs: Class Timetable | Term Calendar | Week View.
- Class selector + day tabs (Mon–Sat).
- Mobile agenda + desktop grid; clash detection banner.
- NCDC weekly load panel (subject-by-subject actual vs target, amber when short).
- Auto-generate modal (NCDC-seeded per-subject periods, "Use NCDC guide" reset).
- School day modal (presets, live preview, compliance errors/warnings, numeric clamping, optional clear-lessons).
- Print button → `TimetablePrintSheet`.

### 5.5 Print sheet — `src/components/timetable/TimetablePrintSheet.tsx`

Portal-rendered A4-landscape sheet: header (school/class/term), Mon–Sat grid with breaks as spanning rows, teacher + room per cell, footer. Print CSS scoped via named `@page timetable` + `body:has(.timetable-print-sheet)` so other print flows (report cards, ID cards, exam timetable) keep their own page size.

### 5.6 Term calendar — `src/components/timetable/TermCalendar.tsx`

Merged Uganda public holidays + term dates + school events, grouped by month. CRUD via shared `Modal`. Local-date "today" comparison.

## 6. Data flow

- Slots: `timetable_slots` (one bell schedule per school).
- Entries: `teacher_timetable` (class_id, subject_id, teacher_id, day_of_week, period_number, times, room, academic_year).
- Conflict detection: teacher/room double-booking across all classes for the school.

## 7. Testing

- `uganda-school-day.test.ts` (14): builder, presets, MoES validation, evening-prep exclusion.
- `school-day-setup-modal.test.tsx` (5): presets, preview, compliance, clamping.
- `school-setup.test.ts`: default slot counts + primary vs secondary break times + combined follows secondary.
- `timetable-print-sheet.test.tsx` (7): header, columns, cells, spanning breaks, print dialog, Escape.
- `timetable-mobile-agenda.test.tsx`, `timetable-generate-modal.test.tsx`, `timetable-solver.test.ts`.
- Full suite: 237 suites / 2519 tests.

## 8. Known limitations / follow-ups

- `TermCalendar` hard-codes 2026 Uganda holidays/term dates; should be year-aware or data-driven.
- `TimetableCalendar` (FullCalendar week view) uses a computed reference week; `weekends={true}` now shows Saturday.
- Clash detection is O(n²) over all school entries (memoized but heavy for large schools).
- No offline write path for timetable entries (reads are cached; writes require connectivity).
- `effectiveSlots as any` cast at the calendar boundary (partially fixed).
- Print CSS `@page timetable` named page relies on modern browser support.
- The `as any` in `useTimetableManager` seeding path remains.

## 9. Files changed

- `src/lib/timetable/uganda-day.ts` (new)
- `src/lib/school-setup.ts`
- `src/lib/hooks/timetable.ts`
- `src/app/dashboard/timetable/page.tsx`
- `src/components/timetable/SchoolDaySetupModal.tsx`
- `src/components/timetable/TimetablePrintSheet.tsx` (new)
- `src/components/timetable/TermCalendar.tsx` (extracted)
- `src/components/timetable/GenerateTimetableModal.tsx`
- `src/components/onboarding/OnboardingFlow.tsx`
- `src/app/globals.css`
- Tests: `uganda-school-day.test.ts`, `school-day-setup-modal.test.tsx`, `school-setup.test.ts`, `timetable-print-sheet.test.tsx`, `timetable-mobile-agenda.test.tsx`
EOF
echo written
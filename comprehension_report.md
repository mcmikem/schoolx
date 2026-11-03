# Stage 6 — Comprehension Test

**Target:** `/Users/me/schoolx-git/docs/timetable-design.md`  

## What this proposes

The document proposes replacing current timetable defaults with configurable Uganda-appropriate schedules. It adds bell presets, MoES validation, NCDC subject-period guidance, timetable generation, conflict detection, print output, term-calendar behavior, and Saturday support without changing the timetable schema or RLS.

## How the existing system works, per this document

Bell slots live in `timetable_slots`, while entries live in `teacher_timetable`. New schools receive defaults, and the UI displays class schedules, conflicts, calendar data, and week views. The current defaults use six 40-minute periods, an incorrect lunch time, and one shared schedule for primary and secondary schools.

## Findings

- **Major:** MoES, BRMS, NCDC, Indicator 11, S1–S4, and A-level terminology is undefined (lines 5, 7–12).
- **Major:** The document does not explain which cited source wins when regulatory sources conflict (lines 9–12, 16–22).
- **Major:** `SchoolDayConfig` field sequencing and semantics are unclear (lines 37–43).
- **Major:** Preset finish times do not connect clearly to inputs and stated research (lines 47–50).
- **Major:** NCDC target behavior, unmatched subjects, and advisory/blocking rules are unspecified (lines 19–20, 42–43, 64–65).
- **Major:** Auto-generation behavior for insufficient periods, clashes, unavailable teachers, and duplicate demands is unspecified (lines 20, 65).
- **Major:** School-level enum values and distinctions are undefined (lines 17, 37, 39, 41, 47–49).
- **Major:** Schedule persistence, replacement, rollback, and effects on existing entries are not explained (lines 45–56, 77–81, 92–100).
- **Major:** UI ownership, navigation, class/term selection, and print workflow are not self-contained (lines 61–75).
- **Major:** Tests list filenames/counts but not behavioral acceptance criteria (lines 83–90).
- **Major:** Preset setup timing, prerequisites, and behavior for existing schools are missing (lines 16–22, 45–56).
- **Major:** Generation assumes complete assignments without validation or remediation rules (lines 20, 53–56, 79–81).
- **Major:** Calendar maintenance and future-year behavior are unspecified (lines 73–75, 94).
- **Major:** Lines 115–116 contain shell residue: `EOF` and `echo written`.

## Overall assessment

The main proposal is understandable, but a new engineer cannot safely implement the regulatory rules, schedule persistence, generation workflow, or administrator operations without making many decisions.

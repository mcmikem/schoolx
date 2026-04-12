# App Analysis & Simplification Plan

## NCDC/CBC Research - Current Implementation Status

### ✅ ALREADY IMPLEMENTED

| NCDC Requirement             | Status | Location                 |
| ---------------------------- | ------ | ------------------------ |
| CA1, CA2, CA3, CA4           | ✅     | grades table, grading.ts |
| Project scores               | ✅     | grades table             |
| Competency focus in syllabus | ✅     | ndc-syllabus.ts          |
| D1-F9 grading scale          | ✅     | grading.ts               |
| UNEB candidate registration  | ✅     | uneb-registration/page   |
| UNEB analysis                | ✅     | uneb/page                |
| MOES exports                 | ✅     | moes/page                |

### ❌ GAPS TO FILL

| NCDC Requirement                | Gap                         | Priority |
| ------------------------------- | --------------------------- | -------- |
| Activities of Integration (AOI) | No AOI scores tracked       | HIGH     |
| Generic skills tracking         | Not explicitly tracked      | MEDIUM   |
| Competency comments per subject | Hardcoded, not customizable | MEDIUM   |
| Subject Observation Checklist   | Not implemented             | LOW      |
| New curriculum report template  | Using old format            | HIGH     |

---

## APP STREAMLINING ANALYSIS

### Current Problems

1. **Too many pages** - 70+ dashboard pages overwhelms users
2. **Navigation chaos** - Nested menus, unclear hierarchy
3. **Feature bloat** - Pages that aren't used regularly
4. **Inconsistent UX** - Different patterns across pages
5. **Performance** - Multiple data fetches, no lazy loading
6. **Mobile unfriendly** - Not truly responsive in practice

### Solution: Core + Expansion Model

**KEEP (Core - used daily):**

- Dashboard (home)
- Attendance (daily)
- Fees (daily)
- Grades (daily)
- Students (frequent)
- Staff (frequent)
- Messages/SMS (frequent)

**KEEP (Secondary - weekly):**

- Reports
- Exam management
- Library
- Transport

**CONSOLIDATE/MERGE:**

- Discipline + Conduct + Behavior → "Student conduct"
- Homework + Homework submissions → "Assignments"
- Dorm + Dorm attendance → "Boarding"
- Store + Inventory + Wallets → "School store"
- Payroll + Staff leave → "HR & Payroll"

**ARCHIVE/DEPRECATE (low usage):**

- Custom reports (basic reports cover most)
- Board report (duplicate of reports)
- Dropout tracking (can add to student status)
- Student lookup (redundant with students search)
- Analytics (most data in main dashboard)

### Quick Fixes for Efficiency

1. **Global search** - One search bar finds everything
2. **Quick actions** - FAB/menu for common actions
3. **Unified navigation** - Max 2 levels deep
4. **Mobile-first** - Bottom nav for key actions
5. **Lazy loading** - Load data on demand only
6. **Cache aggressively** - Reduce API calls

---

## PRIORITY IMPROVEMENTS

### P0 (Critical - ship this week)

1. Fix AOI scores in grades (add column to grades table)
2. New curriculum report template option
3. Remove 10 least-used pages from navigation

### P1 (Important - ship this month)

4. Implement generic skills tracking
5. Add competency comments to reports
6. Consolidate similar pages
7. Add global search

### P2 (Nice to have - ship this quarter)

8. Add Subject Observation Checklist
9. Mobile optimization pass
10. Performance optimization
11. UX consistency pass

---

_Last Updated: April 2026_

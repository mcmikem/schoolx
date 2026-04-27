# OMUTO SYSTEM AUDIT REPORT

## EXECUTIVE SUMMARY

| Category               | Count  |
| ---------------------- | ------ |
| HIGH Priority Issues   | 37     |
| MEDIUM Priority Issues | 12     |
| LOW Priority Issues    | 5      |
| **Total Issues**       | **54** |

---

## 1. BROKEN/INCOMPLETE CRUD OPERATIONS

### Missing GET Handlers (API Routes)

| File                             | Missing                          |
| -------------------------------- | -------------------------------- |
| `/api/users/route.ts`            | GET handler to fetch users       |
| `/api/schools/route.ts`          | GET, PUT, DELETE handlers        |
| `/api/reports/route.ts`          | GET, class reports, term reports |
| `/api/payment/invoices/route.ts` | POST, PUT, DELETE                |
| `/api/sms/route.ts`              | GET to retrieve sent messages    |

### Missing CRUD Operations

- **Students add page** - Just redirects, doesn't have actual form
- **Import API** - No batch processing, processes one by one (slow)

---

## 2. CRITICAL: EMPTY CATCH BLOCKS (Silent Failures)

**22 files** have empty catch blocks that silently swallow errors:

| File                         | Issue                                        |
| ---------------------------- | -------------------------------------------- |
| `proxy.ts`                   | HIGH - Auth errors swallowed                 |
| `supabase.ts`                | HIGH - Connection errors hidden              |
| `africas-talking.ts`         | HIGH - SMS failures ignored                  |
| `paypal.ts`                  | HIGH - Payment errors lost                   |
| `api-utils.ts`               | HIGH - API errors not reported               |
| `auto-report-cards/route.ts` | HIGH - Report generation errors not notified |
| `forgot-password/route.ts`   | HIGH - Password reset errors silent          |

---

## 3. DATABASE QUERIES AT RISK

### Performance Issues

- **N+1 Query Problem** - auto-report-cards fetches grades/attendance per student separately
- **No Pagination** - Fee payments query returns all records (will lag with 1000s of payments)
- **Missing Filters** - Attendance history doesn't filter by academic_year
- **No Index Assumptions** - Sync API assumes indexes exist

### Type Safety Issues

- Multiple `as unknown as` casts masking runtime errors

---

## 4. SECURITY ISSUES

### Missing RLS Policies

Tables without proper Row Level Security:

- `classes` - No RLS
- `subjects` - No RLS
- `notices` - No RLS
- `events` - No RLS
- `grades` - Incomplete
- `attendance` - Incomplete

### Other Security

- **Rate Limiter** - In-memory store not shared across serverless instances
- **CSRF Protection** - Optional, many endpoints unprotected
- **Service Role Overuse** - Bypasses RLS on many endpoints

---

## 5. INCOMPLETE PROCESSES

| Process              | Issue                                               |
| -------------------- | --------------------------------------------------- |
| Student Photo Upload | Could infinite loop if column keeps changing        |
| Fee Payment          | No validation fee_id exists before creating payment |
| Auto-Promotion       | No rollback if partially fails                      |
| Payment Checkout     | No validation plan is valid PlanType                |
| Student Create       | Race condition between check and insert             |
| Class Create         | No duplicate name check                             |

---

## 6. MISSING ERROR HANDLING

- `attendance.ts` - Errors caught but not propagated to UI
- `grades.ts` - No error state maintained
- `auto-report-cards` - Email failures logged but no admin notification

---

## 7. OTHER ISSUES

- **Offline Sync** - No conflict resolution strategy
- **Demo Mode** - State could leak when switching to real school
- **Dashboard** - No loading states, blank screen possible
- **Type Safety** - Many endpoints return `any` types

---

## RECOMMENDED FIXES (Priority Order)

### 1. Fix Empty Catch Blocks

Add proper error logging/reporting in all 22 locations

### 2. Add Missing API Handlers

- GET handler for /users, /schools, /reports, /invoices, /sms

### 3. Fix Database Queries

- Add pagination to fee payments
- Add academic_year filter to attendance
- Fix N+1 in auto-report-cards

### 4. Add RLS Policies

Secure: classes, subjects, notices, events tables

### 5. Add Transaction Safety

Wrap related operations in transactions

---

**Audit Date**: April 2026
**Auditor**: System Analysis

# Login/Registration Issues - Root Cause Analysis & Prevention

## Executive Summary

This document tracks the recurring login/registration issues in the Omuto School Management System, their root causes, and measures to prevent regression.

---

## Issue History

### Issue 1: Session Timeout Code Breaking Login

**Date**: April 2026
**Severity**: Critical

**Symptoms**:

- Login page stuck on loading spinner
- "Router action dispatched before initialization" error in browser console

**Root Cause**:
Added session timeout code in `auth-context.tsx` that incorrectly called `signOut()` function before it was defined (function defined at line 740, but useEffect tried to call it at line 575).

**Fix Applied**:

- Removed the broken session timeout code
- Functionality temporarily disabled until properly implemented

**Prevention**:

- Always ensure functions are defined before being referenced in React hooks
- Use function refs for forward references
- Add proper dependency arrays

---

### Issue 2: Missing reset-password Route

**Date**: April 2026
**Severity**: High

**Symptoms**:

- Password reset functionality missing

**Root Cause**:
The reset-password API route file was missing from the codebase

**Fix Applied**:

- Created `/src/app/api/reset-password/route.ts`
- Added proper token validation against password_reset_tokens table

**Prevention**:

- Document all required API routes in this file

---

### Issue 3: Manual User Creation with Wrong Password Hash

**Date**: April 2026
**Severity**: High

**Symptoms**:

- User 0777777777 created manually couldn't login
- Supabase returned "Invalid login credentials"

**Root Cause**:
Manually inserted user record with plain text password instead of bcrypt hash. Supabase stores passwords as bcrypt hashes, not plain text.

**Fix Applied**:

- Created user via Supabase Admin API (`createUser`) which properly hashes passwords

**Prevention**:

- NEVER manually insert users with plain text passwords
- ALWAYS use Supabase Admin API for user creation
- Document this in onboarding guide

---

### Issue 4: Registration API Hanging

**Date**: April 2026
**Severity**: Critical

**Symptoms**:

- Registration API requests hang/timed out
- curl returned no response

**Root Cause**:
Unknown - possibly:

1. Missing RLS policies blocking inserts
2. Database table missing columns
3. Infinite loop in API code
4. Missing Supabase local services

**Investigation Steps Taken**:

- Supabase auth API working via direct curl
- Build passes without errors
- Clean rebuild didn't help

**Current Status**: UNRESOLVED - requires deeper investigation

---

## Current System State

### What Works

| Component           | Status     | Notes                     |
| ------------------- | ---------- | ------------------------- |
| Supabase Auth API   | ✅ Working | Direct curl works         |
| User Signup via API | ✅ Working | test1@omuto.org can login |
| Build               | ✅ Passing | No TypeScript errors      |
| Dashboard Pages     | ✅ Loading | Static pages compile      |

### What Doesn't Work

| Component          | Status            | Notes                        |
| ------------------ | ----------------- | ---------------------------- |
| Registration API   | ❌ Hanging        | POST /api/register times out |
| Next.js API Routes | ❌ Not responding | curl returns empty           |
| Dev Server         | ⚠️ Unstable       | Shows errors                 |

---

## Required API Routes Checklist

All these routes MUST exist and work:

```
/api/register        - School registration
/api/login          - User login (uses auth-context, no route needed)
/api/forgot-password - Password reset request
/api/reset-password - Password reset confirm
/api/schools        - School data
/api/users          - User management
/api/students       - Student CRUD
/api/attendance     - Attendance records
/api/grades         - Grade management
/api/fees           - Fee management
/api/sms            - SMS sending
```

---

## Database Schema Requirements

### Required Tables (must exist and have RLS policies)

```sql
-- Users table (critical for login)
users (
  id              UUID PRIMARY KEY,
  auth_id         UUID NOT NULL REFERENCES auth.users(id),
  school_id       UUID REFERENCES schools(id),
  phone           TEXT UNIQUE NOT NULL,
  full_name       TEXT NOT NULL,
  role            TEXT NOT NULL,
  is_active       BOOLEAN DEFAULT true
)

-- Password reset tokens
password_reset_tokens (
  id              UUID PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users(id),
  token_hash      TEXT UNIQUE NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  used_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
)

-- Security events (for audit)
security_events (
  id              UUID PRIMARY KEY,
  user_id         UUID REFERENCES users(id),
  event_type      TEXT NOT NULL,
  ip_address      TEXT,
  details         JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
)
```

---

## Debugging Checklist

When login/registration breaks, check these in order:

### 1. Verify Supabase Running

```bash
npx supabase status
# Should show: "local development setup is running"
```

### 2. Test Auth API Directly

```bash
curl -X POST "http://127.0.0.1:54321/auth/v1/signup" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123"}'
```

### 3. Check Database Tables Exist

```bash
npx supabase db query "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
```

### 4. Check Users Table Has Data

```bash
npx supabase db query "SELECT id, phone, full_name FROM users LIMIT 5;"
```

### 5. Check Auth Users Match

```bash
npx supabase db query "SELECT id, email FROM auth.users LIMIT 5;"
```

### 6. Test Login Via API

```bash
curl -X POST "http://127.0.0.1:54321/auth/v1/token?grant_type=password" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123"}'
```

---

## Prevention Measures

### 1. Never Add Code That References Functions Before Definition

```javascript
// BAD - references signOut before it's defined
useEffect(() => {
  await signOut();  // ERROR: signOut not defined yet
}, []);

async function signOut() { ... }

// GOOD - use ref or define first
async function signOut() { ... }
useEffect(() => {
  signOut(); // OK - function already defined
}, []);
```

### 2. Always Use Supabase Admin API for User Creation

```javascript
// BAD
await supabase.from('auth.users').insert({ ... })

// GOOD
await supabase.auth.admin.createUser({
  email: 'user@omuto.org',
  password: 'password123'
})
```

### 3. Add Timeout to All API Routes

```javascript
export async function POST(request: NextRequest) {
  // Always wrap in try/catch
  try {
    // your code
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Register Error]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

### 4. Add Logging to Every API Route

```javascript
console.log("[Register] Starting...");
console.log("[Register] Creating user:", { phone, name });
// ... step by step
console.log("[Register] Complete");
```

### 5. Test Registration After Any Code Change

```bash
# Quick test
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"schoolName":"Test","district":"K","subcounty":"C","schoolType":"primary","ownership":"private","adminName":"T","adminPhone":"0777000000","password":"Test123"}'
```

### 6. Keep Logged-In User for Testing

Don't delete the test user after testing - keep at least one working user for debugging:

- Email: test1@omuto.org
- Password: Pass123

---

## Rollback Procedure

If login breaks after a commit:

1. **Check last commit changes**:

   ```bash
   git log --oneline -5
   git diff HEAD~1
   ```

2. **Revert specific files**:

   ```bash
   git checkout HEAD~1 -- src/lib/auth-context.tsx
   ```

3. **Rebuild and test**:
   ```bash
   npm run build
   npm run dev
   ```

---

## Contact for Critical Issues

- **Technical Lead**: Review all auth-related PRs
- **Database Admin**: Check RLS policies and table schemas
- **DevOps**: Verify Supabase local services

---

**Document Version**: 1.0
**Last Updated**: April 2026
**Maintained By**: Development Team

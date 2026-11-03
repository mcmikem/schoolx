# EGM Comprehension App Review

**Target:** `/Users/me/schoolx-git/README.md`  
**Score:** 5/10

## What this proposes

The README presents an offline-first Ugandan school-management platform with student, attendance, academic, fee, staff, communication, UNEB, parent, payment, and SMS features. It also gives basic setup, environment, deployment, testing, structure, subscription, and security information.

## How the existing system works, per this document

A developer installs dependencies, configures Supabase and third-party providers, and starts a Next.js application. Supabase supplies database and authentication services, while external providers handle payments and messaging. Selected workflows use IndexedDB offline, and subscription tiers control capabilities.

## Major comprehension gaps

- Product identity is split across Omuto, SchoolX, and SkoolMate OS.
- Subscription names, limits, and entitlements do not match current billing code.
- Demo credentials do not explain required development flags and appear stale.
- Offline scope, queued writes, data freshness, and online-only operations are not defined.
- Supabase setup, migration, seed, authentication, and onboarding steps are missing.
- Environment variables are not classified by required/optional integration or route.
- Quality gates omit typecheck, regression, auth, E2E, offline, schema, leakage, secret, and release checks.
- Primary role-based workflows and terms such as UNEB, RLS, MoMo, CSRF, and cron are undefined.

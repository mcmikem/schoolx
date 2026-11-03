# EGM Style App Review

**Target:** `/Users/me/schoolx-git/README.md`  

The README is concise but several claims are broader than the implementation evidence or materially stale.

## Blocker

- Demo credentials are presented as generally usable without their required safeguards.

## Major findings

- “Real-time” parent progress is inaccurate; the reviewed implementation polls.
- “Offline-first” is unqualified even though billing, payments, SMS, imports, AI, UNEB, and reporting include online-only paths.
- The subscription table conflicts with current plan names, limits, pricing allocation, and entitlements.
- UNEB registration and reporting claims combine capabilities not all verified by the inspected code.
- Automatic SMS claims omit provider, plan, contact-data, scheduling, and fallback prerequisites.
- Payment-provider wording does not distinguish subscription billing, school fees, and mobile-money paths.
- Security claims do not define coverage or link to a security contract.
- Product identity is inconsistent.
- “Comprehensive” is subjective and not bounded.

## Editorial actions

Calibrate product claims to verified behavior, remove or isolate demo credentials, replace the stale pricing matrix, and link detailed architecture/security documents from the README.

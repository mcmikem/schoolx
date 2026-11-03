# EGM Zoom-Out App Review

**Target:** `/Users/me/schoolx-git/README.md` and the repository implementation  
**Score:** 5.5/10

The product has a clear Uganda-focused school-management direction and substantial implementation, including offline support, tenant boundaries, billing, and domain services. The main weakness is uncontrolled breadth: it now resembles an ERP with many deployment surfaces and overlapping domain models.

## Major findings

- The product scope includes payroll, inventory, dormitories, transport, health, marketing, AI, billing, and multiple portals beyond the README's core workflow.
- Offline mode is a second persistence and synchronization architecture. Its supported tables, conflict rules, and online-only boundaries need an explicit product boundary.
- Several domains have competing representations, including academic terms, grades, fees, payments, and timetable data.
- Billing has multiple plan vocabularies and compatibility layers, making entitlements difficult to reason about.
- Web, PWA, Android, iOS, Docker, Cloudflare, several payment providers, SMS, AI, and offline sync create a large operational surface.
- The README does not identify a primary user workflow or distinguish core modules from optional modules.

## Highest-value simplifications

1. Define the primary school operating loop.
2. Mark optional ERP modules separately.
3. Select canonical models for terms, fees, payments, timetable, and billing.
4. Bound offline support to named workflows.
5. Use one canonical plan vocabulary.

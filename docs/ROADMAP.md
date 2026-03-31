# Omuto School Management System - Roadmap

## Version 1.0 MVP (Minimum Viable Product)

**Target:** Single-teacher primary/secondary school (Uganda)
**Release Goal:** End-to-end working core flow

### Phase 1: Core Foundation (Weeks 1-2)
- [x] Auth (login/register)
- [x] School setup wizard
- [x] Student CRUD (add, view, edit)
- [x] Class management
- [ ] Student import (CSV)

### Phase 2: Daily Operations (Weeks 3-4)
- [ ] Daily attendance (by class)
- [ ] Attendance reports (% per class)
- [ ] Teacher navigation (limited view)

### Phase 3: Academics (Weeks 5-6)
- [ ] Subject management
- [ ] Grade entry (CA1-CA4)
- [ ] Simple report card (text-based)

### Phase 4: Finance (Weeks 7-8)
- [ ] Fee structure setup
- [ ] Record payments
- [ ] Payment receipts
- [ ] Basic fee reports

---

## Version 1.1 - First Real Users

### Adds:
- Parent portal (view grades, attendance, fees)
- SMS notifications (Africa's Talking)
- Export to CSV/Excel

---

## Version 1.2 - Scale

### Adds:
- Multi-user roles (headmaster, teacher, bursar)
- Exam management
- UNEB report exports
- Budget & expenses

---

## Version 2.0 - Full Suite

### Adds everything else:
- Payroll
- Inventory
- Library
- Timetable
- Dorm management
- Health records
- Analytics dashboard

---

## Prioritization Rules

1. **Never add feature before core works** - If attendance breaks, nothing else matters
2. **One primary user first** - Start with headmaster/principal view only
3. **Simplest path first** - Print PDF before digital signatures
4. **Offline first** - Many schools have bad connectivity

---

## What NOT to Build (Yet)

- ❌ Multiple payment providers (Stripe/PayPal) - Just do bank transfer + mobile money
- ❌ Subscription/paywall - Launch free, add billing later
- ❌ Advanced analytics - Basic counts first
- ❌ API for third-party integrations
- ❌ Mobile apps - PWA is enough

---

## Success Metrics for MVP

- [ ] Can register a new school in < 3 minutes
- [ ] Can add 100 students via CSV
- [ ] Can take attendance for a class in < 2 minutes
- [ ] Can enter grades for 30 students in < 5 minutes
- [ ] Can generate a report card in < 30 seconds
- [ ] Can record a payment and print receipt
- [ ] Works offline (data saves locally)
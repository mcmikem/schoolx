# PLAN.md - Omuto Ultimate Suite Phase 2

## 🎯 Executive Summary
This phase focuses on the **Commercial & Analytical** core of the school. We are building a high-fidelity School Store/Canteen POS, a Student Digital Wallet (Pocket Money), and a "Performance DNA" analytics engine.

---

## 🛠️ Phase 1: Foundation (Database & API)
**Agent:** `database-architect` + `backend-specialist`

### 1. Unified Commerce Schema
- [ ] **Table:** `canteen_items` (Inventory management, prices, stock levels)
- [ ] **Table:** `student_wallets` (Balance tracking for students)
- [ ] **Table:** `wallet_transactions` (Top-up logs, canteen spending)
- [ ] **Table:** `canteen_sales` (Detailed logs of items sold)

### 2. Business Logic
- [ ] **Wallet Spend Protection**: Check balance before POS transaction.
- [ ] **Inventory Sync**: Auto-deduct stock on sale.
- [ ] **Daily Reconciliation**: Report for school bursar on canteen revenue.

---

## 🎨 Phase 2: User Experience (The "Pro Max" UI)
**Agent:** `frontend-specialist` + `ui-ux-pro-max`

### 1. School Store POS
- [ ] **Quick Search/Select UI**: Optimized for high-speed canteen queues.
- [ ] **Student QR Scanner**: Scan student IDs (from our new ID cards!) to fetch wallet balance instantly.
- [ ] **Inventory Dashboard**: Management view for adding/updating items.

### 2. Digital Wallet (Parent/Student View)
- [ ] **Parent Portal Integration**: Allow parents to top up pocket money via mobile money.
- [ ] **Spend Limits**: Let parents set daily spending limits (e.g., max 2,000 UGX per day).

---

## 📈 Phase 3: Performance DNA Analytics
**Agent:** `performance-optimizer` + `frontend-specialist`

### 1. Student Performance DNA
- [ ] **Visual Multi-Axis Analysis**: Grades + Attendance + Discipline + Store Spending (social/health context).
- [ ] **Predictive Alerts**: Alert staff if a student's grades drop *and* their spending patterns change significantly (holistic welfare).

---

## 📡 Phase 4: Reliability & Offline Support
**Agent:** `performance-optimizer` + `devops-engineer`

### 1. Offline POS Resilience
- [ ] **IndexedDB Store**: Queue transactions locally if internet drops.
- [ ] **Background Sync**: Auto-push queued sales when connection returns.

---

## ✅ Verification Criteria
- [ ] POS transaction takes < 2 seconds.
- [ ] Wallet balance updates in real-time across both Portals.
- [ ] PDF receipts generated for canteen purchases.
- [ ] "Conduct vs Grades" correlation chart visible in Student Profile.

---

## 🔴 DO NOT COMMENCE PHASE 2 WITHOUT USER APPROVAL.

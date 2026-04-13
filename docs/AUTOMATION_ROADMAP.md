# SkoolMate OS — Automation Opportunities

## Current Automations (Already Implemented)

| Automation             | Status | Trigger                   |
| ---------------------- | ------ | ------------------------- |
| Fee reminders          | ✅     | Daily SMS when fee due    |
| Attendance alerts      | ✅     | SMS when student absent   |
| Report card generation | ✅     | End of term auto-generate |
| Fee receipts           | ✅     | Instant on payment        |
| Student promotion      | ✅     | End of year bulk          |
| UNEB registration      | ✅     | Bulk register candidates  |

---

## HIGH IMPACT AUTOMATIONS (Quick to Implement)

### 1. Automated Daily Reports

```
→ Daily attendance summary to headteacher (6PM)
→ Daily fee collection report to bursar
→ Daily meal count to canteen
```

### 2. Proactive Alerts

```
→ Student absent 3+ days → Auto-notify warden/parent
→ Fee overdue 30+ days → Auto-reminder + escalation
→ Low inventory → Auto-reorder alert
→ Teacher absent → Auto-find substitute
```

### 3. Academic Automations

```
→ Auto-calculate class positions after grades entered
→ Auto-generate progress reports mid-term
→ Auto-flag students failing (>2 subjects)
→ Auto-promote after rollover
```

### 4. Financial Automations

```
→ Auto-reconcile payments daily
→ Auto-generate monthly financial reports
→ Auto-send invoice to parents start of term
→ Auto-apply late fees after grace period
```

---

## MEDIUM IMPACT AUTOMATIONS

### 5. Communication Flows

```
→ Welcome SMS on student admission
→ Birthday wishes to students (monthly)
→ Term start reminder (7 days before)
→ Exam timetable auto-notify
```

### 6. Staff Automations

```
→ Auto-generate payslips monthly
→ Leave request auto-approve/notify
→ Staff birthday reminders
→ Performance review reminders
```

### 7. Parent Engagement

```
→ Auto-send report card via SMS link
→ Auto-login link on student admission
→ Auto-notify on grade updates
```

---

## ADVANCED AUTOMATIONS (Future)

### 8. AI-Powered

```
→ Predict students at risk of dropping out
→ Recommend grade boundaries based on trends
→ Suggest optimal class sizes
→ Staff allocation optimization
```

### 9. Workflow Automations

```
→ New teacher onboarding checklist
→ Student transfer workflow
→ Complaint resolution tracking
→ Annual rollover workflow
```

---

## IMPLEMENTATION PRIORITY

| Priority | Automation                  | Impact | Effort |
| -------- | --------------------------- | ------ | ------ |
| P0       | Daily attendance SMS        | High   | Low    |
| P0       | Fee overdue alerts          | High   | Low    |
| P0       | Fee collection summary      | High   | Low    |
| P1       | Auto-positions after grades | Medium | Medium |
| P1       | Low inventory alerts        | Medium | Low    |
| P1       | Student at-risk alerts      | High   | Medium |
| P2       | Parent engagement flows     | Medium | Medium |
| P2       | Monthly reports auto-send   | Medium | Low    |
| P3       | AI predictions              | High   | High   |

---

## RECOMMENDED TO BUILD NOW (P0)

### 1. Daily Attendance SMS to Headteacher

```
Trigger: 6PM daily
Action: Send SMS with:
- Total present/absent today
- List of absent students
- Comparison to yesterday
```

### 2. Fee Collection Auto-Summary

```
Trigger: 7AM daily
Action: Send to bursar:
- Total collected yesterday
- Total pending
- Top 10 defaulters
```

### 3. Overdue Fee Auto-Reminder

```
Trigger: Daily at 9AM for overdue 30+ days
Action: Send escalating SMS:
- Day 30: Friendly reminder
- Day 60: Urgent + class teacher cc
- Day 90: Headteacher involvement
```

---

## TECHNICAL REQUIREMENTS

### Database Jobs Table

```sql
CREATE TABLE automation_jobs (
  id UUID PRIMARY KEY,
  name TEXT,
  trigger_type TEXT, -- cron, event, manual
  trigger_config JSONB,
  action_type TEXT,  -- sms, email, webhook
  action_config JSONB,
  enabled BOOLEAN DEFAULT true,
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Job Runner (Edge Function)

- Run every minute via cron
- Check `next_run <= now()` and `enabled = true`
- Execute action
- Update `last_run` and calculate `next_run`

---

_April 2026_

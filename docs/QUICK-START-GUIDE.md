# OMUTO SCHOOL MANAGEMENT SYSTEM

## Quick Start Guide for New Schools

---

## FIRST WEEK SETUP CHECKLIST

Use this checklist to get your school running in the first week.

### Day 1: Account Setup

- [ ] Register your school at registration URL
- [ ] Login with your phone and password
- [ ] Complete school profile (Settings > School)
- [ ] Upload school logo
- [ ] Set primary brand color
- [ ] Test demo mode to explore features

### Day 2: Academic Structure

- [ ] Add academic year (Settings > Academic Terms)
- [ ] Create terms with dates
- [ ] Set current term
- [ ] Create all classes (Settings > Classes)
  - Example: P.1, P.2, S.1, S.2, etc.
- [ ] Add streams if needed (e.g., S.1 East, S.1 West)

### Day 3: Curriculum Setup

- [ ] Add subjects (Settings > Subjects)
- [ ] Allocate subjects to each class
- [ ] Assign teachers to subjects
- [ ] Review Uganda curriculum templates auto-loaded

### Day 4: Financial Setup

- [ ] Set fee structure (Fees > Fee Structure)
- [ ] Create fee categories:
  - Tuition
  - Activity Fees
  - Boarding (if applicable)
  - Uniform
- [ ] Set due dates
- [ ] Configure payment methods

### Day 5: Staff Setup

- [ ] Add all staff (Staff > Add Staff)
- [ ] Assign roles
- [ ] Set class teacher assignments
- [ ] Test login for each staff member

### Day 6-7: Student Enrollment

- [ ] Add students (Students > Add New)
- [ ] Or import bulk via CSV
- [ ] Verify student photos upload
- [ ] Assign students to classes
- [ ] Test parent access

---

## COMMON PROCESSES

### Process 1: New Student Enrollment

```
1. Go to: Students > Add New
2. Fill student details
3. Upload photo (optional)
4. Select class enrollment
5. Add parent/guardian info
6. Submit
7. Confirm enrollment
8. Parent receives SMS with login details
```

### Process 2: Recording Daily Attendance

```
1. Go to: Attendance > Daily Attendance
2. Select today's date
3. Select class
4. For each student, mark status:
   - P = Present (green)
   - A = Absent (red)
   - L = Late (yellow)
5. Add remarks for absentees
6. Click SUBMIT
7. System sends SMS to parents of absent students
```

### Process 3: Recording a Fee Payment

```
1. Go to: Fees > Record Payment
2. Search student by name/phone
3. See outstanding balance
4. Enter payment amount
5. Select payment method:
   - Cash
   - MTN Mobile Money
   - Airtel Money
   - Bank Transfer
6. Enter reference number
7. Click RECORD PAYMENT
8. Print receipt (optional)
```

### Process 4: Entering Exam Grades

```
1. Go to: Grades > Enter Grades
2. Select: Term 1, 2024
3. Select: Class (e.g., S.2)
4. Select: Subject (e.g., Mathematics)
5. Select: Assessment (e.g., End of Term Exam)
6. Enter scores for each student
7. Click SUBMIT
8. Repeat for each subject
```

### Process 5: Generating Report Cards

```
1. Go to: Grades > Report Cards
2. Select: Term 1
3. Select: Class
4. Click: Generate All Reports
5. Preview each student
6. Click: Download All (PDF)
7. Or: Print Individual
```

### Process 6: Creating Timetable

```
1. Go to: Timetable > Period Settings
2. Define school periods (e.g., 7 periods + breaks)
3. Go to: Timetable > Allocations
4. Assign subjects to classes
5. Assign teachers to subjects
6. Go to: Timetable > Class Timetable
7. Click each slot to assign subject/teacher
8. Save when complete
```

### Process 7: Student Transfer Out

```
1. Go to: Students > Transfers
2. Click: New Transfer
3. Select: Transfer Out
4. Search and select student
5. Enter:
   - Destination school name
   - Transfer date
   - Reason (dropdown menu)
   - Optional remarks
6. Click: Confirm Transfer
7. System updates student status
8. Record remains for records
```

### Process 8: Student Promotion

```
1. Go to: Students > Enrollments
2. Select: Source Class (e.g., P.6)
3. Click: Promote Students
4. Select: Target Class (e.g., P.7)
5. System shows all enrolled students
6. Uncheck students not promoting
7. Click: Confirm Promotion
8. Students enrolled in new class
```

### Process 9: Staff Leave Request

```
FOR STAFF:
1. Go to: Staff > Leave
2. Click: Request Leave
3. Select leave type
4. Select dates (from/to)
5. Add reason
6. Submit for approval

FOR APPROVER:
1. Go to: Leave Approvals
2. See pending requests
3. Click request to review
4. Approve or Reject
5. Add comment
6. Submit
```

### Process 10: SMS to Parents

```
SINGLE SMS:
1. Go to: SMS > Send SMS
2. Enter phone number
3. Type message
4. Click Send

BULK SMS:
1. Go to: SMS > Bulk SMS
2. Select recipients (class or all parents)
3. Type message using variables:
   {student_name} - inserts student name
   {parent_name} - inserts parent name
   {amount} - inserts fee amount
4. Preview message
5. Click Send
```

---

## ROLE-BASED QUICK REFERENCE

### Headmaster / School Admin

| Task             | Location         |
| ---------------- | ---------------- |
| View dashboard   | /dashboard       |
| Manage staff     | /staff           |
| Approve leave    | /leave-approvals |
| View all reports | /reports         |
| Settings         | /settings        |
| SMS              | /bulk-sms        |

### Class Teacher

| Task             | Location       |
| ---------------- | -------------- |
| Take attendance  | /attendance    |
| Enter grades     | /grades        |
| View class list  | /students      |
| View timetable   | /timetable     |
| Student profiles | /students/[id] |

### Bursar / Finance

| Task             | Location       |
| ---------------- | -------------- |
| Record payments  | /fees          |
| View cashbook    | /cashbook      |
| Fee structure    | /fees          |
| Student balances | /fees          |
| Payment plans    | /payment-plans |
| Budget           | /budget        |

### Dean of Studies

| Task                | Location     |
| ------------------- | ------------ |
| Academic reports    | /reports     |
| Timetable           | /timetable   |
| Subject allocations | /allocations |
| Exam schedules      | /exams       |
| Grading             | /grades      |
| UNEB reports        | /uneb        |

### Parent

| Task            | Location    |
| --------------- | ----------- |
| View academics  | /academics  |
| View attendance | /attendance |
| View fees       | /fees       |
| Messages        | /messages   |
| Notices         | /notices    |

---

## ERROR MESSAGES - SOLUTIONS

| Error Message               | Likely Cause               | Solution                               |
| --------------------------- | -------------------------- | -------------------------------------- |
| "Invalid login credentials" | Wrong phone/password       | Use "Forgot Password" or contact admin |
| "User not found"            | Phone not registered       | Check with school admin                |
| "Session expired"           | Inactivity timeout         | Login again                            |
| "No classes found"          | No class created           | Create classes in Settings             |
| "No subjects allocated"     | Subject not added to class | Go to Allocations                      |
| "Student not in this class" | Wrong enrollment           | Re-enroll student                      |
| "Duplicate entry"           | Student already exists     | Check existing records                 |
| "Insufficient SMS balance"  | SMS credits exhausted      | Contact school admin                   |
| "Payment reference exists"  | Reference already used     | Use different reference                |
| "Offline - changes saved"   | No internet                | Data syncs when online                 |

---

## KEY FIGURES AND CONTACTS

| Purpose           | Contact             |
| ----------------- | ------------------- |
| Technical Support | support@omuto.org   |
| Sales/Billing     | billing@omuto.org   |
| Training          | training@omuto.org  |
| Emergency         | emergency@omuto.org |

---

## MOBILE APP TIPS

### For Android Users

1. Open school website in Chrome
2. Tap menu (3 dots)
3. "Add to Home Screen"
4. App appears like native app

### For iPhone Users

1. Open school website in Safari
2. Tap Share button
3. "Add to Home Screen"
4. Icon appears on home screen

### Offline Usage

- App works offline for viewing
- Changes sync when connected
- Orange banner shows "Offline Mode"

---

_Keep this guide accessible for new staff onboarding_

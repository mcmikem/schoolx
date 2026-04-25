# OMUTO SCHOOL MANAGEMENT SYSTEM

## Complete User Manual for Schools and Teachers

---

# TABLE OF CONTENTS

1. [Getting Started](#1-getting-started)
2. [Dashboard Overview](#2-dashboard-overview)
3. [Student Management](#3-student-management)
4. [Staff Management](#4-staff-management)
5. [Attendance Management](#5-attendance-management)
6. [Grades and Examinations](#6-grades-and-examinations)
7. [Fees and Financial Management](#7-fees-and-financial-management)
8. [Timetable and Scheduling](#8-timetable-and-scheduling)
9. [Reports and Analytics](#9-reports-and-analytics)
10. [SMS and Communication](#10-sms-and-communication)
11. [Parent Portal](#11-parent-portal)
12. [Library Management](#12-library-management)
13. [Inventory and Store](#13-inventory-and-store)
14. [Dormitory Management](#14-dormitory-management)
15. [Health and Welfare](#15-health-and-welfare)
16. [Settings and Configuration](#16-settings-and-configuration)
17. [Automation and Workflows](#17-automation-and-workflows)
18. [Troubleshooting](#18-troubleshooting)

---

# 1. GETTING STARTED

## 1.1 Account Setup

### For New Schools

1. Visit your school registration URL
2. Fill in school details:
   - **School Name** - Official school name
   - **District** - Select from dropdown
   - **Subcounty** - Select from dropdown
   - **School Type** - Primary / Secondary / Combined
   - **Ownership** - Private / Government / Government-Aided
3. Create admin account:
   - **Your Name** - Full name
   - **Phone Number** - Primary contact (used for login)
   - **Password** - Minimum 8 characters with uppercase and number
4. Your school code is auto-generated (e.g., DEMOKLA123)
5. You'll receive 30-day free trial

### Logging In

1. Go to your school login URL
2. Enter **Phone** or **Email**
3. Enter **Password**
4. Click "Sign In"

**Demo Mode**: Click "Try Demo" to explore with sample data

## 1.2 First-Time Setup Checklist

After first login, complete these steps:

- [ ] Add Academic Terms (Settings > Academic Terms)
- [ ] Create Classes (Settings > Classes)
- [ ] Add Subjects (Settings > Subjects)
- [ ] Allocate Subjects to Classes (Timetable > Allocations)
- [ ] Set Fee Structure (Fees > Fee Structure)
- [ ] Add Student Photos (optional)
- [ ] Invite Staff (Settings > Users)

---

# 2. DASHBOARD OVERVIEW

## 2.1 Navigation

**Desktop**: Sidebar navigation (left)
**Mobile**: Bottom navigation bar + hamburger menu

### Quick Stats Cards

Top of dashboard shows:

- Total Students
- Today's Attendance
- Pending Fees
- Recent Messages

### Role-Based Views

Your role determines what you see:

- **Headmaster/Admin**: Full dashboard with all modules
- **Teacher**: Classes, Attendance, Grades focus
- **Bursar**: Fees, Payroll, Reports
- **Dean of Studies**: Academics, Timetable, Grades

## 2.2 Notifications Bell

Click the bell icon to see:

- Attendance alerts
- Fee payment notifications
- Leave requests pending approval
- System announcements

## 2.3 Profile Menu

Top-right corner shows your:

- Name and role
- School name
- Quick links: Settings, Profile, Sign Out

---

# 3. STUDENT MANAGEMENT

## 3.1 Adding New Students

**Path**: `Students > Add New`

### Required Information

| Field                | Description                   |
| -------------------- | ----------------------------- |
| First Name           | Student's first name          |
| Last Name            | Student's surname             |
| Gender               | Male / Female                 |
| Date of Birth        | Calendar picker               |
| Class                | Select from enrolled classes  |
| Admission Date       | Today's date or specific date |
| Parent/Guardian Name | Full name                     |
| Parent Phone         | Active mobile number          |
| Address              | Physical location             |

### Optional Information

- Second Parent Phone
- Student Number (auto-generated if left blank)
- PLE Index Number (Primary 7 only)
- Religion, Nationality
- Previous School
- Medical Conditions

### Photo Upload

1. Click camera icon
2. Select "Upload Photo" or "Take Photo"
3. Crop and adjust
4. Save

## 3.2 Importing Students in Bulk

**Path**: `Students > Import`

### Steps

1. Download CSV template
2. Fill in student data (one row per student)
3. Upload completed CSV
4. Review validation errors
5. Fix any issues shown
6. Confirm import

### CSV Template Columns

```
first_name,last_name,gender,date_of_birth,class,parent_name,parent_phone
```

## 3.3 Student Search

**Path**: `Student Lookup`

1. Enter phone number, name, or student ID
2. Results show matching students
3. Click to view full profile

## 3.4 Student Profile

**Path**: Click any student name

### Tabs in Profile

- **Overview**: Basic info, photo, contacts
- **Attendance**: Daily attendance history
- **Grades**: All subjects and terms
- **Fees**: Balance and payment history
- **Discipline**: Behavior records
- **Health**: Medical history
- **Documents**: Uploaded files

## 3.5 Student Transfers

**Path**: `Students > Student Transfers`

### Recording a Transfer Out

1. Click "New Transfer"
2. Select student
3. Choose "Transfer Out"
4. Enter destination school
5. Select reason (dropdown)
6. Add remarks if needed
7. Confirm

### Recording a Transfer In

1. Click "New Transfer"
2. Select "Transfer In"
3. Enter transfer details
4. Link to existing student or create new

## 3.6 Student Promotion

**Path**: `Students > Enrollments` or use Promotion feature

### Individual Promotion

1. Open student profile
2. Click "Promote"
3. Select new class
4. Confirm

### Bulk Promotion

1. Go to `Promotion` feature
2. Select source class
3. Select target class
4. Choose criteria (attendance %, grade average)
5. Preview students
6. Confirm promotion

---

# 4. STAFF MANAGEMENT

## 4.1 Adding Staff

**Path**: `Staff > Add Staff`

### Required Fields

- Full Name
- Phone Number
- Role (Teacher, Dean, Bursar, etc.)
- Email (optional)

### Role Definitions

| Role              | Access Level                     |
| ----------------- | -------------------------------- |
| Headmaster        | Full access to all features      |
| Deputy Headmaster | All except financial reports     |
| Dean of Studies   | Academics, Timetable, Grades     |
| Bursar            | Fees, Payroll, Financial Reports |
| Class Teacher     | Own class only                   |
| Teacher           | Own subjects and attendance      |
| Secretary         | Office, Messages, Visitors       |
| Dorm Master       | Dorm attendance and records      |

## 4.2 Staff Attendance

**Path**: `Staff > Staff Attendance`

### Marking Attendance

1. Select date
2. See all staff listed
3. Mark Present, Absent, or Late for each
4. Add remarks for absentees
5. Submit

### Viewing History

- Click any staff name
- View attendance calendar
- Download reports

## 4.3 Leave Management

**Path**: `Staff > Leave`

### Requesting Leave (Staff)

1. Click "Request Leave"
2. Select leave type:
   - Sick Leave
   - Annual Leave
   - Bereavement
   - Maternity/Paternity
   - Study Leave
3. Select dates
4. Add reason
5. Submit for approval

### Approving Leave (Headmaster/Admin)

1. Go to `Leave Approvals`
2. See pending requests
3. Click to view details
4. Approve or Reject
5. Add comment if rejecting

## 4.4 Staff Performance

**Path**: `Staff > Performance`

Track and evaluate:

- Teaching effectiveness
- Attendance records
- Student outcomes
- Professional development

---

# 5. ATTENDANCE MANAGEMENT

## 5.1 Student Daily Attendance

**Path**: `Attendance > Daily Attendance`

### Marking Attendance

1. Select Date (defaults to today)
2. Select Class
3. Select Stream/Section (if applicable)
4. See student list with photos
5. For each student, mark:
   - **Present** (green)
   - **Absent** (red)
   - **Late** (yellow) with arrival time
6. Add remarks for specific students
7. Submit attendance

### Quick Actions

- **Mark All Present** - One click
- **Mark All Absent** - One click (use sparingly)
- **Roll Call Mode** - Sequential marking

### Mobile/Tablet Tips

- Use landscape mode for better view
- Swipe left/right to navigate students
- Use filter to show only absent students

## 5.2 Period Attendance

**Path**: `Attendance > Period Attendance`

Track attendance per lesson period:

1. Select date
2. Select class
3. Select period
4. Mark each student
5. Submit

## 5.3 Attendance Reports

**Path**: `Attendance > Reports`

### Available Reports

- **Daily Summary** - Total present/absent/late
- **Class Comparison** - All classes side by side
- **Monthly Summary** - Monthly trends
- **At-Risk Students** - 14+ consecutive absences
- **Student History** - Individual attendance over time

### Export

Click "Export" to download PDF or Excel

## 5.4 Automated Attendance Alerts

System automatically:

- Identifies students with 14+ consecutive absences
- Flags as at-risk
- Alerts Headmaster via notification
- Can trigger parent SMS (if enabled)

---

# 6. GRADES AND EXAMINATIONS

## 6.1 Grading System Overview

### Assessment Types

| Type    | Weight                 | Description               |
| ------- | ---------------------- | ------------------------- |
| CA1-CA4 | 6.25% each             | Continuous Assessment     |
| Project | Included in CA         | Practical work            |
| AOI     | 20% (S1-S4)            | Activities of Integration |
| Exam    | 75% (old) / 80% (NCDC) | End of term               |

### Final Score Calculation

**Old System**: (Average CA × 0.25) + (Exam × 0.75)
**NCDC S1-S4**: (Average CA × 0.20) + (Exam × 0.80) + AOI

## 6.2 Entering Grades

**Path**: `Grades > Enter Grades`

### Steps

1. Select **Term**
2. Select **Class**
3. Select **Subject**
4. Select **Assessment Type** (CA1, CA2, Exam, etc.)
5. See student list
6. Enter score for each student
7. Set maximum score (default shown)
8. Submit

### Example Entry

- CA1 max: 20
- Enter each student's CA1 score
- System calculates average

## 6.3 UNEB Grading

### PLE (Primary Leaving Exam)

| Score Range | Grade | Division |
| ----------- | ----- | -------- |
| 4-9         | D1    | I        |
| 10-17       | D2    | I        |
| 18-25       | D3    | II       |
| 26-33       | D4    | II       |
| 34-41       | D5    | III      |
| 42-49       | D6    | IV       |
| 50-57       | D7    | IV       |
| 58-65       | D8    | U        |
| 66+         | F9    | U        |

### UCE/O-Level

| Score Range | Grade | Division |
| ----------- | ----- | -------- |
| 75-100      | D1    | I        |
| 70-74       | D2    | I        |
| 65-69       | D3    | II       |
| 60-64       | D4    | II       |
| 55-59       | D5    | III      |
| 50-54       | D6    | IV       |
| 45-49       | D7    | IV       |
| 40-44       | D8    | U        |
| 0-39        | F9    | U        |

### Best 8 Subjects for UCE

System automatically calculates best 8 subjects.

## 6.4 Report Cards

**Path**: `Grades > Report Cards`

### Generating Reports

1. Select Term
2. Select Class
3. Choose students (or all)
4. Click "Generate Reports"
5. Preview each student's report
6. Download as PDF

### Report Contents

- Student info and photo
- Attendance summary
- Subject grades with teacher comments
- Overall performance
- Class position
- Teacher remarks
- Principal signature placeholder

## 6.5 NCDC Competency Assessment (S1-S4)

### Competency Levels

| Level        | Description              |
| ------------ | ------------------------ |
| Mastered     | Exceeds expectations     |
| Demonstrates | Meets expectations       |
| Developing   | Approaching expectations |

### Cross-Cutting Themes

- Climate Change & Environment
- ICT & Digital Literacy
- Entrepreneurship
- Gender & Equity
- Health & Nutrition

---

# 7. FEES AND FINANCIAL MANAGEMENT

## 7.1 Fee Structure Setup

**Path**: `Fees > Fee Structure`

### Creating Fee Components

1. Click "Add Fee"
2. Enter:
   - Fee Name (e.g., "Term 1 Tuition")
   - Amount (UGX)
   - Class (or "All Classes")
   - Academic Year
   - Due Date
3. Save

### Fee Categories

- Tuition
- Boarding
- Activity Fees
- Examination Fees
- Uniform
- Transport
- Lunch Program
- Medical

## 7.2 Recording Payments

**Path**: `Fees > Record Payment`

### Recording Individual Payment

1. Enter student's name or phone
2. See current balance
3. Enter payment amount
4. Select payment method:
   - Cash
   - MTN Mobile Money
   - Airtel Money
   - Bank Transfer
   - Card
5. Enter reference number (if mobile money/bank)
6. Print receipt (optional)
7. Confirm payment

### Payment Search

Search by:

- Student name
- Phone number
- Receipt number
- Date range

## 7.3 Payment Plans (Installments)

**Path**: `Fees > Payment Plans`

### Creating Installment Plan

1. Select student
2. Enter total fee amount
3. Number of installments (e.g., 3)
4. Define payment dates:
   - Installment 1: Due [date]
   - Installment 2: Due [date]
   - Installment 3: Due [date]
5. System auto-calculates amounts
6. Save

### Tracking Installments

- See which installments are paid/pending
- Automatic reminders for upcoming due dates

## 7.4 Fee Waivers and Discounts

**Path**: `Fees > Adjustments`

### Adding Discount

1. Select student
2. Choose "Scholarship" or "Discount"
3. Enter percentage or amount
4. Add reason/notes
5. Save

### Adding Penalty

1. Select student
2. Choose "Penalty"
3. Enter amount
4. Add reason
5. Save

## 7.5 Invoicing

**Path**: `Fees > Invoicing`

### Generate Invoice

1. Select student
2. Click "Generate Invoice"
3. System creates PDF with:
   - School header
   - Student details
   - Itemized fees
   - Payment status
   - Balance due

## 7.6 Cashbook

**Path**: `Fees > Cashbook`

Track all financial transactions:

- Income (fee payments, other income)
- Expenses (supplies, salaries, maintenance)
- Running balance

## 7.7 Budget Management

**Path**: `Fees > Budget`

### Creating Budget

1. Select academic year
2. Create budget categories
3. Set projected amounts
4. Track actual spending
5. View variance

---

# 8. TIMETABLE AND SCHEDULING

## 8.1 Setting Up Timetable

**Path**: `Timetable > Period Settings`

### Define School Day

1. Add periods:
   - Period 1: 7:30-8:10
   - Period 2: 8:10-8:50
   - etc.
2. Set break times
3. Set lunch time
4. Save

## 8.2 Subject Allocation

**Path**: `Timetable > Allocations`

### Allocating Subjects to Classes

1. Select Class
2. Add subjects taught
3. Assign teacher to each subject
4. Save

### Allocating Teachers

1. View teacher list
2. Assign subjects they teach
3. Assign classes

## 8.3 Creating Timetable

**Path**: `Timetable > Class Timetable`

### Building Timetable

1. Select class
2. Click time slot
3. Select subject from dropdown
4. Assign teacher (auto-filled if pre-allocated)
5. Repeat for all slots
6. Save

### Constraints Check

System shows warnings for:

- Teacher already teaching another class
- Room conflicts
- Double booking

## 8.4 Teacher Timetable

**Path**: `Timetable > Teacher Timetable`

View individual teacher's schedule:

1. Select teacher
2. See weekly view
3. Print if needed

## 8.5 Substitutions

**Path**: `Timetable > Substitutions`

### Recording a Substitution

1. Click "New Substitution"
2. Select absent teacher
3. Select date
4. Select period
5. Assign substitute teacher
6. Add notes
7. Save

### Viewing Substitutions

See all cover lessons scheduled.

---

# 9. REPORTS AND ANALYTICS

## 9.1 Available Reports

| Report             | Location                 | Description                    |
| ------------------ | ------------------------ | ------------------------------ |
| Class Performance  | Reports > Class Report   | All subjects for a class       |
| Student Report     | Reports > Student Report | Individual student performance |
| Attendance Summary | Reports > Attendance     | Attendance statistics          |
| Fee Collection     | Reports > Fees           | Collections vs targets         |
| Staff List         | Reports > Staff          | All staff with details         |
| Syllabus Coverage  | Reports > Syllabus       | Topics covered vs planned      |

## 9.2 Generating Reports

### Steps

1. Navigate to report type
2. Select filters (date range, class, term)
3. Preview on screen
4. Click "Export" for PDF/Excel
5. Print directly

## 9.3 Analytics Dashboard

**Path**: `Analytics`

### Key Metrics

- Student enrollment trends
- Fee collection rates
- Attendance rates
- Grade distribution
- Class comparisons

### DNA Analytics

Deep analysis of performance patterns and predictions.

## 9.4 MOES Reports

**Path**: `MOES Reports`

Ministry of Education reports:

- EMIS data submissions
- UCE/UACE registrations
- Staff returns
- Infrastructure survey

---

# 10. SMS AND COMMUNICATION

## 10.1 Sending Single SMS

**Path**: `SMS > Send SMS`

1. Enter recipient phone number
2. Type message
3. Preview cost
4. Send

## 10.2 Bulk SMS

**Path**: `SMS > Bulk SMS`

### Send to Group

1. Choose group:
   - All Parents
   - Specific Class
   - Fee Defaulters
   - Custom selection
2. Type message
3. Use variables:
   - `{student_name}` - Student's name
   - `{amount}` - Fee amount
   - `{balance}` - Current balance
4. Preview recipients
5. Send

### Example Messages

```
Dear {parent}, {student_name} was absent today. Please call the school.
Reminder: {student_name}'s school fees of UGX {amount} are due on {date}.
```

## 10.3 SMS Templates

**Path**: `SMS > Templates`

### Creating Template

1. Name the template
2. Write message content
3. Use available variables
4. Save

### Pre-built Templates

- Absent notification
- Fee reminder
- Payment confirmation
- Meeting reminder
- Holiday announcement

## 10.4 Auto SMS

**Path**: `Auto SMS`

### Enable Automations

- Student absent → Parent notification
- New grade posted → Parent notification
- Fee payment received → Confirmation
- Installment due → Reminder

### Configuration

1. Enable automation
2. Customize message
3. Set timing
4. Save

---

# 11. PARENT PORTAL

## 11.1 Parent Access

Parents can access via: **parent-portal-link/school-code**

### Login

- Phone number
- Password (set during student registration)

## 11.2 Parent Features

### Dashboard

- See children's info
- Quick stats
- Recent notifications

### Academics

- View grades
- See term report
- Track progress over time

### Attendance

- Daily attendance history
- Monthly summaries
- Why was child marked absent?

### Fees

- Current balance
- Payment history
- Payment instructions

### Messages

- Receive school announcements
- Message school

---

# 12. LIBRARY MANAGEMENT

## 12.1 Adding Books

**Path**: `Library > Add Book`

### Book Details

- Title
- Author
- ISBN
- Category (Fiction, Reference, etc.)
- Copies available
- Shelf location

## 12.2 Issuing Books

**Path**: `Library > Issue Book`

1. Find student (search by name)
2. Select book
3. Set return date
4. Confirm

## 12.3 Returning Books

**Path**: `Library > Return Book`

1. Scan or search book
2. Confirm return
3. Check for overdue
4. Apply fine if applicable

---

# 13. INVENTORY AND STORE

## 13.1 Inventory Management

**Path**: `Inventory`

### Adding Items

1. Item name
2. Category
3. Quantity
4. Unit cost
5. Reorder level (low stock alert)

### Stock Tracking

- See current quantities
- Track usage over time
- Alerts for low stock

## 13.2 Point of Sale (POS)

**Path**: `Store > POS`

### Making a Sale

1. Search item or scan barcode
2. Add to cart
3. Adjust quantity
4. Apply discount (optional)
5. Select payment method
6. Complete transaction
7. Print receipt

### Cash Management

- Open cash float
- Record cash sales
- End of day reconciliation

## 13.3 Student Wallets

**Path**: `Store > Wallets`

### Adding Credit

1. Search student
2. Enter amount
3. Record payment
4. Credit added

### Deductions

System auto-deducts from wallet for:

- Canteen purchases
- Store purchases
- Print services

---

# 14. DORMITORY MANAGEMENT

## 14.1 Dorm Setup

**Path**: `Dorm > Dorm Settings`

1. Create dormitories
2. Add rooms
3. Assign capacity
4. Set gender restrictions

## 14.2 Student Assignment

**Path**: `Dorm > Assign Students`

1. Select student
2. Choose dorm
3. Choose room
4. Choose bed
5. Save

## 14.3 Dorm Attendance

**Path**: `Dorm > Dorm Attendance`

Night attendance check:

1. Select dorm
2. Mark present/absent per bed
3. Add notes
4. Submit

## 14.4 Dorm Supplies

**Path**: `Dorm > Supplies`

Track:

- Bedding
- Toiletries
- Linens
- Repairs needed

---

# 15. HEALTH AND WELFARE

## 15.1 Health Records

**Path**: `Health > Student Health`

### Recording Health Info

- Medical conditions
- Allergies
- Medications
- Emergency contacts
- Doctor's notes

## 15.2 Health Log

**Path**: `Health > Health Log`

Track:

- Sick bay visits
- Treatment given
- Referrals
- Follow-up needed

## 15.3 Counseling Records

Track student welfare:

- Sessions held
- Topics discussed
- Actions taken
- Follow-up required

---

# 16. SETTINGS AND CONFIGURATION

## 16.1 School Settings

**Path**: `Settings > School`

### Basic Info

- School Name
- School Code
- Address
- Phone Numbers
- Email
- Website

### Branding

- Upload Logo
- Select Primary Color
- Add Footer Text

## 16.2 Academic Terms

**Path**: `Settings > Academic Terms`

### Setting Terms

1. Click "Add Term"
2. Enter term name (e.g., "Term 1 2024")
3. Select dates
4. Set as current term
5. Save

## 16.3 Classes

**Path**: `Settings > Classes`

### Adding Classes

1. Class Name (e.g., "Senior 4")
2. Stream (e.g., "S.4 East")
3. Class Teacher
4. Capacity
5. Save

## 16.4 Subjects

**Path**: `Settings > Subjects`

### Adding Subjects

1. Subject Name
2. Subject Code
3. Level (Primary/Secondary)
4. Compulsory or Elective
5. Save

### Allocating to Classes

1. Select class
2. Check subjects taught
3. Assign teachers
4. Save

## 16.5 Users

**Path**: `Settings > Users`

### Managing Staff Access

1. View all users
2. Edit role
3. Reset password
4. Deactivate account

---

# 17. AUTOMATION AND WORKFLOWS

## 17.1 Scheduled Tasks

System automatically runs:
| Task | Frequency | Action |
|------|-----------|--------|
| Attendance Follow-up | Daily 8 AM | Alert on absences |
| Fee Reminders | Weekly | Remind defaulters |
| Report Card Gen | After term end | Auto-generate reports |
| Student Promotion | End of year | Promote eligible students |
| Payroll | Monthly | Calculate salaries |

## 17.2 Notifications

Receive alerts for:

- Low attendance rates
- Fee defaults
- At-risk students
- Pending approvals
- System updates

## 17.3 Workflows

### Leave Approval Flow

1. Staff submits leave request
2. Manager notified
3. Approve/Reject
4. Staff notified of decision
5. Calendar updated

### Expense Approval Flow

1. Staff creates expense claim
2. Budget owner reviews
3. Approve/Reject
4. Payment processed

---

# 18. TROUBLESHOOTING

## 18.1 Common Issues

### Can't Login

- Check phone number format (include country code)
- Reset password via "Forgot Password"
- Clear browser cache
- Try incognito mode

### Fees Not Showing

- Check academic year setting
- Verify class enrollment
- Refresh page

### Grades Not Saving

- Check internet connection
- Click Submit once only
- Wait for confirmation message

### SMS Not Sending

- Check SMS balance
- Verify phone number format (+256...)
- Check scheduled time

### Offline Mode Not Working

- Check if enabled in settings
- Verify data sync
- Re-login to refresh data

## 18.2 Getting Help

### In-App Support

- Click "Help" or "?" icon
- Search for topic
- Contact support team

### Contact Support

- Email: support@omuto.org
- Phone: Available in settings
- WhatsApp: Link in help section

---

# APPENDIX

## A. Keyboard Shortcuts

| Shortcut | Action          |
| -------- | --------------- |
| Ctrl + K | Search          |
| Ctrl + S | Save (in forms) |
| Ctrl + P | Print           |
| Esc      | Close modal     |

## B. Data Export Formats

- **PDF** - For reports and documents
- **Excel** - For data analysis
- **CSV** - For bulk imports

## C. Security Tips

1. **Never share your password**
2. **Log out when done**
3. **Use strong password** (letters, numbers, symbols)
4. **Report suspicious activity** to admin

## D. Data Backup

System auto-backs up daily. For critical data:

1. Export reports monthly
2. Download student photos
3. Keep offline records

---

**Version**: 1.0
**Last Updated**: April 2026
**Support**: support@omuto.org

---

_This manual is for school administrators and teachers using the Omuto School Management System. For technical documentation, contact support._

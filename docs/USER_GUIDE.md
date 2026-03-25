# Omuto SMS - User Guide

## Getting Started

### 1. Account Setup

1. Visit the login page
2. Click "Register your school"
3. Fill in your school details:
   - School name
   - District
   - School type (Primary/Secondary/Combined)
   - Phone number
   - Password
4. Click "Create Account"
5. You'll be logged in and redirected to the dashboard

### 2. First Login Setup

After your first login, complete the setup wizard:

1. **Academic Settings**
   - Set current academic year (e.g., 2026)
   - Select current term (1, 2, or 3)
   - Set school hours

2. **Add Classes**
   - Click "Add Class"
   - Enter class name (e.g., P.5A, S.2B)
   - Set maximum students
   - Repeat for all classes

3. **Add Subjects**
   - Default Uganda subjects are pre-loaded
   - Add any additional subjects your school teaches

## Managing Students

### Adding Students

1. Go to **Students** in the sidebar
2. Click **Add Student**
3. Fill in student details:
   - First name & Last name
   - Gender
   - Date of birth
   - Class
   - Parent name & phone number
4. Click **Add Student**

### Importing Students (Bulk)

1. Go to **Import** in the sidebar
2. Download the CSV template
3. Fill in student data in Excel or Google Sheets
4. Export as CSV
5. Upload the file
6. Review and confirm import

### Viewing Student Details

1. Go to **Students**
2. Click the eye icon next to a student
3. View complete student profile including:
   - Personal information
   - Attendance history
   - Grade reports
   - Fee payment history

## Taking Attendance

### Daily Attendance

1. Go to **Attendance** in the sidebar
2. Select the date
3. Click on a class card
4. Mark each student:
   - ✅ Present (green)
   - ⏰ Late (yellow)
   - ❌ Absent (red)
5. Click **Save Attendance**

### Attendance Reports

- View attendance percentage per class on the main attendance page
- Export attendance data for reporting

## Entering Grades

### Continuous Assessment

1. Go to **Grades** in the sidebar
2. Select class, subject, and assessment type (CA1-CA4)
3. Enter scores for each student (0-100)
4. Grades are auto-saved
5. UNEB grade is calculated automatically

### Exam Scores

1. Select "End of Term Exam" from assessment dropdown
2. Enter exam scores
3. System calculates final grade:
   - 80% from continuous assessment
   - 20% from exam

### Printing Report Cards

1. Go to **Reports**
2. Select student
3. Click **Generate Report**
4. Download or print PDF

## Fee Management

### Setting Up Fee Structure

1. Go to **Fees** → **Fee Structure** tab
2. Click **Add Fee**
3. Enter:
   - Fee name (e.g., "Tuition", "Development")
   - Amount (UGX)
   - Class (or leave blank for all classes)
   - Term
   - Due date

### Recording Payments

1. Go to **Fees** → **Payment Records** tab
2. Click **Record Payment**
3. Select student
4. Enter amount and payment method:
   - Cash
   - Mobile Money (MTN/Airtel)
   - Bank Transfer
5. Add reference number (optional)
6. Click **Record Payment**

### Fee Reports

- View collection rate on fees page
- See outstanding balances
- Export payment records

## Sending SMS

### Individual SMS

1. Go to **Messages**
2. Select "Individual"
3. Choose student
4. Type message
5. Click **Send SMS**

### Class SMS

1. Select "Class"
2. Choose class
3. Type message
4. Click **Send SMS**

### Bulk SMS

1. Select "All Parents"
2. Type message
3. Click **Send SMS**

### SMS Templates

Pre-built templates for common messages:
- Absence notification
- Fee reminder
- Report card ready
- Event announcement

## Settings

### School Information

1. Go to **Settings** → **General**
2. Update school details:
   - School name
   - UNEB center number
   - District
   - Contact information
3. Click **Save Changes**

### Adding Users

1. Go to **Settings** → **Users & Roles**
2. Click **Add User**
3. Enter user details
4. Select role:
   - School Admin
   - Teacher
   - Parent
5. User will receive login credentials via SMS

### Notification Settings

1. Go to **Settings** → **Notifications**
2. Toggle notifications:
   - SMS for fee payments
   - Absence alerts
   - Report card ready
   - Event reminders
   - Fee balance reminders

## Parent Portal

### Accessing the Portal

Parents can:
1. Log in with their phone number
2. View their child's:
   - Attendance records
   - Grades and reports
   - Fee balance
3. Receive SMS notifications

## Offline Mode

### How It Works

1. When internet is unavailable:
   - Red banner appears at top
   - Data saves locally
2. When connected:
   - Data syncs automatically
   - Green indicator shows sync status

### Best Practices

- Take attendance even when offline
- Enter grades as usual
- Data will sync when connection returns

## Troubleshooting

### Can't Log In

1. Check phone number format (start with 0)
2. Use "Forgot Password" to reset
3. Contact school admin if issue persists

### Data Not Syncing

1. Check internet connection
2. Refresh the page
3. Check if Supabase credentials are correct

### SMS Not Sending

1. Verify Africa's Talking API key is set
2. Check phone number format
3. Ensure sufficient SMS credits

### Slow Performance

1. Clear browser cache
2. Use Chrome or Firefox
3. Check internet speed

## Support

For technical support:
- Email: support@omutosms.com
- Phone: +256 700 000 000

---

© 2026 Omuto Technologies. Made for Ugandan Schools 🇺🇬

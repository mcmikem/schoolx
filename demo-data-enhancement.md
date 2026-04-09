# Demo Data Enhancement Recommendations

To ensure all pages work properly and enable potential buyers to test functionality, here's what data should be added to demo accounts:

## Current Seed Data Analysis

- 1 school: Demo Primary School (P.1-P.7 classes)
- 20 students (all female)
- Basic fee structure (Tuition, Development, Exam Fee, Lunch)
- Sample events (exams, meetings, holidays)

## Recommended Enhancements by Module

### 1. Students & Demographics (Enhance `/dashboard/students`)

**Add:**

- Male students (currently all female)
- Students with special needs indicators
- Transfer students (recent join/leave)
- Students with varying academic performance levels
- Orphaned/vulnerable children flags
- Different age ranges per class

### 2. Attendance System (Enhance `/dashboard/attendance`)

**Add:**

- Historical attendance data (last 30 days)
- Various attendance statuses: present, absent, late, excused
- Patterns for testing reports (chronic absenteeism, improvement trends)
- Staff attendance records

### 3. Academic Performance (Enhance `/dashboard/grades`, `/dashboard/exams`)

**Add:**

- Exam results for multiple terms
- Continuous assessment scores
- Grade distributions (A-F spectrum)
- Subject performance analytics
- Exam timetables with multiple subjects
- Continuous assessment components

### 4. Finance & Fees (Enhance `/dashboard/fees`, `/dashboard/reports`)

**Add:**

- Payment histories (partial payments, overdue, advance payments)
- Multiple fee types (transport, meals, activities)
- Discounts and scholarships
- Fee defaulters list
- Payment plans and installments
- Expense tracking (salaries, utilities, supplies)

### 5. Staff Management (Enhance `/dashboard/staff`, `/dashboard/teacher-performance`)

**Add:**

- Multiple staff roles (teachers, non-teaching, administration)
- Staff attendance and performance metrics
- Professional development records
- Leave management data
- Payroll variations

### 6. Communication System (Enhance `/dashboard/messages`, `/dashboard/notices`)

**Add:**

- Message templates (reminders, announcements, alerts)
- Bulk SMS history
- Notice board posts
- Event invitations and RSVPs
- Parent-teacher communication logs

### 7. Health & Safety (Enhance `/dashboard/health`)

**Add:**

- Medical records (vaccinations, allergies, chronic conditions)
- Infirmary visit logs
- Health screening results
- Emergency contact information
- First aid incident reports

### 8. Library System (Enhance `/dashboard/library`)

**Add:**

- Book inventory (various subjects, levels)
- Borrowing history
- Overdue books
- Reservation system
- Digital resources

### 9. Transport Management (Enhance `/dashboard/transport`)

**Add:**

- Vehicle fleet details
- Route maps and schedules
- Student transport assignments
- Fuel consumption logs
- Maintenance records

### 10. Dormitory Management (Enhance `/dashboard/dorm`)

**Add:**

- Room assignments
- Bed allocation
- Inventory (mattresses, blankets, etc.)
- Visitor logs
- Disciplinary records
- Welfare provisions

### 11. Canteen Management (Enhance `/dashboard/canteen`)

**Add:**

- Menu items with prices
- Inventory levels
- Sales transactions
- Nutrition information
- Supplier details

### 12. Asset Management (Enhance `/dashboard/assets`)

**Add:**

- Asset register (furniture, equipment, electronics)
- Depreciation schedules
- Maintenance logs
- Asset assignments
- Insurance records

### 13. Exams & Assessment (Enhance `/dashboard/exams`, `/dashboard/uneb`)

**Add:**

- Mock exam results
- Continuous assessment breakdown
- Special accommodations
- Grading schemes
- Performance analytics
- UNEB registration details

### 14. Timetable & Scheduling (Enhance `/dashboard/timetable`)

**Add:**

- Complex timetables (multiple teachers, shared resources)
- Substitution records
- Room allocations
- Extracurricular scheduling
- Exam timetables

## Implementation Strategy

### 1. Enhanced SQL Seeding

Modify `/supabase/seed.sql` to include:

- Balanced gender distribution
- Varied academic performance
- Payment history patterns
- Attendance trends
- Staff diversity

### 2. Seed Utility Enhancement

Update `/src/lib/seed-demo.ts` to:

- Create realistic data relationships
- Generate temporal data (historical trends)
- Create edge cases for testing
- Generate sufficient volume for analytics

### 3. Special Test Scenarios

Create data for:

- System limits (maximum students per class)
- Boundary conditions (grade thresholds)
- Error conditions (missing data, invalid formats)
- Performance testing (large datasets)
- Security testing (permission boundaries)

## Key Pages Requiring Rich Data for Testing

### Fully Functional Pages Requiring Data:

1. `/dashboard/analytics` - Needs historical trends
2. `/dashboard/reports` - Needs multi-dimensional data
3. `/dashboard/teacher-performance` - Needs staff metrics
4. `/dashboard/batch-reports` - Needs student groups
5. `/dashboard/comments` - Needs assignment data
6. `/dashboard/health` - Needs medical records
7. `/dashboard/library` - Needs book inventory
8. `/dashboard/transport` - Needs route/student assignments
9. `/dashboard/dorm` - Needs room/occupancy data
10. `/dashboard/canteen` - Needs menu/inventory/sales
11. `/dashboard/assets` - Needs asset register
12. `/dashboard/sync-center` - Needs offline scenarios

### Pages Already Working with Current Data:

- Dashboard overview
- Students basic listing
- Attendance basic marking
- Grades basic entry
- Fees basic structure
- Messages basic sending
- Settings basic configuration

## Expected Outcome

With enhanced data:

- All navigation items show meaningful data
- Analytics display trends and patterns
- Reports can be generated with filtering
- Performance metrics show comparisons
- Systems can be tested at scale
- Edge cases can be validated
- Buyers can envision real-world usage

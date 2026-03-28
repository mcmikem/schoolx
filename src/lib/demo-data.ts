// Comprehensive Demo data for demo accounts - fully populated
// This data is stored in memory and won't affect real accounts

export interface DemoStudent {
  id: string
  first_name: string
  last_name: string
  gender: 'M' | 'F'
  student_number: string
  class_id: string
  parent_name: string
  parent_phone: string
  parent_phone2?: string
  status: string
  date_of_birth?: string
  address?: string
  classes?: { name: string; level: string }
}

export interface DemoClass {
  id: string
  name: string
  level: string
  stream?: string
}

export interface DemoFeePayment {
  id: string
  student_id: string
  amount_paid: number
  payment_method: string
  payment_reference: string | null
  payment_date: string
  paid_by?: string
  students?: {
    first_name: string
    last_name: string
    classes?: { name: string }
  }
}

export interface DemoFeeStructure {
  id: string
  name: string
  amount: number
  term: number
  class_id?: string
}

export interface DemoStaff {
  id: string
  full_name: string
  phone: string
  email?: string
  role: string
  subjects?: string[]
  class_id?: string
}

export interface DemoAttendance {
  id: string
  student_id: string
  class_id: string
  date: string
  status: 'present' | 'absent' | 'late' | 'excused'
}

export interface DemoGrade {
  id: string
  student_id: string
  subject_id: string
  class_id: string
  assessment_type: string
  score: number
  max_score: number
  term: number
  academic_year: string
}

export interface DemoSubject {
  id: string
  name: string
  code: string
  level: string
}

export interface DemoEvent {
  id: string
  title: string
  description?: string
  event_type: string
  start_date: string
  end_date?: string
}

export interface DemoMessage {
  id: string
  message: string
  recipient_type: string
  phone?: string
  status: string
  created_at: string
}

export interface DemoTimetable {
  id: string
  class_id: string
  subject_id: string
  day_of_week: number
  start_time: string
  end_time: string
  teacher_id?: string
}

// Full class list for primary school
const demoClasses: DemoClass[] = [
  { id: 'p1-a', name: 'P.1A', level: 'P.1' },
  { id: 'p1-b', name: 'P.1B', level: 'P.1' },
  { id: 'p2-a', name: 'P.2A', level: 'P.2' },
  { id: 'p2-b', name: 'P.2B', level: 'P.2' },
  { id: 'p3-a', name: 'P.3A', level: 'P.3' },
  { id: 'p3-b', name: 'P.3B', level: 'P.3' },
  { id: 'p4-a', name: 'P.4A', level: 'P.4' },
  { id: 'p4-b', name: 'P.4B', level: 'P.4' },
  { id: 'p5-a', name: 'P.5A', level: 'P.5' },
  { id: 'p5-b', name: 'P.5B', level: 'P.5' },
  { id: 'p6-a', name: 'P.6A', level: 'P.6' },
  { id: 'p6-b', name: 'P.6B', level: 'P.6' },
  { id: 'p7-a', name: 'P.7A', level: 'P.7' },
  { id: 'p7-b', name: 'P.7B', level: 'P.7' },
]

// Comprehensive student list - 10 per class = 140 students
const generateStudents = (): DemoStudent[] => {
  const firstNames = {
    M: ['John', 'Peter', 'James', 'David', 'Michael', 'Robert', 'Francis', 'Sam', 'Paul', 'Daniel', 'Joseph', 'Emmanuel', 'Richard', 'Charles', 'George'],
    F: ['Sarah', 'Grace', 'Joyce', 'Elizabeth', 'Faith', 'Mary', 'Jane', 'Ruth', 'Esther', 'Gladys', 'Lucy', 'Agnes', 'Janet', 'Patricia', 'Catherine']
  }
  const lastNames = ['Ochieng', 'Nakato', 'Mukama', 'Atwoki', 'Okello', 'Nambozo', 'Wekesa', 'Kaguta', 'Kato', 'Nabukeera', 'Moses', 'Kagaba', 'Tumusiime', 'Wasswa', 'Nkunda']
  
  const students: DemoStudent[] = []
  let idx = 1
  
  demoClasses.forEach(cls => {
    for (let i = 0; i < 10; i++) {
      const gender = i < 5 ? 'M' as const : 'F' as const
      const firstName = firstNames[gender][i % firstNames[gender].length]
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
      
      students.push({
        id: `stu-${String(idx).padStart(3, '0')}`,
        first_name: firstName,
        last_name: `${lastName} ${String.fromCharCode(65 + i)}`,
        gender,
        student_number: `STU${String(idx).padStart(4, '0')}`,
        class_id: cls.id,
        parent_name: `${gender === 'M' ? 'Mr' : 'Mrs'} ${lastName}`,
        parent_phone: `0772${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`,
        status: 'active',
        date_of_birth: `201${Math.floor(Math.random() * 5) + 4}-0${Math.floor(Math.random() * 9) + 1}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
        address: 'Kampala, Uganda',
      })
      idx++
    }
  })
  
  return students
}

// Staff list
const demoStaff: DemoStaff[] = [
  { id: 'staff-001', full_name: 'Dr. John Headmaster', phone: '0700000001', email: 'headmaster@stmarty.demo', role: 'school_admin' },
  { id: 'staff-002', full_name: 'Mary Teacher', phone: '0700000002', email: 'mary@stmarty.demo', role: 'teacher', subjects: ['Mathematics', 'Science'], class_id: 'p7-a' },
  { id: 'staff-003', full_name: 'James Bursar', phone: '0700000003', email: 'bursar@stmarty.demo', role: 'bursar' },
  { id: 'staff-004', full_name: 'Sarah Dean', phone: '0700000004', email: 'sarah@stmarty.demo', role: 'teacher', subjects: ['English', 'SST'] },
  { id: 'staff-005', full_name: 'Robert Mukisa', phone: '0700000005', email: 'robert@stmarty.demo', role: 'teacher', subjects: ['Science'] },
  { id: 'staff-006', full_name: 'Grace Amooti', phone: '0700000006', email: 'grace@stmarty.demo', role: 'teacher', subjects: ['CRE'] },
  { id: 'staff-007', full_name: 'David Okwera', phone: '0700000007', email: 'david@stmarty.demo', role: 'teacher', subjects: ['Mathematics'] },
  { id: 'staff-008', full_name: 'Janet Ninsiima', phone: '0700000008', email: 'janet@stmarty.demo', role: 'teacher', subjects: ['English'] },
]

// Subjects
const demoSubjects: DemoSubject[] = [
  { id: 'sub-001', name: 'English', code: 'ENG', level: 'primary' },
  { id: 'sub-002', name: 'Mathematics', code: 'MTC', level: 'primary' },
  { id: 'sub-003', name: 'Integrated Science', code: 'SCI', level: 'primary' },
  { id: 'sub-004', name: 'Social Studies', code: 'SST', level: 'primary' },
  { id: 'sub-005', name: 'Religious Education', code: 'CRE', level: 'primary' },
  { id: 'sub-006', name: 'Physical Education', code: 'PE', level: 'primary' },
  { id: 'sub-007', name: 'Local Language', code: 'LUG', level: 'primary' },
  { id: 'sub-008', name: 'Art & Craft', code: 'ACD', level: 'primary' },
  { id: 'sub-009', name: 'Music', code: 'MUS', level: 'primary' },
  { id: 'sub-010', name: 'Agriculture', code: 'AGR', level: 'primary' },
]

// Fee structure - per class
const demoFeeStructure: DemoFeeStructure[] = [
  // P1-P3
  { id: 'fee-001', name: 'Tuition', amount: 120000, term: 1, class_id: 'p1-a' },
  { id: 'fee-002', name: 'Development', amount: 40000, term: 1, class_id: 'p1-a' },
  { id: 'fee-003', name: 'Exam Fee', amount: 20000, term: 1, class_id: 'p1-a' },
  { id: 'fee-004', name: 'Tuition', amount: 120000, term: 2, class_id: 'p1-a' },
  { id: 'fee-005', name: 'Development', amount: 40000, term: 2, class_id: 'p1-a' },
  { id: 'fee-006', name: 'Exam Fee', amount: 20000, term: 2, class_id: 'p1-a' },
  { id: 'fee-007', name: 'Tuition', amount: 120000, term: 3, class_id: 'p1-a' },
  { id: 'fee-008', name: 'Development', amount: 40000, term: 3, class_id: 'p1-a' },
  { id: 'fee-009', name: 'Exam Fee', amount: 25000, term: 3, class_id: 'p1-a' },
  // P4-P7 (higher fees)
  { id: 'fee-010', name: 'Tuition', amount: 150000, term: 1, class_id: 'p5-a' },
  { id: 'fee-011', name: 'Development', amount: 50000, term: 1, class_id: 'p5-a' },
  { id: 'fee-012', name: 'Exam Fee', amount: 30000, term: 1, class_id: 'p5-a' },
  { id: 'fee-013', name: 'Tuition', amount: 150000, term: 2, class_id: 'p5-a' },
  { id: 'fee-014', name: 'Development', amount: 50000, term: 2, class_id: 'p5-a' },
  { id: 'fee-015', name: 'Exam Fee', amount: 30000, term: 2, class_id: 'p5-a' },
  { id: 'fee-016', name: 'Tuition', amount: 150000, term: 3, class_id: 'p5-a' },
  { id: 'fee-017', name: 'Development', amount: 50000, term: 3, class_id: 'p5-a' },
  { id: 'fee-018', name: 'Exam Fee', amount: 35000, term: 3, class_id: 'p5-a' },
]

// Generate payments for students
const generatePayments = (students: DemoStudent[]): DemoFeePayment[] => {
  const payments: DemoFeePayment[] = []
  const methods = ['cash', 'mobile_money', 'bank', 'installment']
  const paymentRefs: Record<string, (string | null)[]> = {
    mobile_money: ['MTN123456789', 'MTN987654321', 'AIR456789123', 'AIR789123456'],
    bank: ['BK920000123', 'BK920000456', 'DFCU001', 'Stanbic001'],
    cash: [null],
    installment: ['INST001', 'INST002'],
  }
  
  let payIdx = 1
  
  // Give 70% of students have made payments
  students.slice(0, Math.floor(students.length * 0.7)).forEach((student, idx) => {
    // Most have paid full or partial
    const isFullPayment = idx % 3 === 0
    const amount = isFullPayment ? 210000 : Math.floor(Math.random() * 150000) + 50000
    const method = methods[Math.floor(Math.random() * methods.length)]
    const refs = paymentRefs[method]
    const ref = refs[Math.floor(Math.random() * refs.length)]
    
    payments.push({
      id: `pay-${String(payIdx).padStart(3, '0')}`,
      student_id: student.id,
      amount_paid: amount,
      payment_method: method,
      payment_reference: ref,
      payment_date: `2026-0${Math.floor(Math.random() * 3) + 1}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
      paid_by: student.parent_name,
    })
    payIdx++
  })
  
  return payments
}

// Generate attendance for last 30 days
const generateAttendance = (students: DemoStudent[]): DemoAttendance[] => {
  const attendance: DemoAttendance[] = []
  const statuses: Array<'present' | 'absent' | 'late' | 'excused'> = ['present', 'present', 'present', 'present', 'present', 'absent', 'late']
  
  for (let day = 0; day < 30; day++) {
    const date = new Date()
    date.setDate(date.getDate() - day)
    const dateStr = date.toISOString().split('T')[0]
    
    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue
    
    students.forEach(student => {
      attendance.push({
        id: `att-${student.id}-${dateStr}`,
        student_id: student.id,
        class_id: student.class_id,
        date: dateStr,
        status: statuses[Math.floor(Math.random() * statuses.length)],
      })
    })
  }
  
  return attendance
}

// Generate grades for students
const generateGrades = (students: DemoStudent[]): DemoGrade[] => {
  const grades: DemoGrade[] = []
  const assessments = ['CA1', 'CA2', 'CA3', 'CA4', 'Exam']
  
  students.slice(0, 50).forEach(student => {
    demoSubjects.forEach(subject => {
      assessments.forEach(assessment => {
        grades.push({
          id: `grade-${student.id}-${subject.id}-${assessment}`,
          student_id: student.id,
          subject_id: subject.id,
          class_id: student.class_id,
          assessment_type: assessment.toLowerCase(),
          score: Math.floor(Math.random() * 40) + 60, // 60-100
          max_score: 100,
          term: 1,
          academic_year: '2026',
        })
      })
    })
  })
  
  return grades
}

// Events
const demoEvents: DemoEvent[] = [
  { id: 'evt-001', title: 'Parent Teacher Meeting', description: 'Quarterly meeting with parents', event_type: 'meeting', start_date: '2026-02-15' },
  { id: 'evt-002', title: 'Mid-Term Examinations', event_type: 'exam', start_date: '2026-02-20', end_date: '2026-02-25' },
  { id: 'evt-003', title: 'Sports Day', description: 'Annual sports competition', event_type: 'event', start_date: '2026-03-10' },
  { id: 'evt-004', title: 'Science Fair', description: 'Student science projects exhibition', event_type: 'event', start_date: '2026-03-20' },
  { id: 'evt-005', title: 'Good Friday', event_type: 'holiday', start_date: '2026-04-18' },
  { id: 'evt-006', title: 'Easter Monday', event_type: 'holiday', start_date: '2026-04-21' },
  { id: 'evt-007', title: 'End of Term 1', event_type: 'academic', start_date: '2026-03-28' },
  { id: 'evt-008', title: 'Staff Development Workshop', description: 'Teacher training on new curriculum', event_type: 'meeting', start_date: '2026-04-02' },
]

// Messages
const demoMessages: DemoMessage[] = [
  { id: 'msg-001', message: 'Dear Parent, Term 1 fees are now due. Please pay by 15th Feb.', recipient_type: 'all', status: 'sent', created_at: '2026-01-20' },
  { id: 'msg-002', message: 'Reminder: Mid-term exams start next week. Ensure your child is prepared.', recipient_type: 'class', status: 'sent', created_at: '2026-02-10' },
  { id: 'msg-003', message: 'Congratulations to P.7A for winning the science fair!', recipient_type: 'all', status: 'sent', created_at: '2026-03-21' },
  { id: 'msg-004', message: 'Your child John Ochieng A was absent yesterday. Please explain.', recipient_type: 'individual', phone: '0772123456', status: 'sent', created_at: '2026-03-25' },
]

// Timetable
const generateTimetable = (): DemoTimetable[] => {
  const timetable: DemoTimetable[] = []
  const times = [
    { start: '08:00', end: '08:40' },
    { start: '08:40', end: '09:20' },
    { start: '09:20', end: '10:00' },
    { start: '10:00', end: '10:20' }, // break
    { start: '10:20', end: '11:00' },
    { start: '11:00', end: '11:40' },
    { start: '11:40', end: '12:20' },
    { start: '12:20', end: '13:00' }, // lunch
    { start: '13:00', end: '13:40' },
    { start: '13:40', end: '14:20' },
  ]
  
  const classSubjects: Record<string, string[]> = {
    'p5-a': ['ENG', 'MTC', 'SCI', 'SST', 'CRE', 'PE'],
    'p6-a': ['ENG', 'MTC', 'SCI', 'SST', 'CRE', 'PE'],
    'p7-a': ['ENG', 'MTC', 'SCI', 'SST', 'CRE', 'PE'],
  }
  
  let idx = 1
  Object.entries(classSubjects).forEach(([classId, subjects]) => {
    subjects.forEach((subjCode, dayIdx) => {
      const subject = demoSubjects.find(s => s.code === subjCode)
      if (subject && dayIdx < 5) {
        times.slice(0, 6).forEach((time, periodIdx) => {
          timetable.push({
            id: `tt-${String(idx).padStart(3, '0')}`,
            class_id: classId,
            subject_id: subject.id,
            day_of_week: dayIdx + 1,
            start_time: time.start,
            end_time: time.end,
          })
          idx++
        })
      }
    })
  })
  
  return timetable
}

// Generate all data
const allStudents = generateStudents()
const allPayments = generatePayments(allStudents)
const allAttendance = generateAttendance(allStudents)
const allGrades = generateGrades(allStudents)
const allTimetable = generateTimetable()

export const demoData = {
  school: {
    id: 'demo-school',
    name: "St. Mary's Primary School",
    school_code: 'STMA',
    district: 'Kampala',
    subcounty: 'Central Division',
    school_type: 'primary',
    ownership: 'private',
    phone: '0414123456',
    email: 'info@stmarty.demo',
    primary_color: '#002045',
  },

  classes: demoClasses,
  students: allStudents,
  staff: demoStaff,
  subjects: demoSubjects,
  feeStructure: demoFeeStructure,
  payments: allPayments,
  attendance: allAttendance,
  grades: allGrades,
  events: demoEvents,
  messages: demoMessages,
  timetable: allTimetable,

  // Stats
  stats: {
    totalStudents: allStudents.length,
    totalStaff: demoStaff.length,
    totalClasses: demoClasses.length,
    totalSubjects: demoSubjects.length,
  }
}

export function isDemoSchool(schoolId?: string): boolean {
  return schoolId === 'demo-school'
}

export function getDemoClasses() {
  return demoData.classes
}

export function getDemoStudents() {
  return demoData.students.map(s => ({
    ...s,
    classes: demoData.classes.find(c => c.id === s.class_id),
  }))
}

export function getDemoFeeStructure() {
  return demoData.feeStructure
}

export function getDemoPayments() {
  return demoData.payments.map(p => ({
    ...p,
    students: demoData.students.find(s => s.id === p.student_id),
  }))
}

export function getDemoStaff() {
  return demoData.staff
}

export function getDemoSubjects() {
  return demoData.subjects
}

export function getDemoAttendance(classId?: string, date?: string) {
  let att = demoData.attendance
  if (classId) att = att.filter(a => a.class_id === classId)
  if (date) att = att.filter(a => a.date === date)
  return att
}

export function getDemoGrades(classId?: string, subjectId?: string) {
  let grades = demoData.grades
  if (classId) grades = grades.filter(g => g.class_id === classId)
  if (subjectId) grades = grades.filter(g => g.subject_id === subjectId)
  return grades
}

export function getDemoEvents() {
  return demoData.events
}

export function getDemoMessages() {
  return demoData.messages
}

export function getDemoTimetable(classId?: string) {
  if (classId) return demoData.timetable.filter(t => t.class_id === classId)
  return demoData.timetable
}

export function getDemoStats() {
  return demoData.stats
}

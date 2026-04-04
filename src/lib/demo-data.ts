export interface DemoStudent {
  id: string
  school_id: string
  student_number: string
  first_name: string
  last_name: string
  gender: 'M' | 'F'
  date_of_birth: string
  parent_name: string
  parent_phone: string
  parent_phone2: string | null
  address: string
  class_id: string
  admission_date: string
  ple_index_number: string | null
  status: 'active' | 'transferred' | 'dropped' | 'completed'
  opening_balance: number
  classes?: { id: string; name: string; level: string }
}

export interface DemoStaff {
  id: string
  school_id: string
  full_name: string
  phone: string
  email: string
  role: string
  subject: string
  gender: 'M' | 'F'
  status: 'active' | 'inactive'
  hire_date: string
  salary: number
}

export interface DemoFeePayment {
  id: string
  student_id: string
  fee_id: string
  amount_paid: number
  payment_method: 'cash' | 'mobile_money' | 'bank' | 'installment'
  payment_reference: string | null
  paid_by: string
  notes: string | null
  payment_date: string
}

export interface DemoFeeStructure {
  id: string
  school_id: string
  class_id: string | null
  name: string
  amount: number
  term: 1 | 2 | 3
  academic_year: string
  due_date: string | null
}

export interface DemoGrade {
  id: string
  student_id: string
  subject_id: string
  class_id: string
  assessment_type: 'ca1' | 'ca2' | 'ca3' | 'ca4' | 'project' | 'exam'
  score: number
  max_score: number
  term: 1 | 2 | 3
  academic_year: string
  recorded_by: string
}

export interface DemoAttendance {
  id: string
  student_id: string
  class_id: string
  date: string
  status: 'present' | 'absent' | 'late' | 'excused'
  remarks: string | null
  recorded_by: string
}

export interface DemoSubject {
  id: string
  school_id: string
  name: string
  code: string
  level: 'primary' | 'secondary' | 'both'
  is_compulsory: boolean
}

export interface DemoNotice {
  id: string
  school_id: string
  title: string
  content: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  created_by: string
  created_at: string
  expires_at: string | null
}

export interface DemoMessage {
  id: string
  school_id: string
  recipient_type: 'individual' | 'class' | 'all'
  recipient_id: string | null
  phone: string | null
  message: string
  status: 'pending' | 'sent' | 'delivered' | 'failed'
  sent_by: string
  sent_at: string
}

export interface DemoCalendarEvent {
  id: string
  school_id: string
  title: string
  description: string
  event_type: 'exam' | 'meeting' | 'holiday' | 'event' | 'academic'
  start_date: string
  end_date: string | null
  created_by: string
}

export interface DemoExpense {
  id: string
  school_id: string
  category: string
  description: string
  amount: number
  approved_by: string | null
  status: 'pending' | 'approved' | 'rejected'
  date: string
  receipt_url: string | null
}

export interface DemoDiscipline {
  id: string
  student_id: string
  incident_type: 'misbehavior' | 'late' | 'uniform' | 'bullying' | 'other'
  description: string
  action_taken: string
  reported_by: string
  date: string
  parent_notified: boolean
}

export const DEMO_SCHOOL_ID = '00000000-0000-0000-0000-000000000001'

// Realistic Ugandan primary school data
export const DEMO_CLASSES: { id: string; school_id: string; name: string; level: string; stream: string | null; class_teacher_id: string | null; max_students: number; academic_year: string }[] = [
  { id: '1', school_id: DEMO_SCHOOL_ID, name: 'Baby Class', level: 'primary', stream: null, class_teacher_id: '5', max_students: 45, academic_year: '2025' },
  { id: '2', school_id: DEMO_SCHOOL_ID, name: 'Middle Class', level: 'primary', stream: null, class_teacher_id: '6', max_students: 45, academic_year: '2025' },
  { id: '3', school_id: DEMO_SCHOOL_ID, name: 'Top Class', level: 'primary', stream: null, class_teacher_id: '7', max_students: 45, academic_year: '2025' },
  { id: '4', school_id: DEMO_SCHOOL_ID, name: 'P.1', level: 'primary', stream: null, class_teacher_id: '8', max_students: 50, academic_year: '2025' },
  { id: '5', school_id: DEMO_SCHOOL_ID, name: 'P.2', level: 'primary', stream: null, class_teacher_id: '9', max_students: 50, academic_year: '2025' },
  { id: '6', school_id: DEMO_SCHOOL_ID, name: 'P.3', level: 'primary', stream: null, class_teacher_id: '10', max_students: 50, academic_year: '2025' },
  { id: '7', school_id: DEMO_SCHOOL_ID, name: 'P.4', level: 'primary', stream: 'A', class_teacher_id: '11', max_students: 50, academic_year: '2025' },
  { id: '8', school_id: DEMO_SCHOOL_ID, name: 'P.4', level: 'primary', stream: 'B', class_teacher_id: '12', max_students: 50, academic_year: '2025' },
  { id: '9', school_id: DEMO_SCHOOL_ID, name: 'P.5', level: 'primary', stream: 'A', class_teacher_id: '13', max_students: 50, academic_year: '2025' },
  { id: '10', school_id: DEMO_SCHOOL_ID, name: 'P.5', level: 'primary', stream: 'B', class_teacher_id: '14', max_students: 50, academic_year: '2025' },
  { id: '11', school_id: DEMO_SCHOOL_ID, name: 'P.6', level: 'primary', stream: 'A', class_teacher_id: '15', max_students: 50, academic_year: '2025' },
  { id: '12', school_id: DEMO_SCHOOL_ID, name: 'P.6', level: 'primary', stream: 'B', class_teacher_id: '16', max_students: 50, academic_year: '2025' },
  { id: '13', school_id: DEMO_SCHOOL_ID, name: 'P.7', level: 'primary', stream: 'A', class_teacher_id: '17', max_students: 50, academic_year: '2025' },
  { id: '14', school_id: DEMO_SCHOOL_ID, name: 'P.7', level: 'primary', stream: 'B', class_teacher_id: '18', max_students: 50, academic_year: '2025' },
]

export const DEMO_SUBJECTS: DemoSubject[] = [
  { id: '1', school_id: DEMO_SCHOOL_ID, name: 'English', code: 'ENG', level: 'primary', is_compulsory: true },
  { id: '2', school_id: DEMO_SCHOOL_ID, name: 'Mathematics', code: 'MATH', level: 'primary', is_compulsory: true },
  { id: '3', school_id: DEMO_SCHOOL_ID, name: 'Science', code: 'SCI', level: 'primary', is_compulsory: true },
  { id: '4', school_id: DEMO_SCHOOL_ID, name: 'Social Studies', code: 'SST', level: 'primary', is_compulsory: true },
  { id: '5', school_id: DEMO_SCHOOL_ID, name: 'Religious Education', code: 'CRE', level: 'primary', is_compulsory: true },
  { id: '6', school_id: DEMO_SCHOOL_ID, name: 'Creative Arts', code: 'CA', level: 'primary', is_compulsory: false },
  { id: '7', school_id: DEMO_SCHOOL_ID, name: 'Physical Education', code: 'PE', level: 'primary', is_compulsory: false },
]

export const DEMO_STUDENTS: DemoStudent[] = [
  // P.1 students (8)
  { id: '1', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2025-001', first_name: 'Amina', last_name: 'Nakamya', gender: 'F', date_of_birth: '2018-03-15', parent_name: 'Joseph Nakamya', parent_phone: '0772345001', parent_phone2: null, address: 'Kisenyi, Kampala', class_id: '4', admission_date: '2025-01-20', ple_index_number: null, status: 'active', opening_balance: 0 },
  { id: '2', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2025-002', first_name: 'Brian', last_name: 'Ochen', gender: 'M', date_of_birth: '2018-07-22', parent_name: 'Patrick Ochen', parent_phone: '0772345002', parent_phone2: '0702345002', address: 'Katwe, Kampala', class_id: '4', admission_date: '2025-01-20', ple_index_number: null, status: 'active', opening_balance: 50000 },
  { id: '3', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2025-003', first_name: 'Claire', last_name: 'Tumusiime', gender: 'F', date_of_birth: '2018-11-03', parent_name: 'Grace Tumusiime', parent_phone: '0772345003', parent_phone2: null, address: 'Bwaise, Kampala', class_id: '4', admission_date: '2025-01-20', ple_index_number: null, status: 'active', opening_balance: 0 },
  { id: '4', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2025-004', first_name: 'Daniel', last_name: 'Mugisha', gender: 'M', date_of_birth: '2018-01-10', parent_name: 'Robert Mugisha', parent_phone: '0772345004', parent_phone2: null, address: 'Ndeeba, Kampala', class_id: '4', admission_date: '2025-01-20', ple_index_number: null, status: 'active', opening_balance: 100000 },
  { id: '5', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2025-005', first_name: 'Esther', last_name: 'Nalubega', gender: 'F', date_of_birth: '2018-05-28', parent_name: 'Samuel Nalubega', parent_phone: '0772345005', parent_phone2: '0702345005', address: 'Lungujja, Kampala', class_id: '4', admission_date: '2025-01-20', ple_index_number: null, status: 'active', opening_balance: 0 },
  { id: '6', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2025-006', first_name: 'Frank', last_name: 'Okello', gender: 'M', date_of_birth: '2018-09-14', parent_name: 'James Okello', parent_phone: '0772345006', parent_phone2: null, address: 'Mulago, Kampala', class_id: '4', admission_date: '2025-01-20', ple_index_number: null, status: 'active', opening_balance: 0 },
  { id: '7', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2025-007', first_name: 'Gloria', last_name: 'Achieng', gender: 'F', date_of_birth: '2018-04-07', parent_name: 'Peter Achieng', parent_phone: '0772345007', parent_phone2: null, address: 'Nsambya, Kampala', class_id: '4', admission_date: '2025-01-20', ple_index_number: null, status: 'active', opening_balance: 75000 },
  { id: '8', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2025-008', first_name: 'Henry', last_name: 'Kato', gender: 'M', date_of_birth: '2018-12-19', parent_name: 'Michael Kato', parent_phone: '0772345008', parent_phone2: null, address: 'Kawempe, Kampala', class_id: '4', admission_date: '2025-01-20', ple_index_number: null, status: 'active', opening_balance: 0 },
  // P.3 students (6)
  { id: '9', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2023-009', first_name: 'Irene', last_name: 'Namugga', gender: 'F', date_of_birth: '2016-02-11', parent_name: 'David Namugga', parent_phone: '0772345009', parent_phone2: null, address: 'Kisenyi, Kampala', class_id: '6', admission_date: '2023-01-15', ple_index_number: null, status: 'active', opening_balance: 0 },
  { id: '10', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2023-010', first_name: 'Joseph', last_name: 'Ssemakula', gender: 'M', date_of_birth: '2016-06-30', parent_name: 'Charles Ssemakula', parent_phone: '0772345010', parent_phone2: '0702345010', address: 'Katwe, Kampala', class_id: '6', admission_date: '2023-01-15', ple_index_number: null, status: 'active', opening_balance: 150000 },
  { id: '11', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2023-011', first_name: 'Karen', last_name: 'Nantongo', gender: 'F', date_of_birth: '2016-08-17', parent_name: 'Paul Nantongo', parent_phone: '0772345011', parent_phone2: null, address: 'Bwaise, Kampala', class_id: '6', admission_date: '2023-01-15', ple_index_number: null, status: 'active', opening_balance: 0 },
  { id: '12', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2023-012', first_name: 'Luke', last_name: 'Byaruhanga', gender: 'M', date_of_birth: '2016-04-25', parent_name: 'Emmanuel Byaruhanga', parent_phone: '0772345012', parent_phone2: null, address: 'Ndeeba, Kampala', class_id: '6', admission_date: '2023-01-15', ple_index_number: null, status: 'active', opening_balance: 0 },
  { id: '13', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2023-013', first_name: 'Mercy', last_name: 'Nakato', gender: 'F', date_of_birth: '2016-10-09', parent_name: 'Andrew Nakato', parent_phone: '0772345013', parent_phone2: null, address: 'Lungujja, Kampala', class_id: '6', admission_date: '2023-01-15', ple_index_number: null, status: 'active', opening_balance: 200000 },
  { id: '14', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2023-014', first_name: 'Nathan', last_name: 'Ouma', gender: 'M', date_of_birth: '2016-01-05', parent_name: 'George Ouma', parent_phone: '0772345014', parent_phone2: null, address: 'Mulago, Kampala', class_id: '6', admission_date: '2023-01-15', ple_index_number: null, status: 'active', opening_balance: 0 },
  // P.5 students (8)
  { id: '15', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2021-015', first_name: 'Olivia', last_name: 'Babirye', gender: 'F', date_of_birth: '2014-03-20', parent_name: 'Timothy Babirye', parent_phone: '0772345015', parent_phone2: '0702345015', address: 'Nsambya, Kampala', class_id: '9', admission_date: '2021-01-18', ple_index_number: null, status: 'active', opening_balance: 0 },
  { id: '16', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2021-016', first_name: 'Patrick', last_name: 'Mukasa', gender: 'M', date_of_birth: '2014-07-14', parent_name: 'Richard Mukasa', parent_phone: '0772345016', parent_phone2: null, address: 'Kawempe, Kampala', class_id: '9', admission_date: '2021-01-18', ple_index_number: null, status: 'active', opening_balance: 100000 },
  { id: '17', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2021-017', first_name: 'Queen', last_name: 'Nalwoga', gender: 'F', date_of_birth: '2014-11-28', parent_name: 'Francis Nalwoga', parent_phone: '0772345017', parent_phone2: null, address: 'Kisenyi, Kampala', class_id: '9', admission_date: '2021-01-18', ple_index_number: null, status: 'active', opening_balance: 0 },
  { id: '18', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2021-018', first_name: 'Ronald', last_name: 'Ssempijja', gender: 'M', date_of_birth: '2014-05-02', parent_name: 'Steven Ssempijja', parent_phone: '0772345018', parent_phone2: null, address: 'Katwe, Kampala', class_id: '9', admission_date: '2021-01-18', ple_index_number: null, status: 'active', opening_balance: 250000 },
  { id: '19', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2021-019', first_name: 'Sarah', last_name: 'Nakayima', gender: 'F', date_of_birth: '2014-09-16', parent_name: 'Vincent Nakayima', parent_phone: '0772345019', parent_phone2: '0702345019', address: 'Bwaise, Kampala', class_id: '9', admission_date: '2021-01-18', ple_index_number: null, status: 'active', opening_balance: 0 },
  { id: '20', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2021-020', first_name: 'Thomas', last_name: 'Waiswa', gender: 'M', date_of_birth: '2014-01-30', parent_name: 'Isaac Waiswa', parent_phone: '0772345020', parent_phone2: null, address: 'Ndeeba, Kampala', class_id: '9', admission_date: '2021-01-18', ple_index_number: null, status: 'active', opening_balance: 0 },
  { id: '21', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2021-021', first_name: 'Ursula', last_name: 'Nabirye', gender: 'F', date_of_birth: '2014-04-12', parent_name: 'Moses Nabirye', parent_phone: '0772345021', parent_phone2: null, address: 'Lungujja, Kampala', class_id: '9', admission_date: '2021-01-18', ple_index_number: null, status: 'active', opening_balance: 50000 },
  { id: '22', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2021-022', first_name: 'Victor', last_name: 'Tumwine', gender: 'M', date_of_birth: '2014-08-08', parent_name: 'Simon Tumwine', parent_phone: '0772345022', parent_phone2: null, address: 'Mulago, Kampala', class_id: '9', admission_date: '2021-01-18', ple_index_number: null, status: 'active', opening_balance: 0 },
  // P.7 students (10)
  { id: '23', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2019-023', first_name: 'Winnie', last_name: 'Aanyu', gender: 'F', date_of_birth: '2012-02-25', parent_name: 'Daniel Aanyu', parent_phone: '0772345023', parent_phone2: '0702345023', address: 'Nsambya, Kampala', class_id: '13', admission_date: '2019-01-21', ple_index_number: null, status: 'active', opening_balance: 0 },
  { id: '24', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2019-024', first_name: 'Xavier', last_name: 'Kibuuka', gender: 'M', date_of_birth: '2012-06-18', parent_name: 'Martin Kibuuka', parent_phone: '0772345024', parent_phone2: null, address: 'Kawempe, Kampala', class_id: '13', admission_date: '2019-01-21', ple_index_number: null, status: 'active', opening_balance: 300000 },
  { id: '25', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2019-025', first_name: 'Yvonne', last_name: 'Namuggwa', gender: 'F', date_of_birth: '2012-10-03', parent_name: 'Anthony Namuggwa', parent_phone: '0772345025', parent_phone2: null, address: 'Kisenyi, Kampala', class_id: '13', admission_date: '2019-01-21', ple_index_number: null, status: 'active', opening_balance: 0 },
  { id: '26', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2019-026', first_name: 'Zack', last_name: 'Ssemugerera', gender: 'M', date_of_birth: '2012-04-15', parent_name: 'Eric Ssemugerera', parent_phone: '0772345026', parent_phone2: null, address: 'Katwe, Kampala', class_id: '13', admission_date: '2019-01-21', ple_index_number: null, status: 'active', opening_balance: 0 },
  { id: '27', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2019-027', first_name: 'Faith', last_name: 'Nakamya', gender: 'F', date_of_birth: '2012-08-22', parent_name: 'Joseph Nakamya', parent_phone: '0772345027', parent_phone2: '0702345027', address: 'Bwaise, Kampala', class_id: '13', admission_date: '2019-01-21', ple_index_number: null, status: 'active', opening_balance: 150000 },
  { id: '28', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2019-028', first_name: 'Allan', last_name: 'Ochen', gender: 'M', date_of_birth: '2012-01-09', parent_name: 'Patrick Ochen', parent_phone: '0772345028', parent_phone2: null, address: 'Ndeeba, Kampala', class_id: '13', admission_date: '2019-01-21', ple_index_number: null, status: 'active', opening_balance: 0 },
  { id: '29', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2019-029', first_name: 'Brenda', last_name: 'Tumusiime', gender: 'F', date_of_birth: '2012-05-17', parent_name: 'Grace Tumusiime', parent_phone: '0772345029', parent_phone2: null, address: 'Lungujja, Kampala', class_id: '13', admission_date: '2019-01-21', ple_index_number: null, status: 'active', opening_balance: 0 },
  { id: '30', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2019-030', first_name: 'Collins', last_name: 'Mugisha', gender: 'M', date_of_birth: '2012-09-30', parent_name: 'Robert Mugisha', parent_phone: '0772345030', parent_phone2: null, address: 'Mulago, Kampala', class_id: '13', admission_date: '2019-01-21', ple_index_number: null, status: 'active', opening_balance: 400000 },
  { id: '31', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2019-031', first_name: 'Diana', last_name: 'Nalubega', gender: 'F', date_of_birth: '2012-03-14', parent_name: 'Samuel Nalubega', parent_phone: '0772345031', parent_phone2: '0702345031', address: 'Nsambya, Kampala', class_id: '13', admission_date: '2019-01-21', ple_index_number: null, status: 'active', opening_balance: 0 },
  { id: '32', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2019-032', first_name: 'Emmanuel', last_name: 'Okello', gender: 'M', date_of_birth: '2012-07-26', parent_name: 'James Okello', parent_phone: '0772345032', parent_phone2: null, address: 'Kawempe, Kampala', class_id: '13', admission_date: '2019-01-21', ple_index_number: null, status: 'active', opening_balance: 0 },
  // Transferred and completed students
  { id: '33', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2019-033', first_name: 'Florence', last_name: 'Achieng', gender: 'F', date_of_birth: '2012-11-11', parent_name: 'Peter Achieng', parent_phone: '0772345033', parent_phone2: null, address: 'Kisenyi, Kampala', class_id: '13', admission_date: '2019-01-21', ple_index_number: 'PLE/2024/033', status: 'completed', opening_balance: 0 },
  { id: '34', school_id: DEMO_SCHOOL_ID, student_number: 'SMP-2020-034', first_name: 'Gerald', last_name: 'Kato', gender: 'M', date_of_birth: '2013-02-08', parent_name: 'Michael Kato', parent_phone: '0772345034', parent_phone2: null, address: 'Katwe, Kampala', class_id: '9', admission_date: '2020-01-20', ple_index_number: null, status: 'transferred', opening_balance: 0 },
]

export const DEMO_STAFF: DemoStaff[] = [
  { id: '1', school_id: DEMO_SCHOOL_ID, full_name: 'John Headmaster', phone: '0700000001', email: 'john@stmarys.edu.ug', role: 'headmaster', subject: 'Administration', gender: 'M', status: 'active', hire_date: '2015-01-15', salary: 1500000 },
  { id: '2', school_id: DEMO_SCHOOL_ID, full_name: 'Sarah Dean', phone: '0700000004', email: 'sarah@stmarys.edu.ug', role: 'dean_of_studies', subject: 'Mathematics', gender: 'F', status: 'active', hire_date: '2016-03-01', salary: 1200000 },
  { id: '3', school_id: DEMO_SCHOOL_ID, full_name: 'James Bursar', phone: '0700000003', email: 'james@stmarys.edu.ug', role: 'bursar', subject: 'Finance', gender: 'M', status: 'active', hire_date: '2017-06-01', salary: 1000000 },
  { id: '4', school_id: DEMO_SCHOOL_ID, full_name: 'Mary Teacher', phone: '0700000002', email: 'mary@stmarys.edu.ug', role: 'teacher', subject: 'English', gender: 'F', status: 'active', hire_date: '2018-01-15', salary: 800000 },
  { id: '5', school_id: DEMO_SCHOOL_ID, full_name: 'Grace Nakamya', phone: '0772100001', email: 'grace@stmarys.edu.ug', role: 'teacher', subject: 'Social Studies', gender: 'F', status: 'active', hire_date: '2019-02-01', salary: 750000 },
  { id: '6', school_id: DEMO_SCHOOL_ID, full_name: 'David Ochen', phone: '0772100002', email: 'david@stmarys.edu.ug', role: 'teacher', subject: 'Science', gender: 'M', status: 'active', hire_date: '2019-06-01', salary: 750000 },
  { id: '7', school_id: DEMO_SCHOOL_ID, full_name: 'Ruth Tumusiime', phone: '0772100003', email: 'ruth@stmarys.edu.ug', role: 'teacher', subject: 'Religious Education', gender: 'F', status: 'active', hire_date: '2020-01-15', salary: 700000 },
  { id: '8', school_id: DEMO_SCHOOL_ID, full_name: 'Peter Mugisha', phone: '0772100004', email: 'peter@stmarys.edu.ug', role: 'teacher', subject: 'Mathematics', gender: 'M', status: 'active', hire_date: '2020-06-01', salary: 700000 },
  { id: '9', school_id: DEMO_SCHOOL_ID, full_name: 'Agnes Nalubega', phone: '0772100005', email: 'agnes@stmarys.edu.ug', role: 'teacher', subject: 'English', gender: 'F', status: 'active', hire_date: '2021-01-15', salary: 650000 },
  { id: '10', school_id: DEMO_SCHOOL_ID, full_name: 'Samuel Okello', phone: '0772100006', email: 'samuel@stmarys.edu.ug', role: 'teacher', subject: 'Science', gender: 'M', status: 'active', hire_date: '2021-06-01', salary: 650000 },
  { id: '11', school_id: DEMO_SCHOOL_ID, full_name: 'Christine Babirye', phone: '0772100007', email: 'christine@stmarys.edu.ug', role: 'teacher', subject: 'Social Studies', gender: 'F', status: 'active', hire_date: '2022-01-15', salary: 600000 },
  { id: '12', school_id: DEMO_SCHOOL_ID, full_name: 'Joseph Mukasa', phone: '0772100008', email: 'joseph@stmarys.edu.ug', role: 'teacher', subject: 'Creative Arts', gender: 'M', status: 'active', hire_date: '2022-06-01', salary: 600000 },
  { id: '13', school_id: DEMO_SCHOOL_ID, full_name: 'Rebecca Nantongo', phone: '0772100009', email: 'rebecca@stmarys.edu.ug', role: 'teacher', subject: 'English', gender: 'F', status: 'active', hire_date: '2023-01-15', salary: 550000 },
  { id: '14', school_id: DEMO_SCHOOL_ID, full_name: 'Isaac Ssemakula', phone: '0772100010', email: 'isaac@stmarys.edu.ug', role: 'teacher', subject: 'Physical Education', gender: 'M', status: 'active', hire_date: '2023-06-01', salary: 550000 },
  { id: '15', school_id: DEMO_SCHOOL_ID, full_name: 'Esther Nakato', phone: '0772100011', email: 'esther@stmarys.edu.ug', role: 'teacher', subject: 'Mathematics', gender: 'F', status: 'active', hire_date: '2023-09-01', salary: 550000 },
  { id: '16', school_id: DEMO_SCHOOL_ID, full_name: 'Francis Ouma', phone: '0772100012', email: 'francis@stmarys.edu.ug', role: 'teacher', subject: 'Science', gender: 'M', status: 'active', hire_date: '2024-01-15', salary: 500000 },
  { id: '17', school_id: DEMO_SCHOOL_ID, full_name: 'Margaret Aanyu', phone: '0772100013', email: 'margaret@stmarys.edu.ug', role: 'teacher', subject: 'Social Studies', gender: 'F', status: 'active', hire_date: '2024-06-01', salary: 500000 },
  { id: '18', school_id: DEMO_SCHOOL_ID, full_name: 'Timothy Kato', phone: '0772100014', email: 'timothy@stmarys.edu.ug', role: 'teacher', subject: 'English', gender: 'M', status: 'active', hire_date: '2024-09-01', salary: 500000 },
]

export const DEMO_FEE_STRUCTURE: DemoFeeStructure[] = [
  { id: '1', school_id: DEMO_SCHOOL_ID, class_id: null, name: 'Tuition Fee', amount: 350000, term: 1, academic_year: '2025', due_date: '2025-02-15' },
  { id: '2', school_id: DEMO_SCHOOL_ID, class_id: null, name: 'Lunch Program', amount: 150000, term: 1, academic_year: '2025', due_date: '2025-02-15' },
  { id: '3', school_id: DEMO_SCHOOL_ID, class_id: null, name: 'Development Fee', amount: 50000, term: 1, academic_year: '2025', due_date: '2025-02-15' },
  { id: '4', school_id: DEMO_SCHOOL_ID, class_id: null, name: 'Sports & Games', amount: 30000, term: 1, academic_year: '2025', due_date: '2025-02-15' },
  { id: '5', school_id: DEMO_SCHOOL_ID, class_id: null, name: 'Computer Lab', amount: 40000, term: 1, academic_year: '2025', due_date: '2025-02-15' },
  { id: '6', school_id: DEMO_SCHOOL_ID, class_id: null, name: 'Tuition Fee', amount: 350000, term: 2, academic_year: '2025', due_date: '2025-06-15' },
  { id: '7', school_id: DEMO_SCHOOL_ID, class_id: null, name: 'Lunch Program', amount: 150000, term: 2, academic_year: '2025', due_date: '2025-06-15' },
  { id: '8', school_id: DEMO_SCHOOL_ID, class_id: null, name: 'Development Fee', amount: 50000, term: 2, academic_year: '2025', due_date: '2025-06-15' },
  { id: '9', school_id: DEMO_SCHOOL_ID, class_id: null, name: 'Sports & Games', amount: 30000, term: 2, academic_year: '2025', due_date: '2025-06-15' },
  { id: '10', school_id: DEMO_SCHOOL_ID, class_id: null, name: 'Computer Lab', amount: 40000, term: 2, academic_year: '2025', due_date: '2025-06-15' },
  // P.7 extra UNEB fees
  { id: '11', school_id: DEMO_SCHOOL_ID, class_id: '13', name: 'UNEB Registration', amount: 120000, term: 1, academic_year: '2025', due_date: '2025-03-01' },
  { id: '12', school_id: DEMO_SCHOOL_ID, class_id: '13', name: 'Mock Exam Fee', amount: 80000, term: 2, academic_year: '2025', due_date: '2025-07-01' },
  { id: '13', school_id: DEMO_SCHOOL_ID, class_id: '14', name: 'UNEB Registration', amount: 120000, term: 1, academic_year: '2025', due_date: '2025-03-01' },
  { id: '14', school_id: DEMO_SCHOOL_ID, class_id: '14', name: 'Mock Exam Fee', amount: 80000, term: 2, academic_year: '2025', due_date: '2025-07-01' },
]

export const DEMO_FEE_PAYMENTS: DemoFeePayment[] = [
  // Term 1 payments
  { id: '1', student_id: '1', fee_id: '1', amount_paid: 350000, payment_method: 'mobile_money', payment_reference: 'MM250115001', paid_by: 'Joseph Nakamya', notes: 'Full term 1 tuition', payment_date: '2025-01-15' },
  { id: '2', student_id: '1', fee_id: '2', amount_paid: 150000, payment_method: 'cash', payment_reference: null, paid_by: 'Joseph Nakamya', notes: null, payment_date: '2025-01-15' },
  { id: '3', student_id: '2', fee_id: '1', amount_paid: 200000, payment_method: 'mobile_money', payment_reference: 'MM250120002', paid_by: 'Patrick Ochen', notes: 'Partial payment', payment_date: '2025-01-20' },
  { id: '4', student_id: '3', fee_id: '1', amount_paid: 350000, payment_method: 'bank', payment_reference: 'BNK250118003', paid_by: 'Grace Tumusiime', notes: 'Paid via bank transfer', payment_date: '2025-01-18' },
  { id: '5', student_id: '3', fee_id: '2', amount_paid: 150000, payment_method: 'bank', payment_reference: 'BNK250118003', paid_by: 'Grace Tumusiime', notes: null, payment_date: '2025-01-18' },
  { id: '6', student_id: '4', fee_id: '1', amount_paid: 150000, payment_method: 'cash', payment_reference: null, paid_by: 'Robert Mugisha', notes: 'First installment', payment_date: '2025-01-25' },
  { id: '7', student_id: '5', fee_id: '1', amount_paid: 350000, payment_method: 'mobile_money', payment_reference: 'MM250122005', paid_by: 'Samuel Nalubega', notes: null, payment_date: '2025-01-22' },
  { id: '8', student_id: '5', fee_id: '2', amount_paid: 150000, payment_method: 'mobile_money', payment_reference: 'MM250122005', paid_by: 'Samuel Nalubega', notes: 'Lunch + tuition', payment_date: '2025-01-22' },
  { id: '9', student_id: '7', fee_id: '1', amount_paid: 175000, payment_method: 'installment', payment_reference: null, paid_by: 'Peter Achieng', notes: '50% payment', payment_date: '2025-01-28' },
  { id: '10', student_id: '10', fee_id: '1', amount_paid: 100000, payment_method: 'mobile_money', payment_reference: 'MM250201010', paid_by: 'Charles Ssemakula', notes: 'Partial', payment_date: '2025-02-01' },
  { id: '11', student_id: '13', fee_id: '1', amount_paid: 50000, payment_method: 'cash', payment_reference: null, paid_by: 'Andrew Nakato', notes: 'Small payment', payment_date: '2025-02-05' },
  { id: '12', student_id: '15', fee_id: '1', amount_paid: 350000, payment_method: 'mobile_money', payment_reference: 'MM250120015', paid_by: 'Timothy Babirye', notes: 'Full tuition term 1', payment_date: '2025-01-20' },
  { id: '13', student_id: '15', fee_id: '2', amount_paid: 150000, payment_method: 'mobile_money', payment_reference: 'MM250120015', paid_by: 'Timothy Babirye', notes: null, payment_date: '2025-01-20' },
  { id: '14', student_id: '16', fee_id: '1', amount_paid: 250000, payment_method: 'bank', payment_reference: 'BNK250125016', paid_by: 'Richard Mukasa', notes: null, payment_date: '2025-01-25' },
  { id: '15', student_id: '18', fee_id: '1', amount_paid: 100000, payment_method: 'mobile_money', payment_reference: 'MM250203018', paid_by: 'Steven Ssempijja', notes: 'Partial', payment_date: '2025-02-03' },
  { id: '16', student_id: '21', fee_id: '1', amount_paid: 200000, payment_method: 'cash', payment_reference: null, paid_by: 'Moses Nabirye', notes: null, payment_date: '2025-02-10' },
  { id: '17', student_id: '23', fee_id: '1', amount_paid: 350000, payment_method: 'mobile_money', payment_reference: 'MM250118023', paid_by: 'Daniel Aanyu', notes: null, payment_date: '2025-01-18' },
  { id: '18', student_id: '23', fee_id: '2', amount_paid: 150000, payment_method: 'mobile_money', payment_reference: 'MM250118023', paid_by: 'Daniel Aanyu', notes: null, payment_date: '2025-01-18' },
  { id: '19', student_id: '23', fee_id: '11', amount_paid: 120000, payment_method: 'mobile_money', payment_reference: 'MM250215023', paid_by: 'Daniel Aanyu', notes: 'UNEB registration', payment_date: '2025-02-15' },
  { id: '20', student_id: '24', fee_id: '1', amount_paid: 50000, payment_method: 'installment', payment_reference: null, paid_by: 'Martin Kibuuka', notes: 'First installment', payment_date: '2025-02-20' },
  { id: '21', student_id: '27', fee_id: '1', amount_paid: 200000, payment_method: 'mobile_money', payment_reference: 'MM250205027', paid_by: 'Joseph Nakamya', notes: null, payment_date: '2025-02-05' },
  { id: '22', student_id: '30', fee_id: '1', amount_paid: 0, payment_method: 'cash', payment_reference: null, paid_by: 'Robert Mugisha', notes: 'No payment yet', payment_date: '2025-02-28' },
  { id: '23', student_id: '25', fee_id: '1', amount_paid: 350000, payment_method: 'bank', payment_reference: 'BNK250122025', paid_by: 'Anthony Namuggwa', notes: 'Full payment', payment_date: '2025-01-22' },
  { id: '24', student_id: '25', fee_id: '2', amount_paid: 150000, payment_method: 'bank', payment_reference: 'BNK250122025', paid_by: 'Anthony Namuggwa', notes: null, payment_date: '2025-01-22' },
  { id: '25', student_id: '25', fee_id: '11', amount_paid: 120000, payment_method: 'bank', payment_reference: 'BNK250210025', paid_by: 'Anthony Namuggwa', notes: 'UNEB registration', payment_date: '2025-02-10' },
  { id: '26', student_id: '29', fee_id: '1', amount_paid: 350000, payment_method: 'mobile_money', payment_reference: 'MM250120029', paid_by: 'Grace Tumusiime', notes: null, payment_date: '2025-01-20' },
  { id: '27', student_id: '29', fee_id: '2', amount_paid: 150000, payment_method: 'mobile_money', payment_reference: 'MM250120029', paid_by: 'Grace Tumusiime', notes: null, payment_date: '2025-01-20' },
  { id: '28', student_id: '31', fee_id: '1', amount_paid: 350000, payment_method: 'mobile_money', payment_reference: 'MM250125031', paid_by: 'Samuel Nalubega', notes: null, payment_date: '2025-01-25' },
  { id: '29', student_id: '31', fee_id: '2', amount_paid: 150000, payment_method: 'mobile_money', payment_reference: 'MM250125031', paid_by: 'Samuel Nalubega', notes: null, payment_date: '2025-01-25' },
  { id: '30', student_id: '32', fee_id: '1', amount_paid: 350000, payment_method: 'cash', payment_reference: null, paid_by: 'James Okello', notes: 'Full tuition', payment_date: '2025-01-28' },
]

export const DEMO_GRADES: DemoGrade[] = [
  // P.7 Term 1 2025 - English
  { id: '1', student_id: '23', subject_id: '1', class_id: '13', assessment_type: 'ca1', score: 72, max_score: 100, term: 1, academic_year: '2025', recorded_by: '4' },
  { id: '2', student_id: '23', subject_id: '1', class_id: '13', assessment_type: 'ca2', score: 68, max_score: 100, term: 1, academic_year: '2025', recorded_by: '4' },
  { id: '3', student_id: '23', subject_id: '1', class_id: '13', assessment_type: 'exam', score: 75, max_score: 100, term: 1, academic_year: '2025', recorded_by: '4' },
  { id: '4', student_id: '24', subject_id: '1', class_id: '13', assessment_type: 'ca1', score: 45, max_score: 100, term: 1, academic_year: '2025', recorded_by: '4' },
  { id: '5', student_id: '24', subject_id: '1', class_id: '13', assessment_type: 'ca2', score: 52, max_score: 100, term: 1, academic_year: '2025', recorded_by: '4' },
  { id: '6', student_id: '24', subject_id: '1', class_id: '13', assessment_type: 'exam', score: 48, max_score: 100, term: 1, academic_year: '2025', recorded_by: '4' },
  { id: '7', student_id: '25', subject_id: '1', class_id: '13', assessment_type: 'ca1', score: 85, max_score: 100, term: 1, academic_year: '2025', recorded_by: '4' },
  { id: '8', student_id: '25', subject_id: '1', class_id: '13', assessment_type: 'ca2', score: 88, max_score: 100, term: 1, academic_year: '2025', recorded_by: '4' },
  { id: '9', student_id: '25', subject_id: '1', class_id: '13', assessment_type: 'exam', score: 90, max_score: 100, term: 1, academic_year: '2025', recorded_by: '4' },
  // P.7 Term 1 2025 - Mathematics
  { id: '10', student_id: '23', subject_id: '2', class_id: '13', assessment_type: 'ca1', score: 65, max_score: 100, term: 1, academic_year: '2025', recorded_by: '2' },
  { id: '11', student_id: '23', subject_id: '2', class_id: '13', assessment_type: 'ca2', score: 70, max_score: 100, term: 1, academic_year: '2025', recorded_by: '2' },
  { id: '12', student_id: '23', subject_id: '2', class_id: '13', assessment_type: 'exam', score: 68, max_score: 100, term: 1, academic_year: '2025', recorded_by: '2' },
  { id: '13', student_id: '24', subject_id: '2', class_id: '13', assessment_type: 'ca1', score: 38, max_score: 100, term: 1, academic_year: '2025', recorded_by: '2' },
  { id: '14', student_id: '24', subject_id: '2', class_id: '13', assessment_type: 'ca2', score: 42, max_score: 100, term: 1, academic_year: '2025', recorded_by: '2' },
  { id: '15', student_id: '24', subject_id: '2', class_id: '13', assessment_type: 'exam', score: 35, max_score: 100, term: 1, academic_year: '2025', recorded_by: '2' },
  { id: '16', student_id: '25', subject_id: '2', class_id: '13', assessment_type: 'ca1', score: 92, max_score: 100, term: 1, academic_year: '2025', recorded_by: '2' },
  { id: '17', student_id: '25', subject_id: '2', class_id: '13', assessment_type: 'ca2', score: 88, max_score: 100, term: 1, academic_year: '2025', recorded_by: '2' },
  { id: '18', student_id: '25', subject_id: '2', class_id: '13', assessment_type: 'exam', score: 95, max_score: 100, term: 1, academic_year: '2025', recorded_by: '2' },
  // P.7 Term 1 2025 - Science
  { id: '19', student_id: '23', subject_id: '3', class_id: '13', assessment_type: 'ca1', score: 70, max_score: 100, term: 1, academic_year: '2025', recorded_by: '6' },
  { id: '20', student_id: '23', subject_id: '3', class_id: '13', assessment_type: 'exam', score: 72, max_score: 100, term: 1, academic_year: '2025', recorded_by: '6' },
  { id: '21', student_id: '24', subject_id: '3', class_id: '13', assessment_type: 'ca1', score: 55, max_score: 100, term: 1, academic_year: '2025', recorded_by: '6' },
  { id: '22', student_id: '24', subject_id: '3', class_id: '13', assessment_type: 'exam', score: 50, max_score: 100, term: 1, academic_year: '2025', recorded_by: '6' },
  { id: '23', student_id: '25', subject_id: '3', class_id: '13', assessment_type: 'ca1', score: 80, max_score: 100, term: 1, academic_year: '2025', recorded_by: '6' },
  { id: '24', student_id: '25', subject_id: '3', class_id: '13', assessment_type: 'exam', score: 85, max_score: 100, term: 1, academic_year: '2025', recorded_by: '6' },
  // P.7 Term 1 2025 - Social Studies
  { id: '25', student_id: '23', subject_id: '4', class_id: '13', assessment_type: 'ca1', score: 78, max_score: 100, term: 1, academic_year: '2025', recorded_by: '5' },
  { id: '26', student_id: '23', subject_id: '4', class_id: '13', assessment_type: 'exam', score: 80, max_score: 100, term: 1, academic_year: '2025', recorded_by: '5' },
  { id: '27', student_id: '24', subject_id: '4', class_id: '13', assessment_type: 'ca1', score: 60, max_score: 100, term: 1, academic_year: '2025', recorded_by: '5' },
  { id: '28', student_id: '24', subject_id: '4', class_id: '13', assessment_type: 'exam', score: 55, max_score: 100, term: 1, academic_year: '2025', recorded_by: '5' },
  { id: '29', student_id: '25', subject_id: '4', class_id: '13', assessment_type: 'ca1', score: 82, max_score: 100, term: 1, academic_year: '2025', recorded_by: '5' },
  { id: '30', student_id: '25', subject_id: '4', class_id: '13', assessment_type: 'exam', score: 86, max_score: 100, term: 1, academic_year: '2025', recorded_by: '5' },
  // P.5 Term 1 2025 - English
  { id: '31', student_id: '15', subject_id: '1', class_id: '9', assessment_type: 'ca1', score: 78, max_score: 100, term: 1, academic_year: '2025', recorded_by: '13' },
  { id: '32', student_id: '15', subject_id: '1', class_id: '9', assessment_type: 'ca2', score: 82, max_score: 100, term: 1, academic_year: '2025', recorded_by: '13' },
  { id: '33', student_id: '15', subject_id: '1', class_id: '9', assessment_type: 'exam', score: 80, max_score: 100, term: 1, academic_year: '2025', recorded_by: '13' },
  { id: '34', student_id: '16', subject_id: '1', class_id: '9', assessment_type: 'ca1', score: 55, max_score: 100, term: 1, academic_year: '2025', recorded_by: '13' },
  { id: '35', student_id: '16', subject_id: '1', class_id: '9', assessment_type: 'exam', score: 60, max_score: 100, term: 1, academic_year: '2025', recorded_by: '13' },
  { id: '36', student_id: '17', subject_id: '1', class_id: '9', assessment_type: 'ca1', score: 90, max_score: 100, term: 1, academic_year: '2025', recorded_by: '13' },
  { id: '37', student_id: '17', subject_id: '1', class_id: '9', assessment_type: 'exam', score: 92, max_score: 100, term: 1, academic_year: '2025', recorded_by: '13' },
  // P.5 Term 1 2025 - Mathematics
  { id: '38', student_id: '15', subject_id: '2', class_id: '9', assessment_type: 'ca1', score: 70, max_score: 100, term: 1, academic_year: '2025', recorded_by: '15' },
  { id: '39', student_id: '15', subject_id: '2', class_id: '9', assessment_type: 'exam', score: 75, max_score: 100, term: 1, academic_year: '2025', recorded_by: '15' },
  { id: '40', student_id: '16', subject_id: '2', class_id: '9', assessment_type: 'ca1', score: 48, max_score: 100, term: 1, academic_year: '2025', recorded_by: '15' },
  { id: '41', student_id: '16', subject_id: '2', class_id: '9', assessment_type: 'exam', score: 52, max_score: 100, term: 1, academic_year: '2025', recorded_by: '15' },
  { id: '42', student_id: '17', subject_id: '2', class_id: '9', assessment_type: 'ca1', score: 85, max_score: 100, term: 1, academic_year: '2025', recorded_by: '15' },
  { id: '43', student_id: '17', subject_id: '2', class_id: '9', assessment_type: 'exam', score: 88, max_score: 100, term: 1, academic_year: '2025', recorded_by: '15' },
  // P.1 Term 1 2025 - English
  { id: '44', student_id: '1', subject_id: '1', class_id: '4', assessment_type: 'ca1', score: 65, max_score: 100, term: 1, academic_year: '2025', recorded_by: '8' },
  { id: '45', student_id: '1', subject_id: '1', class_id: '4', assessment_type: 'exam', score: 70, max_score: 100, term: 1, academic_year: '2025', recorded_by: '8' },
  { id: '46', student_id: '2', subject_id: '1', class_id: '4', assessment_type: 'ca1', score: 55, max_score: 100, term: 1, academic_year: '2025', recorded_by: '8' },
  { id: '47', student_id: '2', subject_id: '1', class_id: '4', assessment_type: 'exam', score: 58, max_score: 100, term: 1, academic_year: '2025', recorded_by: '8' },
  { id: '48', student_id: '3', subject_id: '1', class_id: '4', assessment_type: 'ca1', score: 80, max_score: 100, term: 1, academic_year: '2025', recorded_by: '8' },
  { id: '49', student_id: '3', subject_id: '1', class_id: '4', assessment_type: 'exam', score: 82, max_score: 100, term: 1, academic_year: '2025', recorded_by: '8' },
  // P.1 Term 1 2025 - Mathematics
  { id: '50', student_id: '1', subject_id: '2', class_id: '4', assessment_type: 'ca1', score: 70, max_score: 100, term: 1, academic_year: '2025', recorded_by: '8' },
  { id: '51', student_id: '1', subject_id: '2', class_id: '4', assessment_type: 'exam', score: 72, max_score: 100, term: 1, academic_year: '2025', recorded_by: '8' },
  { id: '52', student_id: '2', subject_id: '2', class_id: '4', assessment_type: 'ca1', score: 45, max_score: 100, term: 1, academic_year: '2025', recorded_by: '8' },
  { id: '53', student_id: '2', subject_id: '2', class_id: '4', assessment_type: 'exam', score: 50, max_score: 100, term: 1, academic_year: '2025', recorded_by: '8' },
  { id: '54', student_id: '3', subject_id: '2', class_id: '4', assessment_type: 'ca1', score: 88, max_score: 100, term: 1, academic_year: '2025', recorded_by: '8' },
  { id: '55', student_id: '3', subject_id: '2', class_id: '4', assessment_type: 'exam', score: 90, max_score: 100, term: 1, academic_year: '2025', recorded_by: '8' },
]

export const DEMO_ATTENDANCE: DemoAttendance[] = [
  // Today's attendance for P.7A
  { id: '1', student_id: '23', class_id: '13', date: '2025-03-24', status: 'present', remarks: null, recorded_by: '17' },
  { id: '2', student_id: '24', class_id: '13', date: '2025-03-24', status: 'present', remarks: null, recorded_by: '17' },
  { id: '3', student_id: '25', class_id: '13', date: '2025-03-24', status: 'present', remarks: null, recorded_by: '17' },
  { id: '4', student_id: '26', class_id: '13', date: '2025-03-24', status: 'late', remarks: 'Arrived 30 min late', recorded_by: '17' },
  { id: '5', student_id: '27', class_id: '13', date: '2025-03-24', status: 'present', remarks: null, recorded_by: '17' },
  { id: '6', student_id: '28', class_id: '13', date: '2025-03-24', status: 'absent', remarks: 'Sick - visited clinic', recorded_by: '17' },
  { id: '7', student_id: '29', class_id: '13', date: '2025-03-24', status: 'present', remarks: null, recorded_by: '17' },
  { id: '8', student_id: '30', class_id: '13', date: '2025-03-24', status: 'present', remarks: null, recorded_by: '17' },
  { id: '9', student_id: '31', class_id: '13', date: '2025-03-24', status: 'present', remarks: null, recorded_by: '17' },
  { id: '10', student_id: '32', class_id: '13', date: '2025-03-24', status: 'excused', remarks: 'Family emergency', recorded_by: '17' },
  // Yesterday's attendance for P.5A
  { id: '11', student_id: '15', class_id: '9', date: '2025-03-23', status: 'present', remarks: null, recorded_by: '13' },
  { id: '12', student_id: '16', class_id: '9', date: '2025-03-23', status: 'present', remarks: null, recorded_by: '13' },
  { id: '13', student_id: '17', class_id: '9', date: '2025-03-23', status: 'present', remarks: null, recorded_by: '13' },
  { id: '14', student_id: '18', class_id: '9', date: '2025-03-23', status: 'absent', remarks: 'No reason given', recorded_by: '13' },
  { id: '15', student_id: '19', class_id: '9', date: '2025-03-23', status: 'present', remarks: null, recorded_by: '13' },
  { id: '16', student_id: '20', class_id: '9', date: '2025-03-23', status: 'late', remarks: 'Bus breakdown', recorded_by: '13' },
  { id: '17', student_id: '21', class_id: '9', date: '2025-03-23', status: 'present', remarks: null, recorded_by: '13' },
  { id: '18', student_id: '22', class_id: '9', date: '2025-03-23', status: 'present', remarks: null, recorded_by: '13' },
  // P.1 attendance
  { id: '19', student_id: '1', class_id: '4', date: '2025-03-24', status: 'present', remarks: null, recorded_by: '8' },
  { id: '20', student_id: '2', class_id: '4', date: '2025-03-24', status: 'present', remarks: null, recorded_by: '8' },
  { id: '21', student_id: '3', class_id: '4', date: '2025-03-24', status: 'present', remarks: null, recorded_by: '8' },
  { id: '22', student_id: '4', class_id: '4', date: '2025-03-24', status: 'absent', remarks: 'Parent called - sick', recorded_by: '8' },
  { id: '23', student_id: '5', class_id: '4', date: '2025-03-24', status: 'present', remarks: null, recorded_by: '8' },
  { id: '24', student_id: '6', class_id: '4', date: '2025-03-24', status: 'present', remarks: null, recorded_by: '8' },
  { id: '25', student_id: '7', class_id: '4', date: '2025-03-24', status: 'late', remarks: 'Missed morning assembly', recorded_by: '8' },
  { id: '26', student_id: '8', class_id: '4', date: '2025-03-24', status: 'present', remarks: null, recorded_by: '8' },
  // P.3 attendance
  { id: '27', student_id: '9', class_id: '6', date: '2025-03-24', status: 'present', remarks: null, recorded_by: '10' },
  { id: '28', student_id: '10', class_id: '6', date: '2025-03-24', status: 'present', remarks: null, recorded_by: '10' },
  { id: '29', student_id: '11', class_id: '6', date: '2025-03-24', status: 'absent', remarks: 'Family function', recorded_by: '10' },
  { id: '30', student_id: '12', class_id: '6', date: '2025-03-24', status: 'present', remarks: null, recorded_by: '10' },
  { id: '31', student_id: '13', class_id: '6', date: '2025-03-24', status: 'present', remarks: null, recorded_by: '10' },
  { id: '32', student_id: '14', class_id: '6', date: '2025-03-24', status: 'present', remarks: null, recorded_by: '10' },
]

export const DEMO_NOTICES: DemoNotice[] = [
  { id: '1', school_id: DEMO_SCHOOL_ID, title: 'Term 2 Fees Due', content: 'All Term 2 fees must be paid by June 15, 2025. Students with outstanding balances will not be allowed to sit for mid-term exams.', priority: 'high', created_by: '3', created_at: '2025-03-20', expires_at: '2025-06-15' },
  { id: '2', school_id: DEMO_SCHOOL_ID, title: 'UNEB Registration Deadline', content: 'All P.7 students must complete UNEB registration by March 31, 2025. Late registration attracts a penalty fee of UGX 50,000.', priority: 'urgent', created_by: '2', created_at: '2025-03-15', expires_at: '2025-03-31' },
  { id: '3', school_id: DEMO_SCHOOL_ID, title: 'Staff Meeting - April 5', content: 'All staff are required to attend the term 2 planning meeting on Saturday, April 5, 2025 at 9:00 AM in the staff room.', priority: 'medium', created_by: '1', created_at: '2025-03-22', expires_at: '2025-04-05' },
  { id: '4', school_id: DEMO_SCHOOL_ID, title: 'Inter-School Sports Competition', content: 'The annual inter-school sports competition will be held on April 12, 2025. All selected athletes should report for practice every evening this week.', priority: 'low', created_by: '14', created_at: '2025-03-18', expires_at: '2025-04-12' },
  { id: '5', school_id: DEMO_SCHOOL_ID, title: 'Parent-Teacher Conference', content: 'The Term 1 Parent-Teacher Conference is scheduled for April 19, 2025. All parents are encouraged to attend to discuss their children\'s academic progress.', priority: 'medium', created_by: '1', created_at: '2025-03-25', expires_at: '2025-04-19' },
]

export const DEMO_MESSAGES: DemoMessage[] = [
  { id: '1', school_id: DEMO_SCHOOL_ID, recipient_type: 'all', recipient_id: null, phone: null, message: 'Dear Parents, this is a reminder that Term 1 ends on April 4, 2025. Report cards will be available for pickup on April 5. Term 2 begins April 21, 2025.', status: 'sent', sent_by: '1', sent_at: '2025-03-20' },
  { id: '2', school_id: DEMO_SCHOOL_ID, recipient_type: 'individual', recipient_id: '24', phone: '0772345024', message: 'Dear Mr. Kibuuka, your son Xavier has an outstanding fee balance of UGX 570,000. Please settle this before the end of Term 1.', status: 'sent', sent_by: '3', sent_at: '2025-03-18' },
  { id: '3', school_id: DEMO_SCHOOL_ID, recipient_type: 'individual', recipient_id: '13', phone: '0772345013', message: 'Dear Mr. Nakato, Mercy has been absent for 3 consecutive days without explanation. Please contact the school office.', status: 'delivered', sent_by: '10', sent_at: '2025-03-22' },
  { id: '4', school_id: DEMO_SCHOOL_ID, recipient_type: 'class', recipient_id: '13', phone: null, message: 'Attention P.7A: Mock exams begin April 7, 2025. Timetable has been posted on the notice board. Come prepared.', status: 'sent', sent_by: '2', sent_at: '2025-03-24' },
]

export const DEMO_EVENTS: DemoCalendarEvent[] = [
  { id: '1', school_id: DEMO_SCHOOL_ID, title: 'Term 1 Ends', description: 'Last day of Term 1. Report cards distributed.', event_type: 'academic', start_date: '2025-04-04', end_date: '2025-04-04', created_by: '1' },
  { id: '2', school_id: DEMO_SCHOOL_ID, title: 'Parent-Teacher Conference', description: 'Meet with teachers to discuss student progress.', event_type: 'meeting', start_date: '2025-04-19', end_date: '2025-04-19', created_by: '1' },
  { id: '3', school_id: DEMO_SCHOOL_ID, title: 'Term 2 Begins', description: 'First day of Term 2. All students report by 7:30 AM.', event_type: 'academic', start_date: '2025-04-21', end_date: '2025-04-21', created_by: '1' },
  { id: '4', school_id: DEMO_SCHOOL_ID, title: 'Inter-School Sports Day', description: 'Annual sports competition with neighboring schools.', event_type: 'event', start_date: '2025-04-12', end_date: '2025-04-12', created_by: '14' },
  { id: '5', school_id: DEMO_SCHOOL_ID, title: 'P.7 Mock Exams', description: 'Mock examinations for P.7 students.', event_type: 'exam', start_date: '2025-04-07', end_date: '2025-04-11', created_by: '2' },
  { id: '6', school_id: DEMO_SCHOOL_ID, title: 'Labour Day Holiday', description: 'Public holiday - school closed.', event_type: 'holiday', start_date: '2025-05-01', end_date: '2025-05-01', created_by: '1' },
  { id: '7', school_id: DEMO_SCHOOL_ID, title: 'UNEB Registration Deadline', description: 'Last day for P.7 UNEB registration.', event_type: 'academic', start_date: '2025-03-31', end_date: '2025-03-31', created_by: '2' },
  { id: '8', school_id: DEMO_SCHOOL_ID, title: 'Mid-Term Exams', description: 'Term 2 mid-term examinations for all classes.', event_type: 'exam', start_date: '2025-05-19', end_date: '2025-05-23', created_by: '2' },
]

export const DEMO_EXPENSES: DemoExpense[] = [
  { id: '1', school_id: DEMO_SCHOOL_ID, category: 'Supplies', description: 'Exercise books and pens for Term 2', amount: 2500000, approved_by: '1', status: 'approved', date: '2025-03-15', receipt_url: null },
  { id: '2', school_id: DEMO_SCHOOL_ID, category: 'Maintenance', description: 'Classroom P.4 roof repair', amount: 1800000, approved_by: '1', status: 'approved', date: '2025-03-10', receipt_url: null },
  { id: '3', school_id: DEMO_SCHOOL_ID, category: 'Utilities', description: 'Electricity bill - February 2025', amount: 450000, approved_by: '3', status: 'approved', date: '2025-03-05', receipt_url: null },
  { id: '4', school_id: DEMO_SCHOOL_ID, category: 'Transport', description: 'School bus fuel - March 2025', amount: 600000, approved_by: '3', status: 'approved', date: '2025-03-20', receipt_url: null },
  { id: '5', school_id: DEMO_SCHOOL_ID, category: 'Sports', description: 'Sports equipment for inter-school competition', amount: 800000, approved_by: null, status: 'pending', date: '2025-03-22', receipt_url: null },
  { id: '6', school_id: DEMO_SCHOOL_ID, category: 'IT', description: 'Computer lab software licenses', amount: 1200000, approved_by: '1', status: 'approved', date: '2025-03-18', receipt_url: null },
  { id: '7', school_id: DEMO_SCHOOL_ID, category: 'Staff Welfare', description: 'Staff lunch program - Term 1', amount: 3500000, approved_by: '1', status: 'approved', date: '2025-03-01', receipt_url: null },
]

export const DEMO_DISCIPLINE: DemoDiscipline[] = [
  { id: '1', student_id: '24', incident_type: 'late', description: 'Repeatedly arriving late to school (3 times this week)', action_taken: 'Warning issued, parent notified', reported_by: '17', date: '2025-03-20', parent_notified: true },
  { id: '2', student_id: '18', incident_type: 'misbehavior', description: 'Disrupting class during Mathematics lesson', action_taken: 'Detention assigned, apology letter to teacher', reported_by: '15', date: '2025-03-18', parent_notified: true },
  { id: '3', student_id: '4', incident_type: 'uniform', description: 'Not wearing proper school uniform', action_taken: 'Sent home to change', reported_by: '8', date: '2025-03-24', parent_notified: false },
  { id: '4', student_id: '10', incident_type: 'bullying', description: 'Bullying younger students during break time', action_taken: 'Counselling session scheduled, parent meeting', reported_by: '5', date: '2025-03-15', parent_notified: true },
]

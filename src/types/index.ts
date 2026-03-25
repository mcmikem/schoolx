// School types
export interface School {
  id: string
  name: string
  school_code: string
  district: string
  subcounty?: string
  parish?: string
  village?: string
  school_type: 'primary' | 'secondary' | 'combined'
  ownership: 'private' | 'government' | 'government_aided'
  phone?: string
  email?: string
  logo_url?: string
  primary_color: string
  uneab_center_number?: string
  subscription_plan: 'free' | 'basic' | 'premium'
  subscription_status: 'active' | 'expired' | 'trial'
  trial_ends_at?: string
  created_at: string
}

// User types
export interface User {
  id: string
  auth_id: string
  school_id: string | null
  full_name: string
  phone: string
  email?: string
  role: 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'parent'
  avatar_url?: string
  is_active: boolean
  created_at: string
}

// Student types
export interface Student {
  id: string
  school_id: string
  user_id?: string
  student_number: string
  first_name: string
  last_name: string
  gender: 'M' | 'F'
  date_of_birth?: string
  parent_name: string
  parent_phone: string
  parent_phone2?: string
  parent_email?: string
  address?: string
  class_id: string
  admission_date: string
  ple_index_number?: string
  uneab_number?: string
  blood_type?: string
  religion?: string
  nationality?: string
  photo_url?: string
  status: 'active' | 'transferred' | 'dropped' | 'completed'
  created_at: string
  classes?: Class
}

export interface CreateStudentInput {
  first_name: string
  last_name: string
  gender: 'M' | 'F'
  date_of_birth?: string
  parent_name: string
  parent_phone: string
  parent_phone2?: string
  class_id: string
  student_number?: string
  ple_index_number?: string
  status?: 'active'
}

// Class types
export interface Class {
  id: string
  school_id: string
  name: string
  level: string
  stream?: string
  class_teacher_id?: string
  max_students: number
  academic_year: string
  created_at: string
}

// Subject types
export interface Subject {
  id: string
  school_id: string
  name: string
  code: string
  level: 'primary' | 'secondary' | 'both'
  is_compulsory: boolean
  created_at: string
}

// Attendance types
export interface Attendance {
  id: string
  student_id: string
  class_id: string
  date: string
  status: 'present' | 'absent' | 'late' | 'excused'
  remarks?: string
  recorded_by: string
  created_at: string
  students?: Student
}

// Grade types
export interface Grade {
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
  created_at: string
  subjects?: Subject
}

export interface SubjectGrades {
  name: string
  code: string
  ca1: number
  ca2: number
  ca3: number
  ca4: number
  project: number
  exam: number
  totalCA: number
  finalScore: number
  grade: string
}

// Fee types
export interface FeeStructure {
  id: string
  school_id: string
  class_id?: string
  name: string
  amount: number
  term: 1 | 2 | 3
  academic_year: string
  due_date?: string
  created_at: string
  classes?: Class
}

export interface FeePayment {
  id: string
  student_id: string
  fee_id: string
  amount_paid: number
  payment_method: 'cash' | 'mobile_money' | 'bank' | 'installment'
  payment_reference?: string
  paid_by?: string
  notes?: string
  payment_date: string
  created_at: string
  students?: Student & { classes?: Class }
}

export interface CreatePaymentInput {
  student_id: string
  fee_id?: string
  amount_paid: number
  payment_method: 'cash' | 'mobile_money' | 'bank' | 'installment'
  payment_reference?: string
  paid_by?: string
  notes?: string
}

// Message types
export interface Message {
  id: string
  school_id: string
  recipient_type: 'individual' | 'class' | 'all'
  recipient_id?: string
  phone?: string
  message: string
  status: 'pending' | 'sent' | 'delivered' | 'failed'
  sent_by: string
  sent_at?: string
  created_at: string
}

// Event types
export interface CalendarEvent {
  id: string
  school_id: string
  title: string
  description?: string
  event_type: 'exam' | 'meeting' | 'holiday' | 'event' | 'academic'
  start_date: string
  end_date?: string
  created_by: string
  created_at: string
}

// Report types
export interface ReportCard {
  student: Pick<Student, 'first_name' | 'last_name' | 'student_number' | 'gender'> & {
    ple_index_number?: string
    classes?: Pick<Class, 'name' | 'level'>
  }
  school?: Pick<School, 'name' | 'district'> & {
    uneab_center_number?: string
    logo_url?: string
  }
  term: number
  academicYear: string
  subjects: SubjectGrades[]
  attendance: {
    total: number
    present: number
    absent: number
    late: number
  }
  overall: {
    average: number
    grade: string
    division: string
    position?: number | null
  }
}

// Dashboard stats
export interface DashboardStats {
  totalStudents: number
  totalStaff: number
  attendanceRate: number
  feeCollectionRate: number
  maleStudents: number
  femaleStudents: number
}

// Timetable types
export interface TimetableEntry {
  id: string
  school_id: string
  class_id: string
  subject_id: string
  teacher_id?: string
  day_of_week: number
  start_time: string
  end_time: string
  room?: string
  created_at: string
  classes?: Class
  subjects?: Subject
}

// Navigation types
export interface NavItem {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  hasDropdown?: boolean
}

// Form types
export interface LoginForm {
  phone: string
  password: string
}

export interface RegisterForm {
  schoolName: string
  schoolCode: string
  district: string
  subcounty: string
  schoolType: 'primary' | 'secondary' | 'combined'
  ownership: 'private' | 'government' | 'government_aided'
  phone: string
  email: string
  adminName: string
  adminPhone: string
  password: string
  confirmPassword: string
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Filter types
export interface StudentFilter {
  searchTerm: string
  classId: string
  status?: 'active' | 'transferred' | 'dropped' | 'completed'
}

export interface FeeFilter {
  searchTerm: string
  classId: string
  paymentMethod?: 'cash' | 'mobile_money' | 'bank' | 'installment'
}

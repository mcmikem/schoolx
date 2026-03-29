// User roles and permissions system

export type UserRole = 
  | 'teacher' 
  | 'dean_of_studies' 
  | 'bursar' 
  | 'headmaster' 
  | 'board' 
  | 'parent' 
  | 'admin'
  | 'school_admin'
  | 'super_admin'
  | 'secretary'
  | 'dorm_master'

export interface RolePermissions {
  students: boolean
  attendance: boolean
  grades: boolean
  fees: boolean
  messages: boolean
  reports: boolean
  staff: boolean
  settings: boolean
  discipline: boolean
  invoicing: boolean
  assets: boolean
  analytics: boolean
  export: boolean
  boardReport: boolean
  autoSMS: boolean
  warnings: boolean
  visitors: boolean
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  teacher: {
    students: true,
    attendance: true,
    grades: true,
    fees: false,
    messages: false,
    reports: true,
    staff: false,
    settings: false,
    discipline: false,
    invoicing: false,
    assets: false,
    analytics: false,
    export: false,
    boardReport: false,
    autoSMS: false,
    warnings: false,
    visitors: false,
  },
  dean_of_studies: {
    students: true,
    attendance: true,
    grades: true,
    fees: false,
    messages: false,
    reports: true,
    staff: false,
    settings: false,
    discipline: true,
    invoicing: false,
    assets: false,
    analytics: true,
    export: true,
    boardReport: false,
    autoSMS: false,
    warnings: true,
    visitors: false,
  },
  bursar: {
    students: true,
    attendance: false,
    grades: false,
    fees: true,
    messages: true,
    reports: true,
    staff: false,
    settings: false,
    discipline: false,
    invoicing: true,
    assets: false,
    analytics: false,
    export: true,
    boardReport: false,
    autoSMS: true,
    warnings: false,
    visitors: false,
  },
  headmaster: {
    students: true,
    attendance: true,
    grades: true,
    fees: true,
    messages: true,
    reports: true,
    staff: true,
    settings: true,
    discipline: true,
    invoicing: true,
    assets: true,
    analytics: true,
    export: true,
    boardReport: true,
    autoSMS: true,
    warnings: true,
    visitors: true,
  },
  board: {
    students: false,
    attendance: false,
    grades: false,
    fees: false,
    messages: false,
    reports: true,
    staff: false,
    settings: false,
    discipline: false,
    invoicing: false,
    assets: false,
    analytics: true,
    export: false,
    boardReport: true,
    autoSMS: false,
    warnings: false,
    visitors: false,
  },
  parent: {
    students: false,
    attendance: false,
    grades: false,
    fees: false,
    messages: false,
    reports: false,
    staff: false,
    settings: false,
    discipline: false,
    invoicing: false,
    assets: false,
    analytics: false,
    export: false,
    boardReport: false,
    autoSMS: false,
    warnings: false,
    visitors: false,
  },
  admin: {
    students: true,
    attendance: true,
    grades: true,
    fees: true,
    messages: true,
    reports: true,
    staff: true,
    settings: true,
    discipline: true,
    invoicing: true,
    assets: true,
    analytics: true,
    export: true,
    boardReport: true,
    autoSMS: true,
    warnings: true,
    visitors: true,
  },
  school_admin: {
    students: true,
    attendance: true,
    grades: true,
    fees: true,
    messages: true,
    reports: true,
    staff: true,
    settings: true,
    discipline: true,
    invoicing: true,
    assets: true,
    analytics: true,
    export: true,
    boardReport: true,
    autoSMS: true,
    warnings: true,
    visitors: true,
  },
  super_admin: {
    students: true,
    attendance: true,
    grades: true,
    fees: true,
    messages: true,
    reports: true,
    staff: true,
    settings: true,
    discipline: true,
    invoicing: true,
    assets: true,
    analytics: true,
    export: true,
    boardReport: true,
    autoSMS: true,
    warnings: true,
    visitors: true,
  },
  secretary: {
    students: false,
    attendance: false,
    grades: false,
    fees: false,
    messages: true,
    reports: false,
    staff: false,
    settings: false,
    discipline: false,
    invoicing: false,
    assets: false,
    analytics: false,
    export: false,
    boardReport: false,
    autoSMS: true,
    warnings: false,
    visitors: true,
  },
  dorm_master: {
    students: true,
    attendance: true,
    grades: false,
    fees: false,
    messages: false,
    reports: false,
    staff: false,
    settings: false,
    discipline: true,
    invoicing: false,
    assets: false,
    analytics: false,
    export: false,
    boardReport: false,
    autoSMS: false,
    warnings: false,
    visitors: false,
  },
}

export const ROLE_LABELS: Record<UserRole, string> = {
  teacher: 'Teacher',
  dean_of_studies: 'Dean of Studies',
  bursar: 'Bursar',
  headmaster: 'Headteacher',
  board: 'Board Member',
  parent: 'Parent',
  admin: 'Administrator',
  school_admin: 'School Admin',
  super_admin: 'Super Admin',
  secretary: 'Secretary',
  dorm_master: 'Dorm Master',
}

export function canAccess(role: UserRole, feature: keyof RolePermissions): boolean {
  return ROLE_PERMISSIONS[role]?.[feature] ?? false
}

export function getRoleLabel(role: UserRole): string {
  return ROLE_LABELS[role] ?? role
}

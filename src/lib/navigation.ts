// Navigation configuration for SchoolX
// Organized by logical groups with collapsible sections

interface NavItem {
  href: string
  label: string
  icon: string
  badge?: string
}

interface NavGroup {
  label: string
  icon?: string
  items: NavItem[]
  defaultOpen?: boolean
}

// Define navigation by role
export const navigationByRole: Record<string, NavGroup[]> = {
  headmaster: [
    {
      label: 'Overview',
      icon: 'dashboard',
      defaultOpen: true,
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
        { href: '/dashboard/analytics', label: 'Analytics', icon: 'analytics', badge: 'New' },
      ]
    },
    {
      label: 'Students',
      icon: 'group',
      defaultOpen: true,
      items: [
        { href: '/dashboard/students', label: 'Student Registry', icon: 'group' },
        { href: '/dashboard/attendance', label: 'Attendance', icon: 'how_to_reg' },
        { href: '/dashboard/grades', label: 'Grades & Reports', icon: 'menu_book' },
        { href: '/dashboard/exams', label: 'Exams', icon: 'fact_check' },
        { href: '/dashboard/promotion', label: 'Promotion', icon: 'trending_up' },
      ]
    },
    {
      label: 'Staff',
      icon: 'person',
      defaultOpen: false,
      items: [
        { href: '/dashboard/staff', label: 'Staff Directory', icon: 'person' },
        { href: '/dashboard/staff-attendance', label: 'Staff Attendance', icon: 'how_to_reg' },
        { href: '/dashboard/leave', label: 'Leave Requests', icon: 'event_busy' },
        { href: '/dashboard/payroll', label: 'Payroll', icon: 'payments', badge: 'New' },
      ]
    },
    {
      label: 'Finance',
      icon: 'payments',
      defaultOpen: false,
      items: [
        { href: '/dashboard/fees', label: 'Fee Collection', icon: 'payments' },
        { href: '/dashboard/budget', label: 'Budget', icon: 'account_balance_wallet' },
        { href: '/dashboard/expenses', label: 'Expenses', icon: 'receipt_long' },
        { href: '/dashboard/reports', label: 'Financial Reports', icon: 'analytics' },
      ]
    },
    {
      label: 'Communication',
      icon: 'chat',
      defaultOpen: false,
      items: [
        { href: '/dashboard/messages', label: 'Messages', icon: 'chat' },
        { href: '/dashboard/notices', label: 'Announcements', icon: 'campaign' },
        { href: '/dashboard/sms', label: 'SMS Center', icon: 'sms' },
      ]
    },
    {
      label: 'Administration',
      icon: 'settings',
      defaultOpen: false,
      items: [
        { href: '/dashboard/timetable', label: 'Timetable', icon: 'calendar_month' },
        { href: '/dashboard/settings', label: 'School Settings', icon: 'settings' },
        { href: '/dashboard/audit', label: 'Audit Log', icon: 'history' },
      ]
    },
  ],
  
  dean_of_studies: [
    {
      label: 'Overview',
      defaultOpen: true,
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
      ]
    },
    {
      label: 'Academics',
      defaultOpen: true,
      items: [
        { href: '/dashboard/students', label: 'Students', icon: 'group' },
        { href: '/dashboard/attendance', label: 'Attendance', icon: 'how_to_reg' },
        { href: '/dashboard/grades', label: 'Grades', icon: 'menu_book' },
        { href: '/dashboard/exams', label: 'Exams', icon: 'fact_check' },
        { href: '/dashboard/timetable', label: 'Timetable', icon: 'calendar_month' },
      ]
    },
    {
      label: 'Planning',
      defaultOpen: false,
      items: [
        { href: '/dashboard/lesson-plans', label: 'Lesson Plans', icon: 'menu_book' },
        { href: '/dashboard/scheme-of-work', label: 'Scheme of Work', icon: 'list_alt' },
        { href: '/dashboard/promotion', label: 'Promotion', icon: 'trending_up' },
      ]
    },
    {
      label: 'Reports',
      defaultOpen: false,
      items: [
        { href: '/dashboard/reports', label: 'Reports', icon: 'description' },
        { href: '/dashboard/uneb', label: 'UNEB', icon: 'workspace_premium' },
      ]
    },
  ],
  
  bursar: [
    {
      label: 'Overview',
      defaultOpen: true,
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
      ]
    },
    {
      label: 'Fee Management',
      defaultOpen: true,
      items: [
        { href: '/dashboard/fees', label: 'Collect Fees', icon: 'payments' },
        { href: '/dashboard/students', label: 'Students', icon: 'group' },
        { href: '/dashboard/payment-plans', label: 'Payment Plans', icon: 'calendar_month' },
      ]
    },
    {
      label: 'Finance',
      defaultOpen: false,
      items: [
        { href: '/dashboard/budget', label: 'Budget', icon: 'account_balance_wallet' },
        { href: '/dashboard/expenses', label: 'Expenses', icon: 'receipt_long' },
        { href: '/dashboard/payroll', label: 'Payroll', icon: 'payments' },
        { href: '/dashboard/reports', label: 'Reports', icon: 'analytics' },
      ]
    },
    {
      label: 'Communication',
      defaultOpen: false,
      items: [
        { href: '/dashboard/messages', label: 'Messages', icon: 'chat' },
      ]
    },
  ],
  
  teacher: [
    {
      label: 'My Classes',
      defaultOpen: true,
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
        { href: '/dashboard/attendance', label: 'Take Attendance', icon: 'how_to_reg' },
        { href: '/dashboard/grades', label: 'Enter Grades', icon: 'menu_book' },
        { href: '/dashboard/homework', label: 'Homework', icon: 'assignment' },
      ]
    },
    {
      label: 'Planning',
      defaultOpen: false,
      items: [
        { href: '/dashboard/lesson-plans', label: 'Lesson Plans', icon: 'menu_book' },
        { href: '/dashboard/scheme-of-work', label: 'Scheme of Work', icon: 'list_alt' },
        { href: '/dashboard/timetable', label: 'Timetable', icon: 'calendar_month' },
      ]
    },
  ],
  
  secretary: [
    {
      label: 'Office',
      defaultOpen: true,
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
        { href: '/dashboard/visitors', label: 'Visitors Log', icon: 'badge' },
      ]
    },
    {
      label: 'Communication',
      defaultOpen: false,
      items: [
        { href: '/dashboard/messages', label: 'Messages', icon: 'chat' },
        { href: '/dashboard/notices', label: 'Notices', icon: 'campaign' },
      ]
    },
  ],
  
  dorm_master: [
    {
      label: 'Dormitory',
      defaultOpen: true,
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
        { href: '/dashboard/dorm', label: 'Dorm Management', icon: 'bed' },
        { href: '/dashboard/dorm-attendance', label: 'Dorm Attendance', icon: 'nightlight' },
      ]
    },
    {
      label: 'Welfare',
      defaultOpen: false,
      items: [
        { href: '/dashboard/students', label: 'Students', icon: 'group' },
        { href: '/dashboard/health', label: 'Health Records', icon: 'medical_services' },
        { href: '/dashboard/discipline', label: 'Discipline', icon: 'warning' },
      ]
    },
  ],
}

export function getNavigationForRole(role: string): NavGroup[] {
  return navigationByRole[role] || navigationByRole.teacher
}

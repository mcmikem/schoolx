// Navigation configuration for SchoolX
// Organized by logical groups with collapsible sections

interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: string;
}

export interface NavGroup {
  label: string;
  icon?: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

// Define navigation by role
export const navigationByRole: Record<string, NavGroup[]> = {
  headmaster: [
    {
      label: "Main",
      icon: "dashboard",
      defaultOpen: true,
      items: [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
        {
          href: "/dashboard/analytics/dna",
          label: "Performance DNA",
          icon: "biotech",
          badge: "New",
        },
        {
          href: "/dashboard/analytics",
          label: "Insights",
          icon: "analytics",
        },
        {
          href: "/dashboard/messages",
          label: "Messages",
          icon: "chat",
        },
      ],
    },
    {
      label: "Management",
      icon: "group",
      defaultOpen: true,
      items: [
        { href: "/dashboard/students", label: "Student Hub", icon: "group" },
        { href: "/dashboard/students/id-cards", label: "Identity Center", icon: "id_card" },
        { href: "/dashboard/students/conduct", label: "Conduct & Merits", icon: "military_tech" },
        { href: "/dashboard/staff", label: "Staff Hub", icon: "person" },
        {
          href: "/dashboard/attendance",
          label: "Attendance",
          icon: "how_to_reg",
        },
        {
          href: "/dashboard/teacher-performance",
          label: "Performance",
          icon: "trending_up",
        },
      ],
    },
    {
      label: "Academics",
      icon: "menu_book",
      defaultOpen: false,
      items: [
        {
          href: "/dashboard/grades",
          label: "Grades & Reports",
          icon: "menu_book",
        },
        { href: "/dashboard/exams", label: "Exams", icon: "fact_check" },
        { href: "/dashboard/timetable", label: "Timetable", icon: "calendar_month" },
        { href: "/dashboard/syllabus", label: "Syllabus", icon: "track_changes" },
        { href: "/dashboard/custom-reports", label: "Report Builder", icon: "build", badge: "Pro" },
        { href: "/dashboard/batch-reports", label: "Batch Reports", icon: "print", badge: "New" },
        { href: "/dashboard/bulk-sms", label: "SMS Centre", icon: "sms" },
      ],
    },
    {
      label: "Finance",
      icon: "payments",
      defaultOpen: false,
      items: [
        { href: "/dashboard/fees", label: "Finance Hub", icon: "payments" },
        {
          href: "/dashboard/budget",
          label: "Budget",
          icon: "account_balance_wallet",
        },
        {
          href: "/dashboard/payroll",
          label: "Payroll",
          icon: "payments",
        },
        {
          href: "/dashboard/reports",
          label: "Financial Reports",
          icon: "analytics",
        },
      ],
    },
    {
      label: "Commercial Suite",
      icon: "shopping_cart",
      defaultOpen: false,
      items: [
        { href: "/dashboard/store/pos", label: "Canteen POS", icon: "shopping_cart" },
        { href: "/dashboard/store/inventory", label: "Inventory", icon: "inventory" },
        { href: "/dashboard/store/wallets", label: "Student Wallets", icon: "account_balance_wallet" },
        { href: "/dashboard/analytics/dna", label: "Performance DNA", icon: "biotech" },
      ],
    },
    {
      label: "Services",
      icon: "extension",
      defaultOpen: false,
      items: [
        { href: "/dashboard/health", label: "Health/Sick Bay", icon: "local_hospital" },
        { href: "/dashboard/transport", label: "Transport", icon: "directions_bus" },
        { href: "/dashboard/library", label: "Library", icon: "local_library" },
        { href: "/dashboard/assets", label: "Assets", icon: "inventory_2" },
        { href: "/dashboard/dorm", label: "Dormitory", icon: "bed" },
      ],
    },
    {
      label: "System",
      icon: "settings",
      defaultOpen: false,
      items: [
        {
          href: "/dashboard/workflows",
          label: "Workflows",
          icon: "account_tree",
          badge: "New",
        },
        {
          href: "/dashboard/settings",
          label: "Settings",
          icon: "settings",
        },
        { href: "/dashboard/audit", label: "Audit Log", icon: "history" },
        {
          href: "/dashboard/sync-center",
          label: "Sync Center",
          icon: "sync",
          badge: "Offline",
        },
      ],
    },
  ],

  dean_of_studies: [
    {
      label: "Main",
      defaultOpen: true,
      items: [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
        { href: "/dashboard/reports", label: "Academic Reports", icon: "description" },
      ],
    },
    {
      label: "Management",
      defaultOpen: true,
      items: [
        { href: "/dashboard/students", label: "Students", icon: "group" },
        { href: "/dashboard/timetable", label: "Timetable", icon: "calendar_month" },
      ],
    },
    {
      label: "Academics",
      defaultOpen: false,
      items: [
        { href: "/dashboard/attendance", label: "Attendance", icon: "how_to_reg" },
        { href: "/dashboard/grades", label: "Grades", icon: "menu_book" },
        { href: "/dashboard/exams", label: "Exams", icon: "fact_check" },
        { href: "/dashboard/batch-reports", label: "Batch Reports", icon: "print" },
        { href: "/dashboard/uneb", label: "UNEB Center", icon: "workspace_premium" },
      ],
    },
    {
      label: "Planning",
      defaultOpen: false,
      items: [
        { href: "/dashboard/syllabus", label: "Syllabus Track", icon: "track_changes" },
        { href: "/dashboard/scheme-of-work", label: "Scheme of Work", icon: "list_alt" },
        { href: "/dashboard/lesson-plans", label: "Lesson Plans", icon: "menu_book" },
      ],
    },
  ],

  bursar: [
    {
      label: "Main",
      defaultOpen: true,
      items: [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
        { href: "/dashboard/reports", label: "Financial Reports", icon: "analytics" },
      ],
    },
    {
      label: "Finance",
      defaultOpen: true,
      items: [
        { href: "/dashboard/fees", label: "Collect Fees", icon: "payments" },
        { href: "/dashboard/invoicing", label: "Invoicing", icon: "description" },
        { href: "/dashboard/cashbook", label: "Cashbook", icon: "book" },
        { href: "/dashboard/budget", label: "Budget", icon: "account_balance_wallet" },
        { href: "/dashboard/payroll", label: "Payroll", icon: "payments" },
      ],
    },
    {
      label: "Management",
      defaultOpen: false,
      items: [
        { href: "/dashboard/students", label: "Student List", icon: "group" },
        { href: "/dashboard/payment-plans", label: "Payment Plans", icon: "calendar_month" },
      ],
    },
    {
      label: "System",
      defaultOpen: false,
      items: [
        { href: "/dashboard/messages", label: "Messages", icon: "chat" },
        { href: "/dashboard/settings", label: "Settings", icon: "settings" },
      ],
    },
  ],

  teacher: [
    {
      label: "Main",
      defaultOpen: true,
      items: [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
        { href: "/dashboard/timetable", label: "My Timetable", icon: "calendar_month" },
      ],
    },
    {
      label: "Academics",
      defaultOpen: true,
      items: [
        { href: "/dashboard/attendance", label: "Attendance", icon: "how_to_reg" },
        { href: "/dashboard/grades", label: "Record Grades", icon: "menu_book" },
        { href: "/dashboard/exams", label: "Exams", icon: "fact_check" },
        { href: "/dashboard/homework", label: "Homework", icon: "assignment" },
      ],
    },
    {
      label: "Planning",
      defaultOpen: false,
      items: [
        { href: "/dashboard/syllabus", label: "Syllabus Track", icon: "track_changes" },
        { href: "/dashboard/scheme-of-work", label: "Scheme of Work", icon: "list_alt" },
        { href: "/dashboard/lesson-plans", label: "Lesson Plans", icon: "menu_book" },
      ],
    },
    {
      label: "Services",
      defaultOpen: false,
      items: [
        { href: "/dashboard/messages", label: "Messages", icon: "chat" },
        { href: "/dashboard/health", label: "Health", icon: "local_hospital" },
        { href: "/dashboard/library", label: "Library", icon: "local_library" },
      ],
    },
  ],

  admin: [
    {
      label: "Main",
      defaultOpen: true,
      items: [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
        { href: "/dashboard/analytics", label: "School Analytics", icon: "analytics" },
      ],
    },
    {
      label: "Management",
      defaultOpen: true,
      items: [
        { href: "/dashboard/students", label: "Students", icon: "group" },
        { href: "/dashboard/staff", label: "Staff Hub", icon: "person" },
        { href: "/dashboard/attendance", label: "Daily Attendance", icon: "how_to_reg" },
        { href: "/dashboard/teacher-performance", label: "Performance", icon: "trending_up" },
      ],
    },
    {
      label: "Academics",
      defaultOpen: false,
      items: [
        { href: "/dashboard/grades", label: "Grades", icon: "menu_book" },
        { href: "/dashboard/exams", label: "Exams", icon: "fact_check" },
        { href: "/dashboard/calendar", label: "School Calendar", icon: "calendar_today" },
      ],
    },
    {
      label: "Commercial Suite",
      icon: "shopping_cart",
      defaultOpen: false,
      items: [
        { href: "/dashboard/store/pos", label: "Canteen POS", icon: "shopping_cart" },
        { href: "/dashboard/store/inventory", label: "Inventory", icon: "inventory" },
        { href: "/dashboard/store/wallets", label: "Student Wallets", icon: "account_balance_wallet" },
      ],
    },
    {
      label: "Finances",
      defaultOpen: false,
      items: [
        { href: "/dashboard/fees", label: "Finance Hub", icon: "payments" },
        { href: "/dashboard/budget", label: "Budgeting", icon: "account_balance_wallet" },
        { href: "/dashboard/payroll", label: "Payroll", icon: "payments" },
      ],
    },
    {
      label: "Services",
      defaultOpen: false,
      items: [
        { href: "/dashboard/messages", label: "Messages", icon: "chat" },
        { href: "/dashboard/health", label: "Health", icon: "local_hospital" },
        { href: "/dashboard/transport", label: "Transport", icon: "directions_bus" },
        { href: "/dashboard/library", label: "Library", icon: "local_library" },
        { href: "/dashboard/assets", label: "Assets", icon: "inventory_2" },
        { href: "/dashboard/dorm", label: "Dormitories", icon: "bed" },
      ],
    },
    {
      label: "System",
      defaultOpen: false,
      items: [
        { href: "/dashboard/settings", label: "Settings", icon: "settings" },
        { href: "/dashboard/audit", label: "Audit Logs", icon: "history" },
      ],
    },
  ],

  school_admin: [
    {
      label: "Main",
      defaultOpen: true,
      items: [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
        { href: "/dashboard/analytics", label: "Analytics", icon: "analytics" },
      ],
    },
    {
      label: "Management",
      defaultOpen: true,
      items: [
        { href: "/dashboard/students", label: "Students", icon: "group" },
        { href: "/dashboard/staff", label: "Staff", icon: "person" },
      ],
    },
    {
      label: "Academics",
      defaultOpen: false,
      items: [
        { href: "/dashboard/grades", label: "Grades", icon: "menu_book" },
        { href: "/dashboard/exams", label: "Exams", icon: "fact_check" },
      ],
    },
    {
      label: "Finance",
      defaultOpen: false,
      items: [
        { href: "/dashboard/fees", label: "Finance", icon: "payments" },
        { href: "/dashboard/budget", label: "Budget", icon: "account_balance_wallet" },
      ],
    },
    {
      label: "System",
      defaultOpen: false,
      items: [
        { href: "/dashboard/messages", label: "Messages", icon: "chat" },
        { href: "/dashboard/settings", label: "Settings", icon: "settings" },
      ],
    },
  ],

  secretary: [
    {
      label: "Main",
      defaultOpen: true,
      items: [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
        { href: "/dashboard/notices", label: "Notices", icon: "campaign" },
      ],
    },
    {
      label: "Communication",
      defaultOpen: true,
      items: [
        { href: "/dashboard/messages", label: "Social Hub", icon: "chat" },
        { href: "/dashboard/bulk-sms", label: "Bulk SMS", icon: "sms" },
      ],
    },
  ],

  dorm_master: [
    {
      label: "Dormitory",
      defaultOpen: true,
      items: [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
        { href: "/dashboard/dorm", label: "Dorm Management", icon: "bed" },
        {
          href: "/dashboard/dorm-attendance",
          label: "Dorm Attendance",
          icon: "nightlight",
        },
      ],
    },
    {
      label: "Welfare",
      defaultOpen: false,
      items: [
        { href: "/dashboard/students", label: "Students", icon: "group" },
        {
          href: "/dashboard/health",
          label: "Health Records",
          icon: "medical_services",
        },
        { href: "/dashboard/discipline", label: "Discipline", icon: "warning" },
      ],
    },
  ],
  parent: [
    {
      label: "Child Portal",
      defaultOpen: true,
      items: [
        { href: "/parent-portal", label: "Overview", icon: "dashboard" },
        { href: "/parent-portal/attendance", label: "Attendance", icon: "how_to_reg" },
        { href: "/parent-portal/academics", label: "Academics", icon: "menu_book" },
      ],
    },
    {
      label: "Finance",
      defaultOpen: true,
      items: [
        { href: "/parent-portal/fees", label: "Fees & Receipts", icon: "payments" },
      ],
    },
    {
      label: "School",
      defaultOpen: false,
      items: [
        { href: "/parent-portal/notices", label: "Notice Board", icon: "campaign" },
        { href: "/parent-portal/messages", label: "Message School", icon: "chat" },
      ],
    },
  ],
};

export function getNavigationForRole(role: string): NavGroup[] {
  // Super admin, admin, school_admin and board get full headmaster access
  if (
    role === "admin" ||
    role === "school_admin" ||
    role === "board" ||
    role === "super_admin"
  ) {
    return navigationByRole.headmaster;
  }
  return navigationByRole[role] || navigationByRole.teacher;
}

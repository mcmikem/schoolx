// Navigation configuration for SchoolMate OS
// Organized by logical groups with collapsible sections
import { deepFreeze } from "./deep-freeze";
import type { UserRole } from "./roles";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: string;
}

export interface NavGroup {
  label: string;
  icon?: string;
  items: readonly NavItem[];
  defaultOpen?: boolean;
  priority?: number;
}

type NavigationRole = Extract<
  UserRole,
  | "super_admin"
  | "headmaster"
  | "dean_of_studies"
  | "bursar"
  | "teacher"
  | "admin"
  | "school_admin"
  | "secretary"
  | "dorm_master"
  | "parent"
  | "marketer"
>;

const HEADMASTER_EQUIVALENT_NAV_ROLES = deepFreeze(["admin", "school_admin", "board"] as const);

// Define navigation by role
export const navigationByRole: Record<NavigationRole, readonly NavGroup[]> = deepFreeze({
  super_admin: [
    {
      label: "System Control HUB",
      icon: "admin_panel_settings",
      defaultOpen: true,
      items: [
        {
          href: "/super-admin",
          label: "Super Admin Home",
          icon: "admin_panel_settings",
        },
        {
          href: "/super-admin?tab=overview",
          label: "System Monitor",
          icon: "troubleshoot",
        },
      ],
    },
    {
      label: "Global Operations",
      icon: "public",
      defaultOpen: true,
      items: [
        {
          href: "/super-admin?tab=schools",
          label: "All Schools",
          icon: "corporate_fare",
        },
        {
          href: "/super-admin?tab=features",
          label: "Feature Toggles",
          icon: "toggle_on",
        },
        {
          href: "/super-admin?tab=settings",
          label: "Platform Settings",
          icon: "settings_ethernet",
        },
      ],
    },
  ],

  headmaster: [
    {
      label: "Today",
      icon: "today",
      defaultOpen: true,
      items: [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
        {
          href: "/dashboard/attendance",
          label: "Attendance",
          icon: "how_to_reg",
        },
        {
          href: "/dashboard/fees",
          label: "Fees",
          icon: "payments",
        },
        {
          href: "/dashboard/messages",
          label: "Messages",
          icon: "chat",
        },
      ],
    },
    {
      label: "Daily Work",
      icon: "work",
      defaultOpen: true,
      items: [
        { href: "/dashboard/students", label: "Students", icon: "group" },
        { href: "/dashboard/staff", label: "Staff", icon: "person" },
        {
          href: "/dashboard/grades",
          label: "Grades",
          icon: "menu_book",
        },
        {
          // The reports used to be one collapsed group away, behind a label
          // that said "Financial" on a page of academic analytics. A teacher
          // or headmaster looking for reports after grading should not have
          // to go hunting for them.
          href: "/dashboard/reports",
          label: "Reports",
          icon: "analytics",
        },
        {
          href: "/dashboard/timetable",
          label: "Timetable",
          icon: "calendar_month",
        },
        {
          href: "/dashboard/calendar",
          label: "School Calendar",
          icon: "calendar_today",
        },
        {
          href: "/dashboard/analytics",
          label: "Analytics",
          icon: "analytics",
        },
      ],
    },
    {
      label: "Teaching & Exams",
      icon: "school",
      defaultOpen: false,
      items: [
        {
          href: "/dashboard/exams",
          label: "Exams",
          icon: "fact_check",
        },
        {
          href: "/dashboard/exam-lab",
          label: "Past Paper Practice",
          icon: "auto_stories",
        },
        {
          href: "/dashboard/homework",
          label: "Assignments",
          icon: "assignment",
        },
        {
          href: "/dashboard/syllabus",
          label: "Syllabus",
          icon: "track_changes",
        },
        {
          href: "/dashboard/academic-terms",
          label: "Academic Terms",
          icon: "calendar_today",
        },
        { href: "/dashboard/grading-settings", label: "Grading Configuration", icon: "settings" },
        {
          href: "/dashboard/subjects",
          label: "Subjects",
          icon: "menu_book",
        },
        {
          href: "/dashboard/courses",
          label: "Courses",
          icon: "school",
        },
        { href: "/dashboard/bulk-sms", label: "SMS Centre", icon: "sms" },
      ],
    },
    {
      label: "Reports & Readiness",
      icon: "description",
      defaultOpen: false,
      items: [
        {
          href: "/dashboard/students/id-cards",
          label: "ID Cards",
          icon: "id_card",
        },
        {
          href: "/dashboard/teacher-performance",
          label: "Teacher Performance",
          icon: "trending_up",
          permissions: ["headmaster", "dean_of_studies", "admin"],
        },
        {
          href: "/dashboard/data-quality",
          label: "Data Quality",
          icon: "rule",
        },
        { href: "/dashboard/audit", label: "Audit Log", icon: "history" },
      ],
    },
    {
      label: "School Office",
      icon: "business",
      defaultOpen: false,
      items: [
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
          href: "/dashboard/students/graduation",
          label: "Graduation",
          icon: "school",
        },
        {
          href: "/dashboard/students/alumni",
          label: "Alumni",
          icon: "groups",
        },
        {
          href: "/dashboard/student-enrollments",
          label: "Enrollments",
          icon: "school",
        },
        {
          href: "/dashboard/health",
          label: "Health / Sick Bay",
          icon: "local_hospital",
        },
        {
          href: "/dashboard/transport",
          label: "Transport",
          icon: "directions_bus",
        },
        { href: "/dashboard/library", label: "Library", icon: "local_library" },
        {
          href: "/dashboard/dorm",
          label: "Boarding",
          icon: "bed",
        },
      ],
    },
    {
      label: "Other Tools",
      icon: "more_horiz",
      defaultOpen: false,
      priority: 1,
      items: [
        {
          href: "/dashboard/store/inventory",
          label: "Inventory",
          icon: "inventory",
        },
        {
          href: "/dashboard/store/wallets",
          label: "Student Wallets",
          icon: "account_balance_wallet",
        },
        {
          href: "/dashboard/settings",
          label: "Settings",
          icon: "settings",
        },
        {
          href: "/dashboard/permissions",
          label: "Role Permissions",
          icon: "admin_panel_settings",
        },
        { href: "/dashboard/audit/scan-events", label: "Scan Events", icon: "qr_code_scanner" },
        {
          href: "/dashboard/sync-center",
          label: "Offline Sync",
          icon: "sync",
        },
        ...(process.env.NODE_ENV !== "production"
          ? [
              {
                href: "/dashboard/store/pos",
                label: "Canteen POS",
                icon: "shopping_cart",
              },
              {
                href: "/dashboard/store/meal-scan",
                label: "Meal Scan",
                icon: "restaurant",
              },
              {
                href: "/dashboard/analytics/dna",
                label: "Performance DNA",
                icon: "biotech",
              },
              {
                href: "/dashboard/suggestions",
                label: "Suggestions",
                icon: "lightbulb",
              },
            ]
          : []),
      ],
    },
  ],

  dean_of_studies: [
    {
      label: "Main",
      defaultOpen: true,
      items: [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
        {
          href: "/dashboard/reports",
          label: "Academic Reports",
          icon: "description",
        },
      ],
    },
    {
      label: "Management",
      defaultOpen: true,
      items: [
        { href: "/dashboard/students", label: "Students", icon: "group" },
        {
          href: "/dashboard/timetable",
          label: "Timetable",
          icon: "calendar_month",
        },
      ],
    },
    {
      label: "Academics",
      defaultOpen: false,
      items: [
        {
          href: "/dashboard/subjects",
          label: "Subjects",
          icon: "menu_book",
        },
        {
          href: "/dashboard/attendance",
          label: "Attendance",
          icon: "how_to_reg",
        },
        { href: "/dashboard/grades", label: "Grades", icon: "menu_book" },
        { href: "/dashboard/exams", label: "Exams", icon: "fact_check" },
        {
          href: "/dashboard/batch-reports",
          label: "Batch Reports",
          icon: "print",
        },
        {
          href: "/dashboard/uneb",
          label: "UNEB Center",
          icon: "workspace_premium",
        },
        {
          href: "/dashboard/calendar",
          label: "School Calendar",
          icon: "calendar_today",
        },
      ],
    },
    {
      label: "Planning",
      defaultOpen: false,
      items: [
        {
          href: "/dashboard/syllabus",
          label: "Syllabus Track",
          icon: "track_changes",
        },
        {
          href: "/dashboard/scheme-of-work",
          label: "Scheme of Work",
          icon: "list_alt",
        },
        {
          href: "/dashboard/lesson-plans",
          label: "Lesson Plans",
          icon: "menu_book",
        },
        {
          href: "/dashboard/calendar",
          label: "School Calendar",
          icon: "calendar_today",
        },
      ],
    },
  ],

  bursar: [
    {
      label: "Main",
      defaultOpen: true,
      items: [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
        {
          href: "/dashboard/money",
          label: "Financial Reports",
          icon: "analytics",
        },
      ],
    },
    {
      label: "Finance",
      defaultOpen: true,
      items: [
        { href: "/dashboard/money", label: "Money In & Out", icon: "account_balance_wallet" },
        { href: "/dashboard/requirements", label: "Requirements", icon: "checklist" },
        { href: "/dashboard/fees", label: "Collect Fees", icon: "payments" },
        { href: "/dashboard/fee-structure", label: "Fee Structure", icon: "payments" },
        { href: "/dashboard/fee-ledger", label: "Payment Ledger", icon: "book" },
        {
          href: "/dashboard/fees?tab=invoices",
          label: "Invoicing",
          icon: "description",
        },
        {
          href: "/dashboard/fees?tab=cashbook",
          label: "Cashbook",
          icon: "book",
        },
        {
          href: "/dashboard/budget",
          label: "Budget",
          icon: "account_balance_wallet",
        },
        { href: "/dashboard/payroll", label: "Payroll", icon: "payments" },
      ],
    },
    {
      label: "Management",
      defaultOpen: false,
      items: [
        { href: "/dashboard/students", label: "Student List", icon: "group" },
        {
          href: "/dashboard/billing",
          label: "Billing Plans",
          icon: "calendar_month",
        },
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
      label: "My Day",
      icon: "today",
      defaultOpen: true,
      items: [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
        {
          href: "/dashboard/timetable",
          label: "My Timetable",
          icon: "calendar_month",
        },
      ],
    },
    {
      label: "My Roster",
      icon: "groups",
      defaultOpen: true,
      items: [
        { href: "/dashboard/students", label: "My Students", icon: "group" },
        { href: "/dashboard/classes", label: "My Classes", icon: "school" },
      ],
    },
    {
      label: "Take Attendance",
      icon: "how_to_reg",
      defaultOpen: true,
      items: [
        {
          href: "/dashboard/attendance",
          label: "Class Attendance",
          icon: "how_to_reg",
        },
        {
          href: "/dashboard/period-attendance",
          label: "Period Attendance",
          icon: "schedule",
        },
      ],
    },
    {
      label: "Enter Marks",
      icon: "grade",
      defaultOpen: true,
      items: [
        {
          href: "/dashboard/grades",
          label: "Record Grades",
          icon: "grade",
        },
        { href: "/dashboard/reports", label: "Class Reports", icon: "analytics" },
        { href: "/dashboard/exams", label: "Exams", icon: "fact_check" },
      ],
    },
    {
      label: "Assignments",
      icon: "assignment",
      defaultOpen: true,
      items: [
        { href: "/dashboard/homework", label: "Class Tests", icon: "assignment" },
        { href: "/dashboard/exam-lab", label: "Past Paper Practice", icon: "auto_stories" },
      ],
    },
    {
      label: "Planning",
      icon: "menu_book",
      defaultOpen: false,
      items: [
        {
          href: "/dashboard/syllabus",
          label: "Syllabus",
          icon: "track_changes",
        },
        {
          href: "/dashboard/scheme-of-work",
          label: "Scheme of Work",
          icon: "list_alt",
        },
        {
          href: "/dashboard/lesson-plans",
          label: "Lesson Plans",
          icon: "menu_book",
        },
      ],
    },
    {
      label: "Support",
      icon: "support",
      // Health is the sick bay — a child unwell in class is the urgent case,
      // so it should not sit two clicks deep behind a collapsed disclosure.
      defaultOpen: true,
      items: [
        { href: "/dashboard/health", label: "Health", icon: "local_hospital" },
        { href: "/dashboard/library", label: "Library", icon: "local_library" },
      ],
    },
    {
      label: "Homework Submissions",
      icon: "assignment_turned_in",
      defaultOpen: true,
      items: [{ href: "/dashboard/homework-submissions", label: "Submissions", icon: "assignment_turned_in" }],
    },
    {
      label: "Substitutions",
      icon: "swap_vert",
      defaultOpen: true,
      items: [{ href: "/dashboard/substitutions", label: "Substitutions", icon: "swap_vert" }],
    },
    {
      label: "Report Cards",
      icon: "description",
      defaultOpen: true,
      items: [{ href: "/dashboard/report-cards", label: "Report Cards", icon: "description" }],
    },
  ],
  admin: [
    {
      label: "Main",
      defaultOpen: true,
      items: [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
        {
          href: "/dashboard/analytics",
          label: "School Analytics",
          icon: "analytics",
        },
      ],
    },
    {
      label: "Management",
      defaultOpen: true,
      items: [
        { href: "/dashboard/students", label: "Students", icon: "group" },
        { href: "/dashboard/staff", label: "Staff Hub", icon: "person" },
        {
          href: "/dashboard/attendance",
          label: "Daily Attendance",
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
      defaultOpen: false,
      items: [
        { href: "/dashboard/grades", label: "Grades", icon: "menu_book" },
        { href: "/dashboard/exams", label: "Exams", icon: "fact_check" },
        {
          href: "/dashboard/calendar",
          label: "School Calendar",
          icon: "calendar_today",
        },
      ],
    },
    {
      label: "Commercial Suite",
      icon: "shopping_cart",
      defaultOpen: false,
      items: [
        {
          href: "/dashboard/store/pos",
          label: "Canteen POS",
          icon: "shopping_cart",
        },
        {
          href: "/dashboard/store/meal-scan",
          label: "Meal Scan",
          icon: "restaurant",
        },
        {
          href: "/dashboard/store/inventory",
          label: "Inventory",
          icon: "inventory",
        },
        {
          href: "/dashboard/store/wallets",
          label: "Student Wallets",
          icon: "account_balance_wallet",
        },
      ],
    },
    {
      label: "Finances",
      defaultOpen: false,
      items: [
        { href: "/dashboard/fees", label: "Finance Hub", icon: "payments" },
        { href: "/dashboard/fee-structure", label: "Fee Structure", icon: "payments" },
        { href: "/dashboard/fee-ledger", label: "Payment Ledger", icon: "book" },
        {
          href: "/dashboard/budget",
          label: "Budgeting",
          icon: "account_balance_wallet",
        },
        { href: "/dashboard/payroll", label: "Payroll", icon: "payments" },
      ],
    },
    {
      label: "Services",
      defaultOpen: false,
      items: [
        { href: "/dashboard/messages", label: "Messages", icon: "chat" },
        { href: "/dashboard/health", label: "Health", icon: "local_hospital" },
        {
          href: "/dashboard/transport",
          label: "Transport",
          icon: "directions_bus",
        },
        { href: "/dashboard/library", label: "Library", icon: "local_library" },
        { href: "/dashboard/assets", label: "Assets", icon: "inventory" },
        { href: "/dashboard/dorm", label: "Dormitories", icon: "bed" },
      ],
    },
    {
      label: "System",
      defaultOpen: false,
      items: [
        { href: "/dashboard/settings", label: "Settings", icon: "settings" },
        { href: "/dashboard/permissions", label: "Role Permissions", icon: "admin_panel_settings" },
        { href: "/dashboard/data-quality", label: "Data Quality", icon: "rule" },
        { href: "/dashboard/audit", label: "Audit Logs", icon: "history" },
        { href: "/dashboard/audit/scan-events", label: "Scan Events", icon: "qr_code_scanner" },
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
        {
          href: "/dashboard/calendar",
          label: "School Calendar",
          icon: "calendar_today",
        },
      ],
    },
    {
      label: "Finance",
      defaultOpen: false,
      items: [
        { href: "/dashboard/fees", label: "Finance", icon: "payments" },
        {
          href: "/dashboard/budget",
          label: "Budget",
          icon: "account_balance_wallet",
        },
      ],
    },
    {
      label: "System",
      defaultOpen: false,
      items: [
        { href: "/dashboard/messages", label: "Messages", icon: "chat" },
        { href: "/dashboard/settings", label: "Settings", icon: "settings" },
        { href: "/dashboard/permissions", label: "Role Permissions", icon: "admin_panel_settings" },
        { href: "/dashboard/data-quality", label: "Data Quality", icon: "rule" },
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
        {
          href: "/dashboard/suggestions",
          label: "Suggestions",
          icon: "lightbulb",
        },
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
        {
          href: "/parent-portal/attendance",
          label: "Attendance",
          icon: "how_to_reg",
        },
        {
          href: "/parent-portal/homework",
          label: "Homework",
          icon: "assignment",
        },
        {
          href: "/parent-portal/academics",
          label: "Academics",
          icon: "menu_book",
        },
        {
          href: "/parent-portal/results",
          label: "Results",
          icon: "description",
        },
        {
          href: "/parent-portal/timetable",
          label: "Timetable",
          icon: "calendar_month",
        },
        {
          href: "/parent-portal/events",
          label: "Events",
          icon: "event",
        },
      ],
    },
    {
      label: "Finance",
      defaultOpen: true,
      items: [
        {
          href: "/parent-portal/fees",
          label: "Fees & Receipts",
          icon: "payments",
        },
      ],
    },
    {
      label: "School",
      defaultOpen: false,
      items: [
        {
          href: "/parent-portal/notices",
          label: "Notice Board",
          icon: "campaign",
        },
        {
          href: "/parent-portal/messages",
          label: "Message School",
          icon: "chat",
        },
        {
          href: "/parent-portal/canteen",
          label: "Canteen Orders",
          icon: "restaurant",
        },
      ],
    },
  ],
  marketer: [
    {
      label: "Dashboard",
      icon: "dashboard",
      defaultOpen: true,
      items: [
        {
          href: "/dashboard",
          label: "Overview",
          icon: "dashboard",
        },
        {
          href: "/dashboard/schools",
          label: "All Schools",
          icon: "school",
        },
        {
          href: "/dashboard?tab=onboarding",
          label: "Onboarding Tracker",
          icon: "rocket_launch",
        },
      ],
    },
  ],
});

/**
 * True when the role is one the app knows how to render a nav for. A role that
 * fails this is not a teacher — it is a broken account (role revoked, typo in
 * the DB, staff row out of sync with auth.users).
 */
export function isKnownNavigationRole(role: string | null | undefined): boolean {
  if (!role) return false;
  if (HEADMASTER_EQUIVALENT_NAV_ROLES.some((allowedRole) => allowedRole === role)) return true;
  return role in navigationByRole;
}

export function getNavigationForRole(role: string): readonly NavGroup[] {
  if (HEADMASTER_EQUIVALENT_NAV_ROLES.some((allowedRole) => allowedRole === role)) {
    return navigationByRole.headmaster;
  }
  if (role in navigationByRole) {
    return navigationByRole[role as NavigationRole];
  }
  // Deliberately empty rather than the teacher nav. A revoked or malformed
  // role must not silently inherit teacher permissions and data — the account
  // looks broken and DashboardRouter surfaces a recovery screen instead.
  return [];
}

/**
 * Navigation for a person who holds several roles.
 *
 * Rural staff routinely combine jobs: the headmaster also teaches, the bursar
 * is often also a teacher. Reading a single role left those people unable to
 * reach whole areas of the app — a bursar/teacher had no `/dashboard/grades`
 * link anywhere, so teaching was impossible through the UI.
 *
 * Groups are unioned by label and items de-duplicated by href, so a
 * destination offered by two of someone's roles appears once. Order follows
 * the order the roles were passed in, with the primary role first, which keeps
 * the everyday items at the top rather than buried under an admin group.
 */
export function getNavigationForRoles(
  roles: readonly (string | null | undefined)[] | string | null | undefined,
): readonly NavGroup[] {
  const list = (Array.isArray(roles) ? roles : [roles])
    .filter((role): role is string => typeof role === "string" && role.length > 0)
    .filter((role, i, all) => all.indexOf(role) === i);

  if (list.length === 0) return [];
  if (list.length === 1) return getNavigationForRole(list[0]);

  const seenHrefs = new Set<string>();
  const merged: NavGroup[] = [];

  for (const role of list) {
    for (const group of getNavigationForRole(role)) {
      const items = group.items.filter((item) => {
        const href = (item as { href?: string }).href;
        if (typeof href !== "string") return true;
        if (seenHrefs.has(href)) return false;
        seenHrefs.add(href);
        return true;
      });
      if (items.length === 0) continue;

      const existing = merged.find((candidate) => candidate.label === group.label);
      if (existing) {
        merged[merged.indexOf(existing)] = { ...existing, items: [...existing.items, ...items] };
      } else {
        merged.push({ ...group, items });
      }
    }
  }

  return sortNavGroupsByPriority(merged);
}

// Stable priority sort: groups marked priority > 0 (e.g. "Other Tools") are
// pushed below everyday groups regardless of their position in the config.
// Groups already defined first stay first — priority only ever demotes.
export function sortNavGroupsByPriority(groups: readonly NavGroup[]): NavGroup[] {
  return [...groups].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
}

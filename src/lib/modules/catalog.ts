// Unified module catalog for SkoolMate OS
//
// Two billing modes share one module catalog:
//   full_suite → school picks a plan → plan maps to a feature stage → stage defines included modules
//   modular    → school gets size-based core modules free, purchases individual modules a la carte
//
// Module access check (both modes):
//   isModuleAccessible(school, moduleKey):
//     if billing_mode === "full_suite":
//       return isInFeatureStage(school.feature_stage, moduleKey)
//     else:
//       return isInCoreBySize(school.school_size_band, moduleKey)
//           || hasActiveEntitlement(school.id, moduleKey)

export type BillingMode = "full_suite" | "modular";
export type SchoolSizeBand = "small" | "medium" | "large";
export type FeatureStage = "core" | "academic" | "finance" | "full";
export type PlanTier = "starter" | "growth" | "enterprise" | "lifetime";

// Unified module keys — single source of truth for both feature stages and billing
export type ModuleKey =
  | "analytics"
  | "assets"
  | "attendance"
  | "canteen"
  | "communications"
  | "dashboard"
  | "discipline"
  | "dorm"
  | "exams"
  | "finance"
  | "health"
  | "library"
  | "marks"
  | "operations"
  | "parent_portal"
  | "payroll"
  | "reports"
  | "settings"
  | "staff"
  | "students"
  | "transport";

// Backward-compat: old billing module keys used in DB (module_catalog, school_module_entitlements)
// These map to the new unified keys above.
export const LEGACY_MODULE_MAP: Record<string, ModuleKey> = {
  reports: "reports",
  student_id: "students",
  canteen: "canteen",
  fees: "finance",
  attendance: "attendance",
  messages: "communications",
};

export function resolveModuleKey(maybeLegacy: string): ModuleKey {
  return LEGACY_MODULE_MAP[maybeLegacy] || (maybeLegacy as ModuleKey);
}

// Reverse map: new unified key → legacy DB key (for backward-compat DB queries)
const REVERSE_LEGACY_MAP: Record<string, string> = {};
for (const [legacy, unified] of Object.entries(LEGACY_MODULE_MAP)) {
  REVERSE_LEGACY_MAP[unified] = legacy;
}

export function toLegacyModuleKey(unifiedKey: string): string | undefined {
  return REVERSE_LEGACY_MAP[unifiedKey];
}

export interface ModuleDefinition {
  module_key: ModuleKey;
  display_name: string;
  description: string;
  icon: string;
  route_prefixes: string[];
  included_in_stages: FeatureStage[];
  included_in_core_small: boolean;
  included_in_core_medium: boolean;
  included_in_core_large: boolean;
  is_billable: boolean;
  annual_price_small: number;
  annual_price_medium: number;
  annual_price_large: number;
  sort_order: number;
}

// ─── Feature stage definitions ───────────────────────────────────────────────
// Which modules are included at each stage of a full-suite plan.
export const FEATURE_STAGE_MODULES: Record<FeatureStage, ModuleKey[]> = {
  core: [
    "dashboard",
    "attendance",
    "communications",
    "settings",
    "staff",
    "students",
  ],
  academic: [
    "dashboard",
    "attendance",
    "communications",
    "marks",
    "exams",
    "reports",
    "settings",
    "staff",
    "students",
  ],
  finance: [
    "dashboard",
    "attendance",
    "communications",
    "finance",
    "marks",
    "exams",
    "reports",
    "operations",
    "payroll",
    "settings",
    "staff",
    "students",
    "health",
  ],
  full: [
    "analytics",
    "assets",
    "attendance",
    "canteen",
    "communications",
    "dashboard",
    "discipline",
    "dorm",
    "exams",
    "finance",
    "health",
    "library",
    "marks",
    "operations",
    "parent_portal",
    "payroll",
    "reports",
    "settings",
    "staff",
    "students",
    "transport",
  ],
};

export const DEFAULT_FEATURE_STAGE: FeatureStage = "core";

export function isModuleInFeatureStage(
  stage: FeatureStage | undefined,
  moduleKey: ModuleKey,
): boolean {
  const key = stage || DEFAULT_FEATURE_STAGE;
  return FEATURE_STAGE_MODULES[key].includes(moduleKey);
}

// ─── Size-based core (modular mode) ──────────────────────────────────────────
// In modular mode, every school gets certain modules included for free
// based on their size band. Everything beyond core must be purchased.
export function isModuleInCoreBySize(
  sizeBand: SchoolSizeBand | undefined | null,
  moduleKey: ModuleKey,
): boolean {
  const moduleDef = MODULE_CATALOG.find((m) => m.module_key === moduleKey);
  if (!moduleDef) return false;
  if (sizeBand === "large") return moduleDef.included_in_core_large;
  if (sizeBand === "medium") return moduleDef.included_in_core_medium;
  return moduleDef.included_in_core_small;
}

// ─── Unified access check ────────────────────────────────────────────────────
// Works for both full_suite and modular billing modes.
export function isModuleAccessible(params: {
  billingMode: BillingMode;
  featureStage?: FeatureStage;
  sizeBand?: SchoolSizeBand | null;
  activeEntitlements?: Set<string>;
  moduleKey: ModuleKey;
}): boolean {
  const { billingMode, featureStage, sizeBand, activeEntitlements, moduleKey } = params;

  if (billingMode === "full_suite") {
    return isModuleInFeatureStage(featureStage, moduleKey);
  }

  // modular mode
  if (isModuleInCoreBySize(sizeBand, moduleKey)) return true;
  if (activeEntitlements?.has(moduleKey)) return true;
  return false;
}

// ─── Plan → feature stage mapping ────────────────────────────────────────────
export const PLAN_FEATURE_STAGE: Record<PlanTier, FeatureStage> = {
  starter: "core",
  growth: "academic",
  enterprise: "finance",
  lifetime: "full",
};

export function getFeatureStageForPlan(plan: PlanTier | string): FeatureStage {
  return PLAN_FEATURE_STAGE[plan as PlanTier] || DEFAULT_FEATURE_STAGE;
}

// ─── Route-based module lookup ───────────────────────────────────────────────
const MODULE_MATCH_ORDER: ModuleKey[] = [
  // Most-specific prefixes first so longer paths match before shorter ones.
  "discipline",
  "analytics",
  "assets",
  "attendance",
  "canteen",
  "communications",
  "dashboard",
  "dorm",
  "exams",
  "finance",
  "health",
  "library",
  "marks",
  "operations",
  "parent_portal",
  "payroll",
  "reports",
  "settings",
  "staff",
  "students",
  "transport",
];

const MODULE_ROUTE_MAP: Record<ModuleKey, string[]> = {
  analytics: [
    "/dashboard/analytics",
    "/dashboard/trends",
    "/dashboard/class-comparison",
    "/dashboard/teacher-performance",
  ],
  assets: [
    "/dashboard/assets",
    "/dashboard/inventory",
  ],
  attendance: [
    "/dashboard/attendance",
    "/dashboard/period-attendance",
    "/dashboard/staff-attendance/scan",
  ],
  canteen: [
    "/dashboard/canteen",
    "/dashboard/store/pos",
    "/dashboard/store/meal-scan",
    "/dashboard/store/wallets",
    "/dashboard/store/inventory",
  ],
  communications: [
    "/dashboard/messages",
    "/dashboard/notices",
    "/dashboard/bulk-sms",
    "/dashboard/sms-templates",
    "/dashboard/sms-delivery",
    "/dashboard/auto-sms",
    "/dashboard/feedback",
    "/dashboard/suggestions",
    "/dashboard/comments",
  ],
  dashboard: [
    "/dashboard",
    "/dashboard/calendar",
    "/dashboard/osx",
  ],
  discipline: [
    "/dashboard/discipline",
    "/dashboard/behavior",
    "/dashboard/warnings",
  ],
  dorm: [
    "/dashboard/dorm",
    "/dashboard/dorm-attendance",
    "/dashboard/dorm-supplies",
  ],
  exams: [
    "/dashboard/exams",
    "/dashboard/exam-timetable",
    "/dashboard/uneb",
    "/dashboard/uneb-registration",
  ],
  finance: [
    "/dashboard/fees",
    "/dashboard/fee-terms",
    "/dashboard/payment-plans",
    "/dashboard/invoicing",
    "/dashboard/cashbook",
    "/dashboard/budget",
    "/dashboard/expense-approvals",
    "/dashboard/billing",
  ],
  health: [
    "/dashboard/health",
    "/dashboard/health-log",
  ],
  library: [
    "/dashboard/library",
  ],
  marks: [
    "/dashboard/grades",
    "/dashboard/marks-completion",
    "/dashboard/homework",
    "/dashboard/homework-submissions",
    "/dashboard/lesson-plans",
    "/dashboard/scheme-of-work",
    "/dashboard/syllabus",
    "/dashboard/syllabus-tracker",
    "/dashboard/courses",
    "/dashboard/allocations",
    "/dashboard/substitutions",
  ],
  operations: [
    "/dashboard/timetable",
    "/dashboard/academic-terms",
    "/dashboard/term-end",
    "/dashboard/rollover",
    "/dashboard/automation",
    "/dashboard/workflows",
    "/dashboard/import",
    "/dashboard/export",
    "/dashboard/sync-center",
    "/dashboard/classes",
    "/dashboard/setup",
    "/dashboard/setup-wizard",
    "/dashboard/onboarding",
    "/dashboard/inspection-report",
  ],
  parent_portal: [
    "/dashboard/parent",
    "/parent-portal",
  ],
  payroll: [
    "/dashboard/payroll",
  ],
  reports: [
    "/dashboard/reports",
    "/dashboard/report-cards",
    "/dashboard/batch-reports",
    "/dashboard/custom-reports",
    "/dashboard/board-report",
    "/dashboard/moes-reports",
    "/dashboard/moes",
    "/dashboard/trends",
  ],
  settings: [
    "/dashboard/settings",
    "/dashboard/permissions",
    "/dashboard/audit",
    "/dashboard/data-quality",
    "/dashboard/pricing",
    "/dashboard/system-health",
    "/dashboard/schools",
    "/dashboard/users",
  ],
  staff: [
    "/dashboard/staff",
    "/dashboard/staff-attendance",
    "/dashboard/staff-activity",
    "/dashboard/staff-performance",
    "/dashboard/staff-reviews",
    "/dashboard/leave",
    "/dashboard/leave-approvals",
    "/dashboard/workload",
    "/dashboard/substitutions",
  ],
  students: [
    "/dashboard/students",
    "/dashboard/student-enrollments",
    "/dashboard/student-lookup",
    "/dashboard/student-transfers",
    "/dashboard/dropout-tracking",
    "/dashboard/promotion",
    "/dashboard/idcards",
    "/dashboard/students/id-cards",
    "/dashboard/students/graduation",
    "/dashboard/students/alumni",
    "/dashboard/students/photos",
    "/dashboard/students/admission-package",
    "/dashboard/students/conduct",
  ],
  transport: [
    "/dashboard/transport",
  ],
};

// Static lookup: find which module a dashboard path belongs to (or null if core/unrestricted)
export function getRequiredModuleForPath(pathname: string): ModuleKey | null {
  if (!pathname.startsWith("/dashboard") && !pathname.startsWith("/parent-portal")) {
    return null;
  }

  // Exact match first, then prefix match
  for (const moduleKey of MODULE_MATCH_ORDER) {
    const prefixes = MODULE_ROUTE_MAP[moduleKey];
    for (const prefix of prefixes) {
      if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
        return moduleKey;
      }
    }
  }

  return null;
}

// ─── Map a module key to its feature-stage ModuleKey for backward compat ─────
// This lets the old featureStages.ts canUseModule bridge to the new catalog.
export { getRequiredModuleForPath as getRequiredModuleForPathV2 };

// ─── The catalog ─────────────────────────────────────────────────────────────
export const MODULE_CATALOG: ModuleDefinition[] = [
  {
    module_key: "dashboard",
    display_name: "Dashboard",
    description: "Home dashboard, calendar, and overview widgets.",
    icon: "dashboard",
    route_prefixes: MODULE_ROUTE_MAP.dashboard,
    included_in_stages: ["core", "academic", "finance", "full"],
    included_in_core_small: true,
    included_in_core_medium: true,
    included_in_core_large: true,
    is_billable: false,
    annual_price_small: 0,
    annual_price_medium: 0,
    annual_price_large: 0,
    sort_order: 1,
  },
  {
    module_key: "settings",
    display_name: "Settings & Admin",
    description: "School settings, permissions, audit logs, and user management.",
    icon: "settings",
    route_prefixes: MODULE_ROUTE_MAP.settings,
    included_in_stages: ["core", "academic", "finance", "full"],
    included_in_core_small: true,
    included_in_core_medium: true,
    included_in_core_large: true,
    is_billable: false,
    annual_price_small: 0,
    annual_price_medium: 0,
    annual_price_large: 0,
    sort_order: 2,
  },
  {
    module_key: "students",
    display_name: "Student Records",
    description: "Student registry, enrollments, transfers, promotions, ID cards, and alumni.",
    icon: "group",
    route_prefixes: MODULE_ROUTE_MAP.students,
    included_in_stages: ["core", "academic", "finance", "full"],
    included_in_core_small: true,
    included_in_core_medium: true,
    included_in_core_large: true,
    is_billable: false,
    annual_price_small: 0,
    annual_price_medium: 0,
    annual_price_large: 0,
    sort_order: 3,
  },
  {
    module_key: "staff",
    display_name: "Staff Management",
    description: "Staff records, attendance, performance reviews, leave management, and workload.",
    icon: "badge",
    route_prefixes: MODULE_ROUTE_MAP.staff,
    included_in_stages: ["core", "academic", "finance", "full"],
    included_in_core_small: false,
    included_in_core_medium: true,
    included_in_core_large: true,
    is_billable: true,
    annual_price_small: 0,
    annual_price_medium: 50000,
    annual_price_large: 100000,
    sort_order: 4,
  },
  {
    module_key: "attendance",
    display_name: "Attendance",
    description: "Daily class attendance, period attendance, and staff attendance scanning.",
    icon: "how_to_reg",
    route_prefixes: MODULE_ROUTE_MAP.attendance,
    included_in_stages: ["core", "academic", "finance", "full"],
    included_in_core_small: true,
    included_in_core_medium: true,
    included_in_core_large: true,
    is_billable: false,
    annual_price_small: 0,
    annual_price_medium: 0,
    annual_price_large: 0,
    sort_order: 5,
  },
  {
    module_key: "communications",
    display_name: "Communications",
    description: "In-app messaging, bulk SMS, auto-SMS, notices, feedback, and announcements.",
    icon: "chat",
    route_prefixes: MODULE_ROUTE_MAP.communications,
    included_in_stages: ["core", "academic", "finance", "full"],
    included_in_core_small: true,
    included_in_core_medium: true,
    included_in_core_large: true,
    is_billable: false,
    annual_price_small: 0,
    annual_price_medium: 0,
    annual_price_large: 0,
    sort_order: 6,
  },
  {
    module_key: "operations",
    display_name: "Operations",
    description: "Timetable, academic terms, rollover, automation, import/export, sync, and workflows.",
    icon: "settings_applications",
    route_prefixes: MODULE_ROUTE_MAP.operations,
    included_in_stages: ["finance", "full"],
    included_in_core_small: false,
    included_in_core_medium: true,
    included_in_core_large: true,
    is_billable: true,
    annual_price_small: 100000,
    annual_price_medium: 200000,
    annual_price_large: 350000,
    sort_order: 7,
  },
  {
    module_key: "marks",
    display_name: "Grades & Marks",
    description: "Grade entry, marks completion tracking, homework, lesson plans, syllabus, and courses.",
    icon: "menu_book",
    route_prefixes: MODULE_ROUTE_MAP.marks,
    included_in_stages: ["academic", "finance", "full"],
    included_in_core_small: false,
    included_in_core_medium: false,
    included_in_core_large: true,
    is_billable: true,
    annual_price_small: 100000,
    annual_price_medium: 200000,
    annual_price_large: 350000,
    sort_order: 8,
  },
  {
    module_key: "exams",
    display_name: "Exams & UNEB",
    description: "Exam management, exam timetables, UNEB registration and results analysis.",
    icon: "fact_check",
    route_prefixes: MODULE_ROUTE_MAP.exams,
    included_in_stages: ["academic", "finance", "full"],
    included_in_core_small: false,
    included_in_core_medium: false,
    included_in_core_large: true,
    is_billable: true,
    annual_price_small: 100000,
    annual_price_medium: 200000,
    annual_price_large: 350000,
    sort_order: 9,
  },
  {
    module_key: "reports",
    display_name: "Reports",
    description: "Report cards, batch reports, custom reports, board reports, MOEs reports, and trends.",
    icon: "description",
    route_prefixes: MODULE_ROUTE_MAP.reports,
    included_in_stages: ["academic", "finance", "full"],
    included_in_core_small: false,
    included_in_core_medium: false,
    included_in_core_large: true,
    is_billable: true,
    annual_price_small: 100000,
    annual_price_medium: 200000,
    annual_price_large: 350000,
    sort_order: 10,
  },
  {
    module_key: "finance",
    display_name: "Finance & Fees",
    description: "Fee collection, invoicing, cashbook, budget, expense approvals, payment plans, and billing.",
    icon: "payments",
    route_prefixes: MODULE_ROUTE_MAP.finance,
    included_in_stages: ["finance", "full"],
    included_in_core_small: false,
    included_in_core_medium: false,
    included_in_core_large: false,
    is_billable: true,
    annual_price_small: 200000,
    annual_price_medium: 400000,
    annual_price_large: 700000,
    sort_order: 11,
  },
  {
    module_key: "payroll",
    display_name: "Payroll",
    description: "Staff payroll management and payment processing.",
    icon: "payments",
    route_prefixes: MODULE_ROUTE_MAP.payroll,
    included_in_stages: ["finance", "full"],
    included_in_core_small: false,
    included_in_core_medium: false,
    included_in_core_large: false,
    is_billable: true,
    annual_price_small: 100000,
    annual_price_medium: 200000,
    annual_price_large: 350000,
    sort_order: 12,
  },
  {
    module_key: "canteen",
    display_name: "Canteen & Store",
    description: "Canteen POS, meal scanning, student wallets, and store inventory.",
    icon: "restaurant",
    route_prefixes: MODULE_ROUTE_MAP.canteen,
    included_in_stages: ["full"],
    included_in_core_small: false,
    included_in_core_medium: false,
    included_in_core_large: false,
    is_billable: true,
    annual_price_small: 200000,
    annual_price_medium: 400000,
    annual_price_large: 700000,
    sort_order: 13,
  },
  {
    module_key: "discipline",
    display_name: "Discipline",
    description: "Discipline records, behavior tracking, warnings, and comments.",
    icon: "warning",
    route_prefixes: MODULE_ROUTE_MAP.discipline,
    included_in_stages: ["full"],
    included_in_core_small: false,
    included_in_core_medium: false,
    included_in_core_large: false,
    is_billable: true,
    annual_price_small: 50000,
    annual_price_medium: 100000,
    annual_price_large: 200000,
    sort_order: 14,
  },
  {
    module_key: "dorm",
    display_name: "Dormitory",
    description: "Boarding management, dorm attendance, and dorm supplies.",
    icon: "bed",
    route_prefixes: MODULE_ROUTE_MAP.dorm,
    included_in_stages: ["full"],
    included_in_core_small: false,
    included_in_core_medium: false,
    included_in_core_large: false,
    is_billable: true,
    annual_price_small: 100000,
    annual_price_medium: 200000,
    annual_price_large: 350000,
    sort_order: 15,
  },
  {
    module_key: "health",
    display_name: "Health & Sick Bay",
    description: "Health records, sick bay visits, and health log tracking.",
    icon: "local_hospital",
    route_prefixes: MODULE_ROUTE_MAP.health,
    included_in_stages: ["finance", "full"],
    included_in_core_small: false,
    included_in_core_medium: false,
    included_in_core_large: false,
    is_billable: true,
    annual_price_small: 50000,
    annual_price_medium: 100000,
    annual_price_large: 200000,
    sort_order: 16,
  },
  {
    module_key: "analytics",
    display_name: "Analytics",
    description: "Performance analytics, class comparisons, teacher performance, and trends.",
    icon: "analytics",
    route_prefixes: MODULE_ROUTE_MAP.analytics,
    included_in_stages: ["full"],
    included_in_core_small: false,
    included_in_core_medium: false,
    included_in_core_large: false,
    is_billable: true,
    annual_price_small: 100000,
    annual_price_medium: 200000,
    annual_price_large: 350000,
    sort_order: 17,
  },
  {
    module_key: "parent_portal",
    display_name: "Parent Portal",
    description: "Parent-facing views for attendance, results, fees, and school communication.",
    icon: "family_history",
    route_prefixes: MODULE_ROUTE_MAP.parent_portal,
    included_in_stages: ["full"],
    included_in_core_small: false,
    included_in_core_medium: false,
    included_in_core_large: false,
    is_billable: true,
    annual_price_small: 200000,
    annual_price_medium: 400000,
    annual_price_large: 700000,
    sort_order: 18,
  },
  {
    module_key: "library",
    display_name: "Library",
    description: "Library management and book tracking.",
    icon: "local_library",
    route_prefixes: MODULE_ROUTE_MAP.library,
    included_in_stages: ["full"],
    included_in_core_small: false,
    included_in_core_medium: false,
    included_in_core_large: false,
    is_billable: true,
    annual_price_small: 50000,
    annual_price_medium: 100000,
    annual_price_large: 200000,
    sort_order: 19,
  },
  {
    module_key: "transport",
    display_name: "Transport",
    description: "School transport management and route tracking.",
    icon: "directions_bus",
    route_prefixes: MODULE_ROUTE_MAP.transport,
    included_in_stages: ["full"],
    included_in_core_small: false,
    included_in_core_medium: false,
    included_in_core_large: false,
    is_billable: true,
    annual_price_small: 50000,
    annual_price_medium: 100000,
    annual_price_large: 200000,
    sort_order: 20,
  },
  {
    module_key: "assets",
    display_name: "Assets & Inventory",
    description: "School asset tracking and general inventory management.",
    icon: "inventory_2",
    route_prefixes: MODULE_ROUTE_MAP.assets,
    included_in_stages: ["full"],
    included_in_core_small: false,
    included_in_core_medium: false,
    included_in_core_large: false,
    is_billable: true,
    annual_price_small: 50000,
    annual_price_medium: 100000,
    annual_price_large: 200000,
    sort_order: 21,
  },
];

// ─── Lookup helpers ──────────────────────────────────────────────────────────
export function getModuleDefinition(moduleKey: ModuleKey): ModuleDefinition | undefined {
  return MODULE_CATALOG.find((m) => m.module_key === moduleKey);
}

export function getBillableModules(): ModuleDefinition[] {
  return MODULE_CATALOG.filter((m) => m.is_billable);
}

export function getCoreModules(sizeBand: SchoolSizeBand): ModuleDefinition[] {
  return MODULE_CATALOG.filter((m) => {
    if (sizeBand === "large") return m.included_in_core_large;
    if (sizeBand === "medium") return m.included_in_core_medium;
    return m.included_in_core_small;
  });
}

export function getModulesForStage(stage: FeatureStage): ModuleDefinition[] {
  return FEATURE_STAGE_MODULES[stage]
    .map((key) => getModuleDefinition(key))
    .filter((m): m is ModuleDefinition => !!m);
}

export function getAnnualModulePrice(
  moduleItem: { annual_price_small: number; annual_price_medium: number; annual_price_large: number },
  sizeBand: SchoolSizeBand,
): number {
  if (sizeBand === "large") return moduleItem.annual_price_large;
  if (sizeBand === "medium") return moduleItem.annual_price_medium;
  return moduleItem.annual_price_small;
}

// ─── Module display info for UI ──────────────────────────────────────────────
export interface ModuleDisplayInfo {
  module_key: ModuleKey;
  display_name: string;
  description: string;
  icon: string;
  price: number;
  is_core: boolean;
  is_entitled: boolean;
  route_count: number;
}

export function buildModuleDisplayList(params: {
  sizeBand: SchoolSizeBand;
  billingMode: BillingMode;
  featureStage?: FeatureStage;
  activeEntitlements?: Set<string>;
}): ModuleDisplayInfo[] {
  const { sizeBand, billingMode, featureStage, activeEntitlements } = params;

  return MODULE_CATALOG.map((mod) => {
    const isCore = billingMode === "modular" && isModuleInCoreBySize(sizeBand, mod.module_key);
    const isEntitled = isModuleAccessible({
      billingMode,
      featureStage,
      sizeBand,
      activeEntitlements,
      moduleKey: mod.module_key,
    });

    return {
      module_key: mod.module_key,
      display_name: mod.display_name,
      description: mod.description,
      icon: mod.icon,
      price: getAnnualModulePrice(mod, sizeBand),
      is_core: isCore,
      is_entitled: isEntitled,
      route_count: mod.route_prefixes.length,
    };
  });
}

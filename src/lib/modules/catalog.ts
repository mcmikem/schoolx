export type BillingMode = "full_suite" | "modular";
export type SchoolSizeBand = "small" | "medium" | "large";

export type ModuleKey =
  | "reports"
  | "student_id"
  | "canteen"
  | "fees"
  | "attendance"
  | "messages";

export interface ModuleCatalogItem {
  module_key: ModuleKey;
  display_name: string;
  description: string;
  annual_price_small: number;
  annual_price_medium: number;
  annual_price_large: number;
  is_active: boolean;
  sort_order: number;
}

export const MODULE_ROUTE_PREFIXES: Record<ModuleKey, string[]> = {
  reports: [
    "/dashboard/reports",
    "/dashboard/grades",
    "/dashboard/exams",
    "/dashboard/report-cards",
    "/dashboard/batch-reports",
    "/dashboard/uneb",
  ],
  student_id: ["/dashboard/students/id-cards"],
  canteen: ["/dashboard/canteen", "/dashboard/store/pos", "/dashboard/store/wallets"],
  fees: [
    "/dashboard/fees",
    "/dashboard/fee-terms",
    "/dashboard/billing",
    "/dashboard/payroll",
    "/dashboard/budget",
  ],
  attendance: [
    "/dashboard/attendance",
    "/dashboard/period-attendance",
    "/dashboard/dorm-attendance",
  ],
  messages: ["/dashboard/messages", "/dashboard/bulk-sms"],
};

const MODULE_MATCH_ORDER: ModuleKey[] = [
  "reports",
  "student_id",
  "canteen",
  "fees",
  "attendance",
  "messages",
];

export function getRequiredModuleForPath(pathname: string): ModuleKey | null {
  if (!pathname.startsWith("/dashboard")) return null;

  // Core routes always available regardless of module mode.
  if (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/settings") ||
    pathname.startsWith("/dashboard/sync-center") ||
    pathname.startsWith("/dashboard/audit")
  ) {
    return null;
  }

  for (const moduleKey of MODULE_MATCH_ORDER) {
    const prefixes = MODULE_ROUTE_PREFIXES[moduleKey];
    if (
      prefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
      )
    ) {
      return moduleKey;
    }
  }

  return null;
}

export function getAnnualModulePrice(
  moduleItem: Pick<
    ModuleCatalogItem,
    "annual_price_small" | "annual_price_medium" | "annual_price_large"
  >,
  sizeBand: SchoolSizeBand,
): number {
  if (sizeBand === "large") return Number(moduleItem.annual_price_large || 0);
  if (sizeBand === "medium") return Number(moduleItem.annual_price_medium || 0);
  return Number(moduleItem.annual_price_small || 0);
}

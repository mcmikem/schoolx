import { roleBasedRoutes } from "@/components/dashboard/AccessControlGuard";
import { canAccess, type RolePermissions, type UserRole } from "@/lib/roles";

const SENSITIVE_ROUTES: Record<string, keyof RolePermissions> = {
  "/dashboard/users": "staff",
  "/dashboard/bulk-sms": "messages",
  "/dashboard/suggestions": "messages",
  "/dashboard/sms-delivery": "messages",
  "/dashboard/teacher-performance": "performance",
  "/dashboard/finance": "fees",
  "/dashboard/fee-terms": "fees",
  "/dashboard/canteen": "fees",
  "/dashboard/billing": "fees",
  "/dashboard/academic-terms": "settings",
  "/dashboard/rollover": "settings",
  "/dashboard/term-end": "settings",
  "/dashboard/system-health": "settings",
  "/dashboard/automation": "settings",
  "/dashboard/workflows": "settings",
  "/dashboard/osx": "settings",
  "/dashboard/student-enrollments": "settings",
  "/dashboard/schools": "analytics",
};

function permissionFor(path: string): keyof RolePermissions | undefined {
  const key = Object.keys(roleBasedRoutes).find((candidate) => path.startsWith(candidate));
  return key ? roleBasedRoutes[key] : undefined;
}

describe("route guard sensitive routes", () => {
  it("maps every sensitive route to its permission", () => {
    for (const [path, permission] of Object.entries(SENSITIVE_ROUTES)) {
      expect({ path, permission: roleBasedRoutes[path] }).toEqual({
        path,
        permission,
      });
    }
  });

  it("only opens a sensitive route to roles that hold its permission", () => {
    const expectedAllowed: Record<string, string[]> = {
      teacher: [],
      dean_of_studies: ["/dashboard/teacher-performance", "/dashboard/schools"],
      secretary: ["/dashboard/bulk-sms", "/dashboard/suggestions", "/dashboard/sms-delivery"],
      bursar: [
        "/dashboard/bulk-sms",
        "/dashboard/suggestions",
        "/dashboard/sms-delivery",
        "/dashboard/finance",
        "/dashboard/fee-terms",
        "/dashboard/canteen",
        "/dashboard/billing",
      ],
      board: ["/dashboard/schools"],
      marketer: ["/dashboard/schools"],
      dorm_master: [],
      parent: [],
    };
    for (const [role, expected] of Object.entries(expectedAllowed)) {
      const allowed = Object.keys(SENSITIVE_ROUTES).filter((path) => canAccess(role as UserRole, permissionFor(path)!));
      expect({ role, allowed: [...allowed].sort() }).toEqual({ role, allowed: [...expected].sort() });
    }
  });

  it("allows management roles", () => {
    const allowed: UserRole[] = ["headmaster", "admin", "school_admin", "super_admin"];
    for (const role of allowed) {
      for (const path of Object.keys(SENSITIVE_ROUTES)) {
        expect({ role, path, allowed: canAccess(role, permissionFor(path)!) }).toEqual({ role, path, allowed: true });
      }
    }
    expect(canAccess("bursar", permissionFor("/dashboard/billing")!)).toBe(true);
  });

  it("keeps nav entries reachable for the roles whose nav lists them", () => {
    const navOwners: Record<string, UserRole[]> = {
      "/dashboard/bulk-sms": ["headmaster", "secretary"],
      "/dashboard/suggestions": ["headmaster", "secretary"],
      "/dashboard/teacher-performance": ["headmaster", "admin"],
      "/dashboard/billing": ["bursar"],
      "/dashboard/academic-terms": ["headmaster"],
      "/dashboard/student-enrollments": ["headmaster"],
      "/dashboard/schools": ["marketer"],
    };
    for (const [path, roles] of Object.entries(navOwners)) {
      for (const role of roles) {
        expect({ role, path, allowed: canAccess(role, permissionFor(path)!) }).toEqual({ role, path, allowed: true });
      }
    }
  });

  it("leaves the parent portal and teacher workspaces open", () => {
    expect(permissionFor("/dashboard/parent")).toBeUndefined();
    expect(permissionFor("/dashboard")).toBeUndefined();
    for (const path of [
      "/dashboard/classes",
      "/dashboard/subjects",
      "/dashboard/syllabus",
      "/dashboard/period-attendance",
      "/dashboard/grades",
      "/dashboard/attendance",
      "/dashboard/students",
      "/dashboard/reports",
    ]) {
      const permission = permissionFor(path);
      expect({ path, allowed: permission ? canAccess("teacher", permission) : true }).toEqual({ path, allowed: true });
    }
  });

  it("lets teachers reach nothing that manages money, accounts or school setup", () => {
    for (const path of [
      "/dashboard/users",
      "/dashboard/finance",
      "/dashboard/billing",
      "/dashboard/bulk-sms",
      "/dashboard/academic-terms",
      "/dashboard/rollover",
      "/dashboard/term-end",
      "/dashboard/osx",
      "/dashboard/system-health",
      "/dashboard/workflows",
      "/dashboard/automation",
      "/dashboard/student-enrollments",
    ]) {
      const permission = permissionFor(path);
      expect({ path, allowed: permission ? canAccess("teacher", permission) : true }).toEqual({ path, allowed: false });
    }
  });
});

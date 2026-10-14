// User roles and permissions system
import { deepFreeze } from "./deep-freeze";

export type UserRole =
  | "teacher"
  | "dean_of_studies"
  | "bursar"
  | "headmaster"
  | "board"
  | "parent"
  | "admin"
  | "school_admin"
  | "super_admin"
  | "secretary"
  | "dorm_master"
  | "marketer";

export interface RolePermissions {
  students: boolean;
  attendance: boolean;
  grades: boolean;
  fees: boolean;
  fee_status: boolean;
  messages: boolean;
  reports: boolean;
  staff: boolean;
  settings: boolean;
  discipline: boolean;
  invoicing: boolean;
  assets: boolean;
  analytics: boolean;
  export: boolean;
  boardReport: boolean;
  autoSMS: boolean;
  warnings: boolean;
  visitors: boolean;
  payroll: boolean;
  performance: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = deepFreeze({
  teacher: {
    students: true,
    attendance: true,
    grades: true,
    fees: false,
    fee_status: true,
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
    payroll: false,
    performance: false,
  },
  dean_of_studies: {
    students: true,
    attendance: true,
    grades: true,
    fees: false,
    fee_status: true,
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
    payroll: false,
    performance: true,
  },
  bursar: {
    students: true,
    attendance: false,
    grades: false,
    fees: true,
    fee_status: true,
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
    payroll: true,
    performance: false,
  },
  headmaster: {
    students: true,
    attendance: true,
    grades: true,
    fees: true,
    fee_status: true,
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
    payroll: true,
    performance: true,
  },
  board: {
    students: false,
    attendance: false,
    grades: false,
    fees: false,
    fee_status: false,
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
    payroll: false,
    performance: false,
  },
  parent: {
    students: false,
    attendance: false,
    grades: false,
    fees: false,
    fee_status: false,
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
    payroll: false,
    performance: false,
  },
  admin: {
    students: true,
    attendance: true,
    grades: true,
    fees: true,
    fee_status: true,
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
    payroll: true,
    performance: true,
  },
  school_admin: {
    students: true,
    attendance: true,
    grades: true,
    fees: true,
    fee_status: true,
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
    payroll: true,
    performance: true,
  },
  super_admin: {
    students: true,
    attendance: true,
    grades: true,
    fees: true,
    fee_status: true,
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
    payroll: true,
    performance: true,
  },
  secretary: {
    // Secretaries are the data-entry role in most schools: they type in
    // students and run CSV imports, but still can't touch fees/grades/payroll.
    students: true,
    attendance: false,
    grades: false,
    fees: false,
    fee_status: false,
    messages: true,
    reports: false,
    staff: false,
    settings: false,
    discipline: false,
    invoicing: false,
    assets: false,
    analytics: false,
    export: true,
    boardReport: false,
    autoSMS: true,
    warnings: false,
    visitors: true,
    payroll: false,
    performance: false,
  },
  dorm_master: {
    students: true,
    attendance: true,
    grades: false,
    fees: false,
    fee_status: false,
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
    payroll: false,
    performance: false,
  },
  marketer: {
    students: false,
    attendance: false,
    grades: false,
    fees: false,
    fee_status: false,
    messages: false,
    reports: true,
    staff: false,
    settings: false,
    discipline: false,
    invoicing: false,
    assets: false,
    analytics: true,
    export: false,
    boardReport: false,
    autoSMS: false,
    warnings: false,
    visitors: false,
    payroll: false,
    performance: false,
  },
});

export const ROLE_LABELS: Record<UserRole, string> = deepFreeze({
  teacher: "Teacher",
  dean_of_studies: "Dean of Studies",
  bursar: "Bursar",
  headmaster: "Headteacher",
  board: "Board Member",
  parent: "Parent",
  admin: "Administrator",
  school_admin: "School Admin",
  super_admin: "Super Admin",
  secretary: "Secretary",
  dorm_master: "Dorm Master",
  marketer: "Field Marketer",
});

export const ROLE_ORDER: readonly UserRole[] = deepFreeze([
  "super_admin",
  "headmaster",
  "school_admin",
  "admin",
  "dean_of_studies",
  "bursar",
  "teacher",
  "secretary",
  "dorm_master",
  "board",
  "parent",
  "marketer",
]);

export const PERMISSION_LABELS: Record<keyof RolePermissions, string> = deepFreeze({
  students: "Students",
  attendance: "Attendance",
  grades: "Grades",
  fees: "Fees",
  fee_status: "Fee Status (Silent)",
  messages: "Messages",
  reports: "Reports",
  staff: "Staff",
  settings: "Settings",
  discipline: "Discipline",
  invoicing: "Invoicing",
  assets: "Assets",
  analytics: "Analytics",
  export: "Export",
  boardReport: "Board Report",
  autoSMS: "Auto SMS",
  warnings: "Warnings",
  visitors: "Visitors",
  payroll: "Payroll",
  performance: "Performance",
});

/**
 * Roles whose row access follows the classes they teach instead of the whole
 * school — the client-side twin of `is_class_scoped_role()` in
 * supabase/migrations/202611030001_teacher_class_scope.sql. Shared by UI
 * gating (read-only registry) and src/lib/server/class-scope.ts (API checks).
 */
export function isClassScopedRole(role: string | null | undefined): boolean {
  return role === "teacher" || role === "class_teacher";
}

export function canAccess(role: UserRole, feature: keyof RolePermissions): boolean {
  return ROLE_PERMISSIONS[role]?.[feature] ?? false;
}

/**
 * Permission check across every role a person holds.
 *
 * In most rural schools one person wears several hats: the headmaster often
 * also teaches and the bursar is frequently also a teacher. `canAccess` reads
 * a single role, so a bursar who also teaches was refused marks entry and had
 * no route to the grades page at all. Granting `grades` to the `bursar` role
 * instead would hand marks to every bursar everywhere, including fee clerks who
 * must never see it — so permissions are unioned per person, not per role.
 *
 * Roles are taken as plain strings because two `UserRole` unions exist in this
 * codebase (types/index.ts also carries "student", which has no permissions
 * table entry). Unknown values resolve to `false` via `canAccess`, so a role
 * the permission table does not know can never grant access.
 */
export function canAccessAny(
  roles: readonly (string | null | undefined)[] | string | null | undefined,
  feature: keyof RolePermissions,
): boolean {
  if (!roles) return false;
  const list = Array.isArray(roles) ? roles : [roles];
  return list.some((role) => role != null && canAccess(role as UserRole, feature));
}

/**
 * True when the person holds ANY of the given roles. Used for role-intent
 * questions such as "should this dashboard be on offer to them at all".
 */
export function hasAnyRole(
  roles: readonly (string | null | undefined)[] | string | null | undefined,
  candidates: readonly (UserRole | string)[],
): boolean {
  if (!roles) return false;
  const list = Array.isArray(roles) ? roles : [roles];
  return list.some((role) => role != null && candidates.includes(role));
}

/**
 * The role used for labelling and for places that genuinely need one hat
 * (dashboard title, receipts). Prefers the primary role when the caller
 * supplies it via `primary`, otherwise the first known role.
 */
export function primaryRole(
  roles: readonly (string | null | undefined)[] | string | null | undefined,
  primary?: string | null,
): string | null {
  const list = !roles ? [] : Array.isArray(roles) ? roles : [roles];
  const known = list.filter((role): role is string => typeof role === "string" && role.length > 0);
  // The primary role only wins if they actually hold it — a stale
  // `users.role` must not relabel someone into a hat they do not have.
  if (primary && known.includes(primary)) return primary;
  if (known.length > 0) return known[0];
  return primary && primary.length > 0 ? primary : null;
}

/**
 * True when the person holds a class-scoped role. Callers that previously
 * passed a single role still work; multi-role staff keep the class scoping
 * that their teaching hat implies.
 */
export function isClassScopedAnyRole(
  roles: readonly (string | null | undefined)[] | string | null | undefined,
): boolean {
  if (!roles) return false;
  const list = Array.isArray(roles) ? roles : [roles];
  return list.some((role) => role != null && isClassScopedRole(role));
}

export function getRoleLabel(role: UserRole): string {
  return ROLE_LABELS[role] ?? role;
}

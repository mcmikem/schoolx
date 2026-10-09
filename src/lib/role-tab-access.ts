export const ROLE_TAB_ACCESS: Record<string, string[]> = {
  school_admin: ["general", "config", "users", "notifications", "messaging", "checklist", "backup", "subscription"],
  admin: ["general", "config", "users", "notifications", "messaging", "checklist", "backup", "subscription"],
  headmaster: ["general", "config", "users", "notifications", "messaging", "checklist", "backup", "subscription"],
  super_admin: ["general", "config", "users", "notifications", "messaging", "checklist", "backup", "subscription"],
  bursar: ["general", "notifications", "messaging", "subscription"],
  dean_of_studies: ["general", "config", "notifications"],
  teacher: ["general", "notifications"],
  secretary: ["general", "notifications"],
  dorm_master: ["general", "notifications"],
};

export function tabsForRole(role?: string): string[] {
  return ROLE_TAB_ACCESS[role || "teacher"] || ROLE_TAB_ACCESS.teacher;
}

export function canOpenSettingsPage(role?: string): boolean {
  if (!role) return false;
  return tabsForRole(role).includes("subscription");
}

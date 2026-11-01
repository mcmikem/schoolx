export const ROLE_TAB_ACCESS: Record<string, string[]> = {
  school_admin: [
    "profile",
    "general",
    "config",
    "users",
    "notifications",
    "messaging",
    "checklist",
    "backup",
    "subscription",
  ],
  admin: ["profile", "general", "config", "users", "notifications", "messaging", "checklist", "backup", "subscription"],
  headmaster: [
    "profile",
    "general",
    "config",
    "users",
    "notifications",
    "messaging",
    "checklist",
    "backup",
    "subscription",
  ],
  super_admin: [
    "profile",
    "general",
    "config",
    "users",
    "notifications",
    "messaging",
    "checklist",
    "backup",
    "subscription",
  ],
  bursar: ["profile", "notifications", "messaging", "subscription"],
  dean_of_studies: ["profile", "config", "notifications"],
  teacher: ["profile", "notifications"],
  secretary: ["profile", "notifications"],
  dorm_master: ["profile", "notifications"],
};

export function tabsForRole(role?: string): string[] {
  return ROLE_TAB_ACCESS[role || "teacher"] || ROLE_TAB_ACCESS.teacher;
}

export function canOpenSettingsPage(role?: string): boolean {
  if (!role) return false;
  // Any role with at least one settings tab gets the page (teacher/secretary/
  // dorm_master see a settings-lite with only general + notifications).
  return tabsForRole(role).length > 0;
}

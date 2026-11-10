export const DEMO_SCHOOL_ID = "00000000-0000-0000-0000-000000000001";

const DEMO_SESSION_ROLES = new Set([
  "headmaster",
  "dean_of_studies",
  "bursar",
  "teacher",
  "secretary",
  "dorm_master",
  "parent",
  "marketer",
]);

export interface DemoIdentity {
  userId: "demo-user";
  role: string;
  name: string;
  schoolId: typeof DEMO_SCHOOL_ID;
  schoolName: string;
}

/** Demo cookies are client editable, so they must never choose an account role or tenant. */
export function parseDemoSessionCookie(raw: string | null | undefined, enabled: boolean): DemoIdentity | null {
  if (!enabled || !raw) return null;
  try {
    const decoded = atob(raw);
    const parsed = JSON.parse(decoded) as {
      demoUser?: { name?: unknown; role?: unknown };
      demoSchool?: { id?: unknown; name?: unknown };
    };
    if (parsed.demoSchool?.id !== DEMO_SCHOOL_ID || typeof parsed.demoSchool.name !== "string") return null;
    if (typeof parsed.demoUser?.name !== "string" || typeof parsed.demoUser.role !== "string") return null;
    if (!DEMO_SESSION_ROLES.has(parsed.demoUser.role)) return null;
    return {
      userId: "demo-user",
      role: parsed.demoUser.role,
      name: parsed.demoUser.name,
      schoolId: DEMO_SCHOOL_ID,
      schoolName: parsed.demoSchool.name,
    };
  } catch {
    return null;
  }
}

export function isDemoReadOnlyMethod(method: string): boolean {
  return method === "GET" || method === "OPTIONS";
}

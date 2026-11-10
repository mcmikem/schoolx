import { DEMO_SCHOOL_ID, isDemoReadOnlyMethod, parseDemoSessionCookie } from "@/lib/server/demo-session";

function cookie(role: string, schoolId = DEMO_SCHOOL_ID) {
  return btoa(
    JSON.stringify({
      demoUser: { name: "Demo User", role },
      demoSchool: { id: schoolId, name: "Demo School" },
    }),
  );
}

describe("demo session tenant and role boundaries", () => {
  it("accepts a demo role only for the fixed demo school", () => {
    expect(parseDemoSessionCookie(cookie("teacher"), true)).toMatchObject({
      userId: "demo-user",
      role: "teacher",
      schoolId: DEMO_SCHOOL_ID,
    });
    expect(parseDemoSessionCookie(cookie("teacher", "real-school-id"), true)).toBeNull();
  });

  it("does not allow demo cookies to impersonate platform super-admins", () => {
    expect(parseDemoSessionCookie(cookie("super_admin"), true)).toBeNull();
  });

  it("disables demo identity outside explicitly enabled development mode", () => {
    expect(parseDemoSessionCookie(cookie("headmaster"), false)).toBeNull();
    expect(parseDemoSessionCookie("invalid", true)).toBeNull();
  });

  it("allows only read-shaped HTTP methods for demo API sessions", () => {
    expect(isDemoReadOnlyMethod("GET")).toBe(true);
    expect(isDemoReadOnlyMethod("HEAD")).toBe(false);
    expect(isDemoReadOnlyMethod("POST")).toBe(false);
    expect(isDemoReadOnlyMethod("DELETE")).toBe(false);
  });
});

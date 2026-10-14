import { REPORT_ALLOWED_ROLES } from "@/lib/server/report-access";
import { canAccess } from "@/lib/roles";

/**
 * A bursar clicking a student on /dashboard/reports got a silent empty
 * screen: the bursar nav and ROLE_PERMISSIONS both grant `reports`, but the
 * API allowlist denied bursar with 403 and the client swallowed the error.
 * The allowlist must stay consistent with the permission model.
 */
describe("reports access for bursar", () => {
  it("grants bursar the reports feature in the permission model", () => {
    expect(canAccess("bursar", "reports")).toBe(true);
  });

  it("includes bursar in the reports API allowlist", () => {
    expect(REPORT_ALLOWED_ROLES).toContain("bursar");
  });

  it("still excludes parent/student-facing roles", () => {
    expect(REPORT_ALLOWED_ROLES).not.toContain("parent");
    expect(REPORT_ALLOWED_ROLES).not.toContain("student");
    expect(REPORT_ALLOWED_ROLES).not.toContain("marketer");
  });
});

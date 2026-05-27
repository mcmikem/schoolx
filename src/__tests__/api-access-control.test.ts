import {
  hasApiAccess,
  hasUserPermission,
  assertUserRoleOrDeny,
} from "@/lib/api-utils";

describe("api access control helpers", () => {
  it("allows a role with required permission", () => {
    const result = hasUserPermission({
      userRole: "school_admin",
      permission: "settings",
    });
    expect(result).toBe(true);
  });

  it("blocks a role missing required permission", () => {
    const result = hasUserPermission({
      userRole: "teacher",
      permission: "settings",
    });
    expect(result).toBe(false);
  });

  it("allows role-based whitelist membership", () => {
    const result = assertUserRoleOrDeny({
      userRole: "dean_of_studies",
      allowedRoles: ["dean_of_studies", "school_admin"],
    });
    expect(result.ok).toBe(true);
  });

  it("enforces both permission and role whitelist when both are provided", () => {
    const result = hasApiAccess({
      userRole: "dean_of_studies",
      permission: "staff",
      allowedRoles: ["school_admin", "dean_of_studies"],
    });
    expect(result).toBe(false);
  });

  it("allows when both permission and role checks pass", () => {
    const result = hasApiAccess({
      userRole: "school_admin",
      permission: "staff",
      allowedRoles: ["school_admin", "headmaster"],
    });
    expect(result).toBe(true);
  });
});

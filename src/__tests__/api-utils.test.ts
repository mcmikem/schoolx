jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

import {
  assertSchoolScopeOrDeny,
  assertUserRoleOrDeny,
  requireDevelopmentRouteOrDeny,
} from "../lib/api-utils";

describe("api-utils guards", () => {
  describe("assertSchoolScopeOrDeny", () => {
    test("allows matching school scope", () => {
      const result = assertSchoolScopeOrDeny({
        userSchoolId: "school-1",
        requestedSchoolId: "school-1",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.schoolId).toBe("school-1");
      }
    });

    test("denies mismatched school scope", async () => {
      const result = assertSchoolScopeOrDeny({
        userSchoolId: "school-1",
        requestedSchoolId: "school-2",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(403);
        await expect(result.response.json()).resolves.toMatchObject({
          success: false,
          error: "Forbidden",
        });
      }
    });
  });

  describe("assertUserRoleOrDeny", () => {
    test("allows configured role", () => {
      const result = assertUserRoleOrDeny({
        userRole: "school_admin",
        allowedRoles: ["school_admin", "super_admin"],
      });

      expect(result.ok).toBe(true);
    });

    test("denies disallowed role", async () => {
      const result = assertUserRoleOrDeny({
        userRole: "teacher",
        allowedRoles: ["school_admin", "super_admin"],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(403);
        await expect(result.response.json()).resolves.toMatchObject({
          success: false,
          error: "Forbidden",
        });
      }
    });
  });

  describe("requireDevelopmentRouteOrDeny", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalEnableDevRoutes = process.env.ENABLE_DEV_TEST_ROUTES;

    afterEach(() => {
      (process.env as { NODE_ENV: string }).NODE_ENV = originalNodeEnv as string;
      if (originalEnableDevRoutes === undefined) {
        delete process.env.ENABLE_DEV_TEST_ROUTES;
      } else {
        process.env.ENABLE_DEV_TEST_ROUTES = originalEnableDevRoutes;
      }
    });

    test("allows explicitly enabled dev routes", () => {
      (process.env as { NODE_ENV: string }).NODE_ENV = "development";
      process.env.ENABLE_DEV_TEST_ROUTES = "true";

      expect(requireDevelopmentRouteOrDeny()).toEqual({ ok: true });
    });

    test("denies routes when not explicitly enabled", async () => {
      (process.env as { NODE_ENV: string }).NODE_ENV = "development";
      delete process.env.ENABLE_DEV_TEST_ROUTES;

      const result = requireDevelopmentRouteOrDeny();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(404);
        await expect(result.response.json()).resolves.toMatchObject({
          success: false,
          error: "Not found",
        });
      }
    });
  });
});

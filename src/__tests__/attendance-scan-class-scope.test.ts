/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const mockCanAccessClass: any = jest.fn();
const mockUpsert = jest.fn();

jest.mock("@/lib/api-utils", () => ({
  apiSuccess: (data: unknown, message?: string) => Response.json({ success: true, data, message }),
  apiError: (message: string, status: number) => Response.json({ error: message }, { status }),
  handleApiError: (error: unknown) => Response.json({ error: String(error) }, { status: 500 }),
  assertApiAccessOrDeny: () => ({ ok: true }),
  requireUserWithSchool: async () => ({
    ok: true,
    context: { schoolId: "school-a", user: { id: "teacher-a", role: "teacher" } },
  }),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: (table: string) => {
      if (table === "students") {
        const query = {
          select: () => query,
          eq: () => query,
          limit: () => query,
          then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
            Promise.resolve({
              data: [{ id: "student-a", first_name: "A", last_name: "Learner", class_id: "class-a", status: "active" }],
              error: null,
            }).then(resolve, reject),
        };
        return query;
      }
      return { upsert: mockUpsert };
    },
  }),
}));

jest.mock("@/lib/server/class-scope", () => ({
  canAccessClass: (...args: unknown[]) => mockCanAccessClass(...args),
  isClassScopedRole: (role: string) => role === "teacher" || role === "class_teacher" || role === "subject_teacher",
}));

describe("attendance scan class scope", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanAccessClass.mockResolvedValue(false);
  });

  it("denies a teacher scanning a learner outside their assigned classes", async () => {
    const { POST } = await import("@/app/api/attendance/scan/route");
    const response = await POST(
      new NextRequest("http://localhost/api/attendance/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanValue: "student-a" }),
      }),
    );

    expect(response.status).toBe(403);
    expect(mockCanAccessClass).toHaveBeenCalledWith(expect.anything(), "teacher", "teacher-a", "class-a");
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const mockRole: { value: string } = { value: "school_admin" };
const mockStudentSchool: { value: string } = { value: "school-a" };
const mockFrom = jest.fn();
const mockCreateServiceClient: any = jest.fn();
const mockUpsert = jest.fn();

jest.mock("@/lib/api-utils", () => ({
  apiSuccess: (data: unknown) => Response.json({ success: true, data }),
  apiError: (message: string, status: number) => Response.json({ error: message }, { status }),
  handleApiError: (error: unknown) => Response.json({ error: String(error) }, { status: 500 }),
  requireUserWithSchool: async () => ({
    ok: true,
    context: { schoolId: "school-a", user: { id: "admin-a", role: mockRole.value } },
  }),
  assertUserRoleOrDeny: ({ userRole, allowedRoles }: { userRole: string; allowedRoles: string[] }) =>
    allowedRoles.includes(userRole)
      ? { ok: true }
      : { ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) },
  createServiceRoleClientOrThrow: (...args: unknown[]) => mockCreateServiceClient(...args),
}));

function createQuery(table: string) {
  const query: any = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () =>
      table === "students"
        ? { data: { id: "student-a", school_id: mockStudentSchool.value }, error: null }
        : { data: null, error: null },
    upsert: (payload: unknown, options: unknown) => {
      mockUpsert(payload, options);
      return query;
    },
    single: async () => ({ data: { student_id: "student-a", school_id: "school-a" }, error: null }),
  };
  return query;
}

describe("student privacy evidence route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRole.value = "school_admin";
    mockStudentSchool.value = "school-a";
    mockUpsert.mockClear();
    mockFrom.mockImplementation((...args: unknown[]) => createQuery(String(args[0])));
    mockCreateServiceClient.mockReturnValue({ from: mockFrom });
  });

  it("denies teachers before opening the service-role client", async () => {
    mockRole.value = "teacher";
    const { GET } = await import("@/app/api/students/[id]/privacy-evidence/route");
    const response = await GET(new NextRequest("http://localhost/api/students/student-a/privacy-evidence"), {
      params: Promise.resolve({ id: "student-a" }),
    });
    expect(response.status).toBe(403);
    expect(mockCreateServiceClient).not.toHaveBeenCalled();
  });

  it("requires guardian identity and evidence when guardian consent is selected", async () => {
    const { PUT } = await import("@/app/api/students/[id]/privacy-evidence/route");
    const response = await PUT(
      new NextRequest("http://localhost/api/students/student-a/privacy-evidence", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ageAssessment: "verified",
          ageSource: "school_record",
          processingBasis: "guardian_consent",
          noticeVersion: "learner-v1",
        }),
      }),
      { params: Promise.resolve({ id: "student-a" }) },
    );
    expect(response.status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("does not read another school's privacy evidence", async () => {
    mockStudentSchool.value = "school-b";
    const { GET } = await import("@/app/api/students/[id]/privacy-evidence/route");
    const response = await GET(new NextRequest("http://localhost/api/students/student-a/privacy-evidence"), {
      params: Promise.resolve({ id: "student-a" }),
    });
    expect(response.status).toBe(404);
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith("students");
  });

  it("binds saved evidence to the authenticated school and recorder", async () => {
    const { PUT } = await import("@/app/api/students/[id]/privacy-evidence/route");
    const response = await PUT(
      new NextRequest("http://localhost/api/students/student-a/privacy-evidence", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ageAssessment: "verified",
          ageSource: "birth_record",
          processingBasis: "guardian_consent",
          noticeVersion: "learner-v1",
          guardianName: "Guardian Name",
          guardianRelationship: "Parent",
          consentObtainedAt: "2026-11-09T09:00:00.000Z",
          evidenceMethod: "signed_form",
          evidenceReference: "Admissions register 42",
        }),
      }),
      { params: Promise.resolve({ id: "student-a" }) },
    );
    expect(response.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ student_id: "student-a", school_id: "school-a", recorded_by: "admin-a" }),
      { onConflict: "student_id" },
    );
  });
});

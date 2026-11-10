/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const mockCreateServiceClient: any = jest.fn();
const mockRequireExistingSchool: any = jest.fn();
const mockSendToParent: any = jest.fn();
const mockDetectAlerts: any = jest.fn();
const mockFilterCooldown: any = jest.fn();

jest.mock("@/lib/api-utils", () => ({
  apiError: (error: string, status: number) => Response.json({ error }, { status }),
  handleApiError: () => Response.json({ error: "safe failure" }, { status: 500 }),
  requireCronSecretOrDeny: () => ({ ok: true }),
  requireExistingSchoolOrDeny: (...args: unknown[]) => mockRequireExistingSchool(...args),
  createServiceRoleClientOrThrow: () => mockCreateServiceClient(),
}));
jest.mock("@/lib/operations", () => ({
  detectConsecutiveAbsenceAlerts: (...args: unknown[]) => mockDetectAlerts(...args),
  filterAbsenceAlertsForCooldown: (...args: unknown[]) => mockFilterCooldown(...args),
}));
jest.mock("@/lib/messaging-server", () => ({ sendToParent: (...args: unknown[]) => mockSendToParent(...args) }));

function makeRequest(body: unknown) {
  return new NextRequest("https://skoolmate.test/api/automation/auto-attendance-followup", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer cron-secret" },
    body: JSON.stringify(body),
  });
}

describe("attendance follow-up privacy and bounds", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireExistingSchool.mockResolvedValue({ ok: true, schoolId: "school-1" });
    mockDetectAlerts.mockReturnValue([
      {
        studentId: "student-private-id",
        studentName: "Private Learner Name",
        parentPhone: "+256700000000",
        smsMessage: "Private attendance message",
        consecutiveAbsentDays: 4,
      },
    ]);
    mockFilterCooldown.mockReturnValue([]);

    mockCreateServiceClient.mockReturnValue({
      from: (table: string) => {
        const data =
          table === "students" ? [{ id: "student-private-id", first_name: "Private", last_name: "Learner" }] : [];
        const builder: any = {};
        for (const method of ["select", "eq", "in", "gte", "order"]) {
          builder[method] = jest.fn(() => builder);
        }
        builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
          Promise.resolve({ data, error: null }).then(resolve, reject);
        return builder;
      },
    });
  });

  it("returns only aggregate delivery counts, never learner or parent details", async () => {
    const { POST } = await import("@/app/api/automation/auto-attendance-followup/route");

    const response = await POST(makeRequest({ schoolId: "school-1", threshold: 4 }));
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.summary).toMatchObject({ studentsFlagged: 1, smsSent: 0, skipped: 1, errors: 0, threshold: 4 });
    expect(serialized).not.toContain("student-private-id");
    expect(serialized).not.toContain("Private Learner Name");
    expect(serialized).not.toContain("+256700000000");
    expect(serialized).not.toContain("Private attendance message");
  });

  it.each([0, -1, 31, 1.5, "100"])("rejects invalid absence thresholds: %s", async (threshold) => {
    const { POST } = await import("@/app/api/automation/auto-attendance-followup/route");

    const response = await POST(makeRequest({ schoolId: "school-1", threshold }));

    expect(response.status).toBe(400);
    expect(mockCreateServiceClient).not.toHaveBeenCalled();
  });
});

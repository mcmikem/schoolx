/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockCaptureMessage = jest.fn((..._args: unknown[]) => undefined);
const mockLoggerError = jest.fn((..._args: unknown[]) => undefined);

jest.mock("@sentry/nextjs", () => ({ captureMessage: (...args: unknown[]) => mockCaptureMessage(...args) }));
jest.mock("@/lib/logger", () => ({ logger: { error: (...args: unknown[]) => mockLoggerError(...args) } }));

describe("standard API error correlation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a safe retry message and correlates errors without exporting exception text", async () => {
    const { handleApiError } = await import("@/lib/api-utils");
    const secretDetail = "Learner Aminah N's medical record and database timeout";
    const response = handleApiError(new Error(secretDetail));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain("try again");
    expect(body.error).not.toContain("Learner");
    expect(body.error).not.toContain("database timeout");
    expect(body.request_id).toEqual(expect.any(String));
    expect(response.headers.get("x-request-id")).toBe(body.request_id);
    expect(mockLoggerError).toHaveBeenCalledWith(
      "[Server Error]",
      expect.objectContaining({ request_id: body.request_id, error_type: "Error" }),
    );
    expect(mockLoggerError.mock.calls.flat().join(" ")).not.toContain(secretDetail);
    expect(mockCaptureMessage).toHaveBeenCalledWith("Unhandled API error", {
      level: "error",
      tags: { request_id: body.request_id, error_type: "Error" },
    });
    expect(JSON.stringify(mockCaptureMessage.mock.calls)).not.toContain(secretDetail);
  });

  it("adds a safe correlation reference to generic 5xx responses", async () => {
    const { apiError } = await import("@/lib/api-utils");
    const response = apiError("private record failed: learner id 123", 503);
    const body = await response.json();

    expect(body.error).toContain("try again");
    expect(body.error).not.toContain("learner id 123");
    expect(body.request_id).toEqual(expect.any(String));
    expect(response.headers.get("x-request-id")).toBe(body.request_id);
    expect(mockLoggerError).toHaveBeenCalledWith("[API Error]", {
      request_id: body.request_id,
      status: 503,
    });
  });

  it("leaves client errors without server-error correlation logging", async () => {
    const { apiError } = await import("@/lib/api-utils");
    const response = apiError("Invalid form", 400);
    const body = await response.json();

    expect(body.request_id).toBeUndefined();
    expect(response.headers.get("x-request-id")).toBeNull();
    expect(mockLoggerError).not.toHaveBeenCalled();
  });
});

/** @jest-environment node */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";

const mockRequireUserWithSchool = jest.fn<(req: unknown) => Promise<unknown>>();
jest.mock("@/lib/api-utils", () => ({
  requireUserWithSchool: (req: unknown) => mockRequireUserWithSchool(req),
}));

function makeRequest(): NextRequest {
  return new Request("http://localhost/api/import-template", { method: "GET" }) as unknown as NextRequest;
}

describe("import-template route", () => {
  beforeEach(() => {
    jest.resetModules();
    mockRequireUserWithSchool.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireUserWithSchool.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: "Authentication required" }), { status: 401 }),
    });
    const { GET } = await import("../app/api/import-template/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns a downloadable Word document for an authenticated user", async () => {
    mockRequireUserWithSchool.mockResolvedValue({
      ok: true,
      context: { authUserId: "auth-1", userId: "user-1", schoolId: "school-1", user: { role: "school_admin" } },
    });
    const { GET } = await import("../app/api/import-template/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(res.headers.get("Content-Disposition")).toContain(".docx");

    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    // OOXML files start with the PK zip signature
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes.length).toBeGreaterThan(1000);
  });
});

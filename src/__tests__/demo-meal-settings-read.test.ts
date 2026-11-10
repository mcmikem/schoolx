/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const mockCreateSupabaseServerClient = jest.fn();

jest.mock("@/lib/api-utils", () => ({
  apiError: (message: string, status: number) => Response.json({ error: message }, { status }),
  apiSuccess: (data: unknown) => Response.json({ success: true, data }),
  handleApiError: (error: unknown) => Response.json({ error: String(error) }, { status: 500 }),
  requireUserWithSchool: async () => ({
    ok: true,
    context: { schoolId: "00000000-0000-0000-0000-000000000001", isDemo: true },
  }),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: (...args: unknown[]) => mockCreateSupabaseServerClient(...args),
}));

describe("demo meal settings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns local defaults without querying or seeding the database", async () => {
    const { GET } = await import("@/app/api/meals/settings/route");
    const response = await GET(new NextRequest("http://localhost/api/meals/settings"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.rules).toHaveLength(3);
    expect(mockCreateSupabaseServerClient).not.toHaveBeenCalled();
  });
});

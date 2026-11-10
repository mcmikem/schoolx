/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const mockFrom = jest.fn();
const mockCreateServiceClient = jest.fn();
const filters: Array<[string, unknown, unknown]> = [];

jest.mock("@/lib/api-utils", () => ({
  apiSuccess: (data: unknown) => Response.json({ success: true, data }),
  apiError: (message: string, status: number) => Response.json({ error: message }, { status }),
  handleApiError: (error: unknown) => Response.json({ error: String(error) }, { status: 500 }),
  requireAuthenticatedUser: async () => ({ ok: true, context: { authUserId: "auth-marketer" } }),
  createServiceRoleClientOrThrow: (...args: unknown[]) => mockCreateServiceClient(...args),
}));

function createQuery(table: string) {
  const query = {
    select: () => query,
    order: () => query,
    limit: () => query,
    eq: (column: string, value: unknown) => {
      filters.push([table, column, value]);
      return query;
    },
    maybeSingle: async () => ({ data: { id: "marketer-1", role: "marketer" }, error: null }),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve, reject),
  };
  return query;
}

describe("marketer dashboard data school scope", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    filters.length = 0;
    mockFrom.mockImplementation((...args: unknown[]) => createQuery(String(args[0])));
    mockCreateServiceClient.mockReturnValue({ from: mockFrom });
  });

  it("filters schools by the authenticated marketer before returning contact data", async () => {
    const { GET } = await import("@/app/api/marketers/data/route");
    const response = await GET(new NextRequest("http://localhost/api/marketers/data"));

    expect(response.status).toBe(200);
    expect(filters).toContainEqual(["schools", "onboarded_by", "marketer-1"]);
  });
});

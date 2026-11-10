jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init: ResponseInit) => ({ status: init.status, body }),
  },
}));

import { POST } from "../app/api/setup/route";

describe("retired database setup API", () => {
  it("always returns 404 without executing database setup", async () => {
    (process.env as { NODE_ENV: string }).NODE_ENV = "development";
    process.env.ENABLE_DEV_TEST_ROUTES = "true";

    const response = POST() as unknown as { status: number; body: unknown };
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ success: false, error: "Not found" });
  });
});

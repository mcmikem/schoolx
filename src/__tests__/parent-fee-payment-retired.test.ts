jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init: ResponseInit) => ({ status: init.status, body, headers: init.headers }),
  },
}));

import { POST } from "../app/api/parent/fee-payment/route";

describe("retired legacy parent fee-payment endpoint", () => {
  it("rejects unbound provider references and directs parents to reviewed claims", () => {
    const response = POST() as unknown as { status: number; body: unknown; headers: HeadersInit };
    expect(response.status).toBe(410);
    expect(response.body).toMatchObject({
      success: false,
      error: expect.stringContaining("payment claim"),
    });
    expect(response.headers).toMatchObject({ "Cache-Control": "no-store" });
  });
});

/** @jest-environment node */

import type { NextRequest } from "next/server";
import { requireUserWithSchool, createServiceRoleClientOrThrow } from "@/lib/api-utils";

jest.mock("@/lib/api-utils", () => {
  const actual = jest.requireActual("@/lib/api-utils");
  return {
    ...actual,
    requireUserWithSchool: jest.fn(),
    createServiceRoleClientOrThrow: jest.fn(),
  };
});

const mockRequireUser = requireUserWithSchool as jest.Mock;
const mockServiceClient = createServiceRoleClientOrThrow as jest.Mock;

function makeRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/timetable/schedule/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const AUTH = {
  ok: true as const,
  context: {
    schoolId: "school-1",
    user: { id: "user-1", role: "headmaster", full_name: "Head Teacher" },
  },
};

const VALID_SLOTS = [
  { name: "First Period", start_time: "08:00", end_time: "09:00", is_lesson: true, order_number: 1 },
  { name: "Break", start_time: "09:00", end_time: "09:30", is_lesson: false, order_number: 2 },
  { name: "Second Period", start_time: "09:30", end_time: "10:30", is_lesson: true, order_number: 3 },
];

function mockSupabase(rpcResult: { data?: unknown; error?: unknown } | undefined) {
  const rpc = jest.fn(() => Promise.resolve(rpcResult ?? { data: null, error: null }));
  const builderFor = () => {
    const b: Record<string, jest.Mock | ((r: (v: unknown) => unknown) => Promise<unknown>)> = {};
    b.select = jest.fn(() => b);
    b.eq = jest.fn(() => b);
    b.maybeSingle = jest.fn(() =>
      Promise.resolve({ data: { id: "school-1", billing_mode: "full_suite" }, error: null }),
    );
    b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(resolve({ data: [], error: null }));
    return b;
  };
  return { from: jest.fn(() => builderFor()), rpc };
}

describe("POST /api/timetable/schedule", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireUser.mockResolvedValue(AUTH);
  });

  it("rejects unauthenticated callers", async () => {
    mockRequireUser.mockResolvedValue({ ok: false, response: new Response("no", { status: 401 }) });
    const { POST } = await import("../app/api/timetable/schedule/route");
    const res = await POST(makeRequest({ academicYear: "2026", slots: VALID_SLOTS }));
    expect(res.status).toBe(401);
  });

  it("rejects roles outside academic leadership", async () => {
    mockRequireUser.mockResolvedValue({
      ok: true,
      context: { schoolId: "school-1", user: { id: "u2", role: "teacher", full_name: "T" } },
    });
    const { POST } = await import("../app/api/timetable/schedule/route");
    const res = await POST(makeRequest({ academicYear: "2026", slots: VALID_SLOTS }));
    expect(res.status).toBe(403);
  });

  it("validates the basic envelope before opening any transaction", async () => {
    mockServiceClient.mockReturnValue(mockSupabase(undefined));
    const { POST } = await import("../app/api/timetable/schedule/route");
    const year = await POST(makeRequest({ slots: VALID_SLOTS }));
    expect(year.status).toBe(400);

    const empty = await POST(makeRequest({ academicYear: "2026", slots: [] }));
    expect(empty.status).toBe(400);

    const endTimeFirst = await POST(
      makeRequest({
        academicYear: "2026",
        slots: [{ name: "P", start_time: "10:00", end_time: "08:00", order_number: 1 }],
      }),
    );
    expect(endTimeFirst.status).toBe(400);

    const gap = await POST(
      makeRequest({
        academicYear: "2026",
        slots: [
          { name: "A", start_time: "08:00", end_time: "09:00", order_number: 2 },
          { name: "B", start_time: "09:00", end_time: "10:00", order_number: 3 },
        ],
      }),
    );
    expect(gap.status).toBe(400);

    const badVersionInput = await POST(
      makeRequest({ academicYear: "2026", slots: VALID_SLOTS, expectedVersion: "not-a-number" }),
    );
    expect(badVersionInput.status).toBe(400);
  });

  it("replaces the schedule through the transactional RPC", async () => {
    const result = {
      version: 13,
      slots: VALID_SLOTS.map((s, i) => ({ id: `slot-${i}`, ...s, order_number: i + 1 })),
      constraints: [],
    };
    const client = mockSupabase({ data: result, error: null });
    mockServiceClient.mockReturnValue(client);
    const { POST } = await import("../app/api/timetable/schedule/route");
    const res = await POST(makeRequest({ academicYear: "2026", slots: VALID_SLOTS }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.version).toBe(13);
    expect(json.data.slots).toHaveLength(3);

    expect(client.rpc).toHaveBeenCalledWith(
      "replace_timetable_schedule",
      expect.objectContaining({
        p_school_id: "school-1",
        p_academic_year: "2026",
        p_expected_version: null,
        p_actor_id: "user-1",
        p_retain_entries: true,
      }),
    );
    const rpcCalls = (client.rpc as unknown as jest.Mock).mock.calls as unknown[][];
    const args = rpcCalls[0][1] as { p_slots: Array<Record<string, unknown>> };
    expect(args.p_slots[0]).toMatchObject({ name: "First Period", start_time: "08:00:00" });
    expect(args.p_slots[1]).toMatchObject({ is_lesson: false, order_number: 2 });
  });

  it("passes expectedVersion through for optimistic concurrency", async () => {
    const client = mockSupabase({ data: { version: 13, slots: [], constraints: [] }, error: null });
    mockServiceClient.mockReturnValue(client);
    const { POST } = await import("../app/api/timetable/schedule/route");
    const res = await POST(
      makeRequest({ academicYear: "2026", slots: VALID_SLOTS, expectedVersion: 12, retainEntries: false }),
    );
    expect(res.status).toBe(200);
    expect(client.rpc).toHaveBeenCalledWith(
      "replace_timetable_schedule",
      expect.objectContaining({ p_expected_version: 12, p_retain_entries: false }),
    );
  });

  it("maps stale schedule versions to 409", async () => {
    mockServiceClient.mockReturnValue(
      mockSupabase({ error: { message: "stale schedule version: expected 11, current 13", code: "40001" } }),
    );
    const { POST } = await import("../app/api/timetable/schedule/route");
    const res = await POST(makeRequest({ academicYear: "2026", slots: VALID_SLOTS, expectedVersion: 11 }));
    expect(res.status).toBe(409);
  });

  it("maps unmappable constraints to 409", async () => {
    mockServiceClient.mockReturnValue(
      mockSupabase({ error: { message: "existing constraints cannot be mapped to the new schedule", code: "23505" } }),
    );
    const { POST } = await import("../app/api/timetable/schedule/route");
    const res = await POST(makeRequest({ academicYear: "2026", slots: VALID_SLOTS }));
    expect(res.status).toBe(409);
  });

  it("maps tenant violations to 403", async () => {
    mockServiceClient.mockReturnValue(
      mockSupabase({ error: { message: "actor is not active in the requested school", code: "42501" } }),
    );
    const { POST } = await import("../app/api/timetable/schedule/route");
    const res = await POST(makeRequest({ academicYear: "2026", slots: VALID_SLOTS }));
    expect(res.status).toBe(403);
  });

  it("returns 504 on timeout without touching writes", async () => {
    const client = mockSupabase(undefined);
    // withTimeout resolves to the 408 fallback when the RPC misses its deadline.
    client.rpc = jest.fn(() =>
      Promise.resolve({ data: null, error: null, count: null, status: 408, statusText: "Timeout", success: false }),
    );
    mockServiceClient.mockReturnValue(client);
    const { POST } = await import("../app/api/timetable/schedule/route");
    const res = await POST(makeRequest({ academicYear: "2026", slots: VALID_SLOTS }));
    expect(res.status).toBe(504);
    expect(client.rpc).toHaveBeenCalled();
  });
});

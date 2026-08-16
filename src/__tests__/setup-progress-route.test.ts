/** @jest-environment node */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";

const mockRequireUserWithSchool = jest.fn<(req: unknown) => Promise<unknown>>();
const mockCreateServiceRoleClientOrThrow = jest.fn<() => unknown>();

jest.mock("@/lib/api-utils", () => ({
  requireUserWithSchool: (req: unknown) => mockRequireUserWithSchool(req),
  createServiceRoleClientOrThrow: () => mockCreateServiceRoleClientOrThrow(),
  withSecurity: (handler: (req: NextRequest) => Promise<Response>) => handler,
  apiError: (error: string, status: number) =>
    new Response(JSON.stringify({ success: false, error }), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  apiSuccess: (data: unknown, message?: string) =>
    new Response(JSON.stringify({ success: true, data, message }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  handleApiError: (error: unknown) =>
    new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    }),
}));

interface MockConfig {
  counts?: Record<string, number>;
  items?: Array<Record<string, unknown>>;
  upsertError?: unknown;
}

function buildMockClient(config: MockConfig = {}) {
  const upsertCalls: Array<Array<Record<string, unknown>>> = [];
  const updateCalls: Array<Record<string, unknown>> = [];

  const from = jest.fn((table: string) => {
    const builder: Record<string, any> = {};
    builder.isCount = false;
    builder.eqCalls = [] as Array<{ table: string; column: string; value: unknown }>;
    builder.select = jest.fn((cols: unknown, opts?: unknown) => {
      if (opts && typeof opts === "object" && (opts as { count?: unknown }).count) {
        builder.isCount = true;
      }
      return builder;
    });
    builder.eq = jest.fn((column: string, value: unknown) => {
      builder.eqCalls.push({ table, column, value });
      return builder;
    });
    builder.is = jest.fn(() => builder);
    builder.order = jest.fn(() => builder);
    builder.update = jest.fn((payload: Record<string, unknown>) => {
      updateCalls.push({ table, payload, builder });
      return builder;
    });
    builder.upsert = jest.fn((payload: Array<Record<string, unknown>>) => {
      upsertCalls.push(payload);
      return Promise.resolve({ data: null, error: config.upsertError ?? null });
    });
    builder.then = jest.fn((onFulfilled?: (value: unknown) => unknown) => {
      let value: unknown;
      if (builder.isCount) {
        value = { data: null, error: null, count: config.counts?.[table] ?? 0 };
      } else if (table === "setup_checklist") {
        value = { data: config.items ?? [], error: null };
      } else {
        value = { data: null, error: null };
      }
      return Promise.resolve(value).then(onFulfilled);
    });
    return builder;
  });

  mockCreateServiceRoleClientOrThrow.mockReturnValue({ from });
  return { from, upsertCalls, updateCalls };
}

function makeRequest(): NextRequest {
  return new Request("http://localhost/api/setup-progress", { method: "GET" }) as unknown as NextRequest;
}

const DONE_ITEMS = [
  {
    id: "1",
    school_id: "school-1",
    item_key: "class_structure",
    item_label: "Class & Stream Setup",
    is_completed: true,
    completed_at: new Date().toISOString(),
    skipped: false,
  },
  {
    id: "2",
    school_id: "school-1",
    item_key: "student_import",
    item_label: "Import Students",
    is_completed: false,
    completed_at: null,
    skipped: false,
  },
  {
    id: "3",
    school_id: "school-1",
    item_key: "academic_calendar",
    item_label: "Academic Calendar",
    is_completed: false,
    completed_at: null,
    skipped: false,
  },
];

describe("setup-progress route", () => {
  beforeEach(() => {
    jest.resetModules();
    mockRequireUserWithSchool.mockReset();
    mockCreateServiceRoleClientOrThrow.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireUserWithSchool.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: "Authentication required" }), { status: 401 }),
    });
    const { GET } = await import("../app/api/setup-progress/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 403 when the user has no school", async () => {
    mockRequireUserWithSchool.mockResolvedValue({ ok: true, context: { schoolId: null } });
    const { GET } = await import("../app/api/setup-progress/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it("ensures default items, auto-completes from data, and returns progress", async () => {
    mockRequireUserWithSchool.mockResolvedValue({ ok: true, context: { schoolId: "school-1" } });
    const client = buildMockClient({
      counts: {
        classes: 4,
        students: 12,
        academic_terms: 0,
        fee_structure: 0,
        staff: 0,
        sms_templates: 0,
        grading_schemes: 0,
      },
      items: DONE_ITEMS,
    });

    const { GET } = await import("../app/api/setup-progress/route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.total).toBe(3);
    expect(body.data.completed).toBe(1);
    expect(body.data.progress).toBe(33);
    expect(body.data.counts.class_structure).toBe(4);

    // Default checklist rows were ensured via upsert
    expect(client.upsertCalls.length).toBe(1);
    expect(client.upsertCalls[0].length).toBe(8);

    // class_structure and student_import auto-completed (classes & students present)
    const updatedItemKeys = client.updateCalls
      .map((c) => (c.builder as { eqCalls: Array<{ column: string; value: unknown }> }).eqCalls)
      .flat()
      .filter((e) => e.column === "item_key")
      .map((e) => e.value);
    expect(updatedItemKeys).toContain("class_structure");
    expect(updatedItemKeys).toContain("student_import");
    expect(updatedItemKeys).not.toContain("academic_calendar");
  });
});

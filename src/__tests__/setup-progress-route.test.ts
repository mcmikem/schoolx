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
  school?: Record<string, unknown> | null;
  studentIds?: Array<{ id: string }>;
  upsertError?: unknown;
}

function buildMockClient(config: MockConfig = {}) {
  const upsertCalls: Array<Array<Record<string, unknown>>> = [];
  const updateCalls: Array<Record<string, unknown>> = [];
  const deleteCalls: Array<{ table: string; builder: unknown }> = [];
  const countQueries: string[] = [];

  const from = jest.fn((table: string) => {
    const builder: Record<string, any> = {};
    builder.isCount = false;
    builder.eqCalls = [] as Array<{ table: string; column: string; value: unknown }>;
    builder.select = jest.fn((cols: unknown, opts?: unknown) => {
      if (opts && typeof opts === "object" && (opts as { count?: unknown }).count) {
        builder.isCount = true;
        countQueries.push(table);
      }
      return builder;
    });
    builder.eq = jest.fn((column: string, value: unknown) => {
      builder.eqCalls.push({ table, column, value });
      return builder;
    });
    builder.is = jest.fn(() => builder);
    builder.in = jest.fn(() => builder);
    builder.not = jest.fn(() => builder);
    builder.delete = jest.fn(() => {
      deleteCalls.push({ table, builder });
      return builder;
    });
    builder.order = jest.fn(() => builder);
    builder.maybeSingle = jest.fn(() => builder);
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
      } else if (table === "schools") {
        value = { data: config.school ?? null, error: null };
      } else if (table === "students") {
        value = { data: config.studentIds ?? [], error: null };
      } else {
        value = { data: null, error: null };
      }
      return Promise.resolve(value).then(onFulfilled);
    });
    return builder;
  });

  mockCreateServiceRoleClientOrThrow.mockReturnValue({ from });
  return { from, upsertCalls, updateCalls, deleteCalls, countQueries };
}

function makeRequest(): NextRequest {
  return new Request("http://localhost/api/setup-progress", { method: "GET" }) as unknown as NextRequest;
}

const PLAN_ITEMS = [
  {
    id: "1",
    school_id: "school-1",
    item_key: "school_details",
    item_label: "School details",
    is_completed: false,
    completed_at: null,
    skipped: false,
    sort_order: 0,
  },
  {
    id: "2",
    school_id: "school-1",
    item_key: "academic_term",
    item_label: "Set current academic term",
    is_completed: false,
    completed_at: null,
    skipped: false,
    sort_order: 1,
  },
  {
    id: "3",
    school_id: "school-1",
    item_key: "classes",
    item_label: "Add classes",
    is_completed: false,
    completed_at: null,
    skipped: false,
    sort_order: 2,
  },
  {
    id: "4",
    school_id: "school-1",
    item_key: "subjects",
    item_label: "Add subjects",
    is_completed: false,
    completed_at: null,
    skipped: false,
    sort_order: 3,
  },
  {
    id: "5",
    school_id: "school-1",
    item_key: "teachers",
    item_label: "Add teachers",
    is_completed: false,
    completed_at: null,
    skipped: false,
    sort_order: 4,
  },
  {
    id: "6",
    school_id: "school-1",
    item_key: "students",
    item_label: "Add students",
    is_completed: false,
    completed_at: null,
    skipped: false,
    sort_order: 5,
  },
  {
    id: "7",
    school_id: "school-1",
    item_key: "attendance",
    item_label: "Record first attendance",
    is_completed: false,
    completed_at: null,
    skipped: false,
    sort_order: 6,
  },
  {
    id: "8",
    school_id: "school-1",
    item_key: "first_payment",
    item_label: "Collect first payment",
    is_completed: false,
    completed_at: null,
    skipped: false,
    sort_order: 7,
  },
];

const COMPLETE_SCHOOL = {
  name: "Lakeview Primary",
  email: "info@lakeview.ac.ug",
  phone: "0700123456",
  logo_url: "https://example.com/logo.png",
};

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

  it("ensures plan items, auto-completes from data, returns counts + school completeness", async () => {
    mockRequireUserWithSchool.mockResolvedValue({ ok: true, context: { schoolId: "school-1" } });
    const client = buildMockClient({
      counts: {
        classes: 4,
        subjects: 9,
        staff: 6,
        students: 120,
        fee_payments: 15,
        academic_terms: 1,
        attendance: 0,
      },
      school: COMPLETE_SCHOOL,
      studentIds: [{ id: "stu-1" }, { id: "stu-2" }],
      items: PLAN_ITEMS,
    });

    const { GET } = await import("../app/api/setup-progress/route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.total).toBe(8);
    // Mock rows are all incomplete; auto-completion is written to the DB but
    // the response reflects stored items, so nothing counts as done here.
    expect(body.data.completed).toBe(0);
    expect(body.data.progress).toBe(0);
    expect(body.data.has_term).toBe(true);
    expect(body.data.school_complete).toBe(true);
    expect(body.data.counts.classes).toBe(4);
    expect(body.data.counts.students).toBe(120);
    expect(body.data.counts.attendance).toBe(0);
    expect(body.data.school).toEqual({
      has_name: true,
      has_email: true,
      has_phone: true,
      has_logo: true,
    });

    // Items returned in plan display order
    const keys = body.data.items.map((i: { item_key: string }) => i.item_key);
    expect(keys).toEqual([
      "school_details",
      "academic_term",
      "classes",
      "subjects",
      "teachers",
      "students",
      "attendance",
      "first_payment",
    ]);

    // Default checklist rows were ensured via upsert (8 plan items)
    expect(client.upsertCalls.length).toBe(1);
    expect(client.upsertCalls[0].length).toBe(8);
    expect(client.upsertCalls[0].map((i) => i.item_key)).toContain("school_details");
    expect(client.upsertCalls[0].map((i) => i.item_key)).toContain("first_payment");

    // Legacy pre-migration keys are purged for the school
    expect(client.deleteCalls.length).toBe(1);
    expect(client.deleteCalls[0].table).toBe("setup_checklist");

    // attendance counted via student IDs (no school_id column)
    expect(client.countQueries).toContain("attendance");

    // Auto-completion updates target setup_checklist rows by item_key
    const updatedItemKeys = client.updateCalls
      .map((c) => (c.builder as { eqCalls: Array<{ column: string; value: unknown }> }).eqCalls)
      .flat()
      .filter((e) => e.column === "item_key")
      .map((e) => e.value);
    expect(updatedItemKeys).toContain("classes");
    expect(updatedItemKeys).toContain("students");
    expect(updatedItemKeys).toContain("first_payment");
    // term is current (count 1) and school complete -> also auto-completed
    expect(updatedItemKeys).toContain("academic_term");
    expect(updatedItemKeys).toContain("school_details");
    // no attendance rows -> not completed
    expect(updatedItemKeys).not.toContain("attendance");
  });

  it("flags an incomplete school (placeholder name, no phone/logo)", async () => {
    mockRequireUserWithSchool.mockResolvedValue({ ok: true, context: { schoolId: "school-1" } });
    buildMockClient({
      counts: {},
      school: { name: "My School", email: "info@example.com", phone: "", logo_url: null },
      items: PLAN_ITEMS,
    });

    const { GET } = await import("../app/api/setup-progress/route");
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.data.school_complete).toBe(false);
    expect(body.data.school.has_name).toBe(false);
    expect(body.data.school.has_phone).toBe(false);
    expect(body.data.school.has_logo).toBe(false);
  });
});

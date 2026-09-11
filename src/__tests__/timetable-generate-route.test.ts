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
  return new Request("http://localhost/api/timetable/generate/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

interface TableData {
  [table: string]: unknown[];
}

// Minimal chainable Supabase mock. Filters are ignored; each table resolves
// its canned rows, so tests focus on route logic (validation, clash
// detection, slot mapping) rather than query building. Writes are recorded
// per table.
function mockSupabase(tables: TableData, inserted: { rows: unknown[] }) {
  const writes: Record<string, unknown[]> = {};
  const builderFor = (table: string) => {
    const b: Record<string, jest.Mock | ((r: (v: unknown) => unknown) => Promise<unknown>)> = {};
    b.select = jest.fn(() => b);
    b.eq = jest.fn(() => b);
    b.is = jest.fn(() => b);
    b.or = jest.fn(() => b);
    b.in = jest.fn(() => b);
    b.order = jest.fn(() => b);
    b.insert = jest.fn((rows: unknown) => {
      const list = Array.isArray(rows) ? rows : [rows];
      writes[table] = [...(writes[table] || []), ...list];
      if (table === "teacher_timetable") inserted.rows = writes[table];
      const ids = list.map((_, i) => ({ id: `new-${i}` }));
      return { select: jest.fn(() => Promise.resolve({ data: ids, error: null })) };
    });
    b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(resolve({ data: tables[table] ?? [], error: null }));
    return b;
  };
  return { from: jest.fn((table: string) => builderFor(table)) };
}

const AUTH = {
  ok: true as const,
  context: {
    schoolId: "school-1",
    user: { id: "user-1", role: "headmaster", full_name: "Head Teacher" },
  },
};

const BASE_TABLES: TableData = {
  classes: [{ id: "c1", name: "P.5A", level: "P.5" }],
  subjects: [{ id: "s-eng", name: "English", code: "ENG" }],
  users: [{ id: "t1", full_name: "Teacher One" }],
  teacher_subjects: [{ teacher_id: "t1", subject_id: "s-eng", class_id: "c1" }],
  timetable_slots: [
    { id: "slot-1", order_number: 1, is_lesson: true, start_time: "08:00", end_time: "08:40" },
    { id: "slot-2", order_number: 2, is_lesson: true, start_time: "08:40", end_time: "09:20" },
  ],
  timetable_constraints: [],
  teacher_timetable: [],
  audit_log: [],
};

describe("POST /api/timetable/generate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireUser.mockResolvedValue(AUTH);
  });

  it("rejects unauthenticated callers", async () => {
    mockRequireUser.mockResolvedValue({ ok: false, response: new Response("no", { status: 401 }) });
    const { POST } = await import("../app/api/timetable/generate/route");
    const res = await POST(makeRequest({ action: "preview", academicYear: "2026" }));
    expect(res.status).toBe(401);
  });

  it("rejects roles outside academic leadership", async () => {
    mockRequireUser.mockResolvedValue({
      ok: true,
      context: { schoolId: "school-1", user: { id: "u2", role: "teacher", full_name: "T" } },
    });
    const { POST } = await import("../app/api/timetable/generate/route");
    const res = await POST(makeRequest({ action: "preview", academicYear: "2026" }));
    expect(res.status).toBe(403);
  });

  it("previews a draft without writing anything", async () => {
    const inserted = { rows: [] as unknown[] };
    mockServiceClient.mockReturnValue(mockSupabase(BASE_TABLES, inserted));
    const { POST } = await import("../app/api/timetable/generate/route");
    const res = await POST(makeRequest({ action: "preview", academicYear: "2026", periodsDefault: 2 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.placements).toHaveLength(2);
    expect(json.data.placements[0]).toMatchObject({
      className: "P.5A",
      subjectName: "English (ENG)",
      teacherName: "Teacher One",
    });
    expect(json.data.conflicts).toEqual([]);
    expect(json.data.stats).toMatchObject({ placed: 2, unplaced: 0 });
    expect(inserted.rows).toEqual([]);
  });

  it("returns 404 when the school has no classes for the year", async () => {
    const inserted = { rows: [] as unknown[] };
    mockServiceClient.mockReturnValue(mockSupabase({ ...BASE_TABLES, classes: [] }, inserted));
    const { POST } = await import("../app/api/timetable/generate/route");
    const res = await POST(makeRequest({ action: "preview", academicYear: "2099" }));
    expect(res.status).toBe(404);
  });

  it("approves a previewed draft into teacher_timetable with slot times", async () => {
    const inserted = { rows: [] as unknown[] };
    mockServiceClient.mockReturnValue(mockSupabase(BASE_TABLES, inserted));
    const { POST } = await import("../app/api/timetable/generate/route");
    const res = await POST(
      makeRequest({
        action: "approve",
        academicYear: "2026",
        placements: [
          { classId: "c1", subjectId: "s-eng", teacherId: "t1", dayOfWeek: 1, periodNumber: 1 },
          { classId: "c1", subjectId: "s-eng", teacherId: "t1", dayOfWeek: 2, periodNumber: 2, room: "R3" },
        ],
      }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.inserted).toBe(2);
    expect(inserted.rows).toHaveLength(2);
    expect(inserted.rows[0]).toMatchObject({
      teacher_id: "t1",
      class_id: "c1",
      day_of_week: 1,
      period_number: 1,
      start_time: "08:00",
      end_time: "08:40",
      academic_year: "2026",
    });
    expect(inserted.rows[1]).toMatchObject({ room: "R3" });
  });

  it("rejects approval that clashes with the live timetable", async () => {
    const inserted = { rows: [] as unknown[] };
    mockServiceClient.mockReturnValue(
      mockSupabase(
        {
          ...BASE_TABLES,
          teacher_timetable: [{ teacher_id: "t1", class_id: "c1", day_of_week: 1, period_number: 1 }],
        },
        inserted,
      ),
    );
    const { POST } = await import("../app/api/timetable/generate/route");
    const res = await POST(
      makeRequest({
        action: "approve",
        academicYear: "2026",
        placements: [{ classId: "c1", subjectId: "s-eng", teacherId: "t1", dayOfWeek: 1, periodNumber: 1 }],
      }),
    );
    expect(res.status).toBe(409);
    expect(inserted.rows).toEqual([]);
  });

  it("rejects approval referencing unknown classes", async () => {
    const inserted = { rows: [] as unknown[] };
    mockServiceClient.mockReturnValue(mockSupabase(BASE_TABLES, inserted));
    const { POST } = await import("../app/api/timetable/generate/route");
    const res = await POST(
      makeRequest({
        action: "approve",
        academicYear: "2026",
        placements: [{ classId: "ghost", subjectId: "s-eng", teacherId: "t1", dayOfWeek: 1, periodNumber: 1 }],
      }),
    );
    expect(res.status).toBe(400);
    expect(inserted.rows).toEqual([]);
  });

  it("rejects approval when no lesson slots are defined", async () => {
    const inserted = { rows: [] as unknown[] };
    mockServiceClient.mockReturnValue(mockSupabase({ ...BASE_TABLES, timetable_slots: [] }, inserted));
    const { POST } = await import("../app/api/timetable/generate/route");
    const res = await POST(
      makeRequest({
        action: "approve",
        academicYear: "2026",
        placements: [{ classId: "c1", subjectId: "s-eng", teacherId: "t1", dayOfWeek: 1, periodNumber: 1 }],
      }),
    );
    expect(res.status).toBe(400);
    expect(inserted.rows).toEqual([]);
  });
});

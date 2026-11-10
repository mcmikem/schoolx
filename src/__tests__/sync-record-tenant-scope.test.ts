/** @jest-environment node */
import { describe, expect, it } from "@jest/globals";

import { resolveSchoolOwnership } from "@/app/api/sync/route";

function makeSupabase(owners: Record<string, string>) {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: (_column: string, id: string) => ({
          maybeSingle: async () => ({ data: { school_id: owners[`${table}:${id}`] }, error: null }),
        }),
      }),
    }),
  };
}

describe("offline sync record tenant ownership", () => {
  it.each(["attendance", "grades"])("rejects a %s row when its student belongs to another school", async (table) => {
    const result = await resolveSchoolOwnership({
      supabase: makeSupabase({
        "classes:class-a": "school-a",
        "students:student-b": "school-b",
      }) as never,
      table,
      action: "create",
      data: { class_id: "class-a", student_id: "student-b" },
      schoolId: "school-a",
    });

    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("student is outside school scope") });
  });

  it.each(["attendance", "grades"])("rejects a %s row when its class belongs to another school", async (table) => {
    const result = await resolveSchoolOwnership({
      supabase: makeSupabase({
        "classes:class-b": "school-b",
        "students:student-a": "school-a",
      }) as never,
      table,
      action: "create",
      data: { class_id: "class-b", student_id: "student-a" },
      schoolId: "school-a",
    });

    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("class is outside school scope") });
  });

  it("accepts a row only when every supplied owner reference matches the school", async () => {
    const result = await resolveSchoolOwnership({
      supabase: makeSupabase({
        "classes:class-a": "school-a",
        "students:student-a": "school-a",
      }) as never,
      table: "attendance",
      action: "create",
      data: { class_id: "class-a", student_id: "student-a" },
      schoolId: "school-a",
    });

    expect(result).toEqual({ ok: true });
  });
});

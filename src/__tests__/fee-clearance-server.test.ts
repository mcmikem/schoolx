/**
 * @jest-environment node
 */
import { loadFeeClearanceMap } from "../lib/server/fee-clearance";

function mockSupabase(tables: Record<string, any[]>) {
  const makeQuery = (rows: any[]) => {
    const result = { data: rows, error: null };
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      is: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      then: (resolve: (value: unknown) => unknown) => resolve(result),
    };
    return builder;
  };
  return { from: (table: string) => makeQuery(tables[table] ?? []) };
}

const tuition = (overrides: Record<string, unknown> = {}) => ({
  id: "f1",
  name: "Tuition",
  category: "tuition",
  class_id: null,
  boarding_status: null,
  amount: 1000,
  term: 1,
  academic_year: "2026",
  ...overrides,
});

describe("loadFeeClearanceMap", () => {
  test("marks a fully paid pupil cleared and an owing pupil not cleared", async () => {
    const supabase = mockSupabase({
      students: [
        { id: "s1", class_id: "c1", boarding_status: "day", takes_meals: false, opening_balance: 0 },
        { id: "s2", class_id: "c1", boarding_status: "day", takes_meals: false, opening_balance: 0 },
      ],
      fee_structure: [tuition()],
      fee_payments: [
        { student_id: "s1", amount_paid: 1000 },
        { student_id: "s2", amount_paid: 200 },
      ],
      fee_adjustments: [],
    });

    const map = await loadFeeClearanceMap(supabase as any, "school-1");

    expect(map.get("s1")).toEqual({ studentId: "s1", balance: 0, isCleared: true });
    expect(map.get("s2")).toEqual({ studentId: "s2", balance: 800, isCleared: false });
  });

  test("ignores a boarding-only fee for a day pupil", async () => {
    const supabase = mockSupabase({
      students: [{ id: "s1", class_id: "c1", boarding_status: "day", takes_meals: false, opening_balance: 0 }],
      fee_structure: [tuition({ id: "f1" }), tuition({ id: "f2", name: "Boarding", boarding_status: "boarding" })],
      fee_payments: [{ student_id: "s1", amount_paid: 1000 }],
      fee_adjustments: [],
    });

    const map = await loadFeeClearanceMap(supabase as any, "school-1");

    expect(map.get("s1")?.isCleared).toBe(true);
  });

  test("a bursary adjustment clears an otherwise unpaid pupil", async () => {
    const supabase = mockSupabase({
      students: [{ id: "s1", class_id: "c1", boarding_status: "day", takes_meals: false, opening_balance: 0 }],
      fee_structure: [tuition()],
      fee_payments: [],
      fee_adjustments: [{ student_id: "s1", amount: 1000, adjustment_type: "bursary" }],
    });

    const map = await loadFeeClearanceMap(supabase as any, "school-1");

    expect(map.get("s1")?.isCleared).toBe(true);
  });

  test("carries an opening balance forward into arrears", async () => {
    const supabase = mockSupabase({
      students: [{ id: "s1", class_id: "c1", boarding_status: "day", takes_meals: false, opening_balance: 400 }],
      fee_structure: [tuition()],
      fee_payments: [{ student_id: "s1", amount_paid: 1000 }],
      fee_adjustments: [],
    });

    const map = await loadFeeClearanceMap(supabase as any, "school-1", {
      currentTerm: 1,
      academicYear: "2026",
    });

    expect(map.get("s1")?.balance).toBe(400);
    expect(map.get("s1")?.isCleared).toBe(false);
  });
});

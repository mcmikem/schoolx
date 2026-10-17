import { computeFeeClearance } from "@/lib/fee-clearance";
import type { FeeStructure, Student } from "@/types";

function fee(overrides: Partial<FeeStructure>): FeeStructure {
  return {
    id: "f",
    school_id: "s",
    name: "Tuition",
    amount: 100000,
    term: 1,
    academic_year: "2026",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as FeeStructure;
}

function student(
  overrides: Partial<Student>,
): Pick<Student, "id" | "class_id" | "boarding_status"> & Partial<Pick<Student, "takes_meals" | "opening_balance">> {
  return { id: "st1", class_id: "c1", boarding_status: "day", ...overrides };
}

describe("computeFeeClearance", () => {
  it("clears a pupil who has paid in full", () => {
    const result = computeFeeClearance({
      student: student({}),
      fees: [fee({ amount: 100000, class_id: "c1" })],
      payments: [{ amount_paid: 100000 }],
      academicYear: "2026",
      currentTerm: 1,
    });

    expect(result.isCleared).toBe(true);
    expect(result.balance).toBe(0);
    expect(result.status).toBe("paid");
  });

  it("withholds while a balance remains and splits arrears", () => {
    const result = computeFeeClearance({
      student: student({}),
      fees: [
        fee({ id: "f1", amount: 100000, term: 1, class_id: "c1" }),
        fee({ id: "f2", amount: 120000, term: 2, class_id: "c1" }),
      ],
      payments: [{ amount_paid: 150000 }],
      academicYear: "2026",
      currentTerm: 2,
    });

    expect(result.isCleared).toBe(false);
    expect(result.balance).toBe(70000);
    expect(result.arrears).toBe(0);
    expect(result.currentDue).toBe(70000);
  });

  it("ignores fee lines that do not apply to the pupil's class or boarding", () => {
    const result = computeFeeClearance({
      student: student({ class_id: "c1", boarding_status: "day" }),
      fees: [
        fee({ id: "f1", amount: 100000, class_id: "c1", boarding_status: "day" }),
        fee({ id: "f2", amount: 500000, class_id: "c2", boarding_status: "day" }),
        fee({ id: "f3", amount: 400000, class_id: "c1", boarding_status: "boarding" }),
      ],
      payments: [{ amount_paid: 100000 }],
      academicYear: "2026",
      currentTerm: 1,
    });

    expect(result.expected).toBe(100000);
    expect(result.isCleared).toBe(true);
  });

  it("counts a carried-forward opening balance as arrears", () => {
    const result = computeFeeClearance({
      student: student({ opening_balance: 50000 }),
      fees: [fee({ amount: 100000, class_id: "c1" })],
      payments: [],
      academicYear: "2026",
      currentTerm: 1,
    });

    expect(result.balance).toBe(150000);
    expect(result.arrears).toBe(50000);
    expect(result.currentDue).toBe(100000);
    expect(result.isCleared).toBe(false);
  });

  it("clears a written-off balance", () => {
    const result = computeFeeClearance({
      student: student({}),
      fees: [fee({ amount: 100000, class_id: "c1" })],
      payments: [],
      adjustments: [{ amount: 100000, adjustment_type: "write_off" }],
      academicYear: "2026",
      currentTerm: 1,
    });

    expect(result.isCleared).toBe(true);
    expect(result.status).toBe("written_off");
  });
});

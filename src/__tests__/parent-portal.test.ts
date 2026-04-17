import {
  calculateAttendanceStats,
  calculateFeeStats,
  getUniqueTerms,
  mapParentStudentLinks,
  normalizeAttendanceRecords,
  normalizeGrades,
  resolveSelectedChild,
} from "@/lib/parent-portal";

describe("parent portal helpers", () => {
  it("maps linked parent rows into safe child summaries", () => {
    const children = mapParentStudentLinks([
      {
        student: {
          id: "stu-1",
          first_name: "Asha",
          last_name: "N.",
          school_id: "sch-1",
          class_id: "cls-1",
          class: { name: "P.5 Blue" },
        },
      },
      { student: null },
    ]);

    expect(children).toEqual([
      {
        id: "stu-1",
        first_name: "Asha",
        last_name: "N.",
        school_id: "sch-1",
        class_id: "cls-1",
        class_name: "P.5 Blue",
      },
    ]);
  });

  it("keeps selected child constrained to linked children", () => {
    const children = mapParentStudentLinks([
      {
        student: {
          id: "stu-1",
          first_name: "Asha",
          last_name: "N.",
          class: { name: "P.5 Blue" },
        },
      },
      {
        student: {
          id: "stu-2",
          first_name: "Ben",
          last_name: "K.",
          class: { name: "P.6" },
        },
      },
    ]);

    expect(resolveSelectedChild(children, "stu-2")?.id).toBe("stu-2");
    expect(resolveSelectedChild(children, "missing")?.id).toBe("stu-1");
  });

  it("calculates fee stats consistently", () => {
    expect(
      calculateFeeStats(
        [
          { id: "f1", name: "Tuition", amount: 800000 },
          { id: "f2", name: "Meals", amount: 200000 },
        ],
        [{ id: "p1", amount_paid: 650000, payment_date: "2026-01-01" }],
      ),
    ).toEqual({
      totalFee: 1000000,
      totalPaid: 650000,
      balance: 350000,
      status: "pending",
    });
  });

  it("normalizes attendance and calculates counters", () => {
    const records = normalizeAttendanceRecords([
      { id: "1", date: "2026-01-01", status: "present" },
      { id: "2", date: "2026-01-02", status: "late", remarks: "Traffic" },
      { id: "3", date: "2026-01-03", status: "weird-status" },
    ]);

    expect(records[1].notes).toBe("Traffic");
    expect(calculateAttendanceStats(records)).toEqual({
      present: 1,
      absent: 1,
      late: 1,
      excused: 0,
      total: 3,
    });
  });

  it("normalizes grade rows and extracts unique terms", () => {
    const grades = normalizeGrades([
      {
        id: "g1",
        score: 82,
        max_score: 100,
        term: "Term 1",
        subjects: { name: "Math" },
      },
      {
        id: "g2",
        score: 74,
        max_score: 100,
        term: "Term 2",
        subject_name: "English",
      },
    ]);

    expect(grades[0].subject_name).toBe("Math");
    expect(getUniqueTerms(grades)).toEqual(["Term 1", "Term 2"]);
  });
});

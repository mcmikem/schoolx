import {
  buildReportCardSummaries,
  calculateAttendanceStats,
  calculateFeeStats,
  getUniqueTerms,
  mapParentStudentLinks,
  normalizeFeeTermItems,
  normalizePayments,
  normalizeAttendanceRecords,
  normalizeGrades,
  normalizeWalletTransactions,
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

  it("builds report-card summaries from grade records", () => {
    const summaries = buildReportCardSummaries(
      normalizeGrades([
        {
          id: "g1",
          score: 82,
          max_score: 100,
          term: "Term 1",
          exam_type: "End of Term",
          teacher_comment: "Strong work",
          subjects: { name: "Math" },
        },
        {
          id: "g2",
          score: 70,
          max_score: 100,
          term: "Term 1",
          subjects: { name: "English" },
        },
        {
          id: "g3",
          score: 90,
          max_score: 100,
          term: "Term 2",
          subjects: { name: "Science" },
        },
      ]),
    );

    expect(summaries).toEqual([
      {
        term: "Term 1",
        averagePercent: 76,
        subjectCount: 2,
        strongestSubject: "Math",
        latestExamType: "End of Term",
        teacherComment: "Strong work",
        performanceBand: "good",
      },
      {
        term: "Term 2",
        averagePercent: 90,
        subjectCount: 1,
        strongestSubject: "Science",
        latestExamType: null,
        teacherComment: null,
        performanceBand: "excellent",
      },
    ]);
  });

  it("normalizes legacy and modern payment rows into a shared shape", () => {
    expect(
      normalizePayments([
        {
          id: "legacy-payment",
          amount_paid: 250000,
          payment_date: "2026-01-01",
          payment_method: "Cash",
          payment_reference: "LEG-1",
          fee_structure: { name: "Tuition" },
        },
        {
          id: "modern-payment",
          amount: 180000,
          payment_date: "2026-02-01",
          payment_method: "Bank",
          transaction_reference: "MOD-1",
          student_fee_terms: {
            fee_terms: { name: "Term Plan" },
          },
        },
      ]),
    ).toEqual([
      {
        id: "legacy-payment",
        amount_paid: 250000,
        payment_date: "2026-01-01",
        payment_method: "Cash",
        payment_reference: "LEG-1",
        fee_structure: { name: "Tuition" },
      },
      {
        id: "modern-payment",
        amount_paid: 180000,
        payment_date: "2026-02-01",
        payment_method: "Bank",
        payment_reference: "MOD-1",
        fee_structure: { name: "Term Plan" },
      },
    ]);
  });

  it("normalizes wallet transaction rows from legacy and modern schemas", () => {
    expect(
      normalizeWalletTransactions([
        {
          id: "legacy-tx",
          amount: 10000,
          type: "topup",
          reference: "LEG-REF",
          description: "Legacy top-up",
          created_at: "2026-01-01T10:00:00.000Z",
        },
        {
          id: "modern-tx",
          amount: 5000,
          transaction_type: "adjustment",
          reference_id: "MOD-REF",
          description: "Wallet adjustment",
          created_at: "2026-01-02T10:00:00.000Z",
        },
      ]),
    ).toEqual([
      {
        id: "legacy-tx",
        amount: 10000,
        type: "topup",
        reference: "LEG-REF",
        description: "Legacy top-up",
        created_at: "2026-01-01T10:00:00.000Z",
      },
      {
        id: "modern-tx",
        amount: 5000,
        type: "adjustment",
        reference: "MOD-REF",
        description: "Wallet adjustment",
        created_at: "2026-01-02T10:00:00.000Z",
      },
    ]);
  });

  it("maps modern fee-term assignments into fee summary items", () => {
    expect(
      normalizeFeeTermItems([
        {
          id: "term-1",
          final_amount: 400000,
          academic_year: "2026",
          fee_terms: { name: "Term One Plan" },
        },
      ]),
    ).toEqual([
      {
        id: "term-1",
        name: "Term One Plan",
        amount: 400000,
        term: "2026",
      },
    ]);
  });
});

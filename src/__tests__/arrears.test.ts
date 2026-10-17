import { computeArrearsSplit } from "@/lib/arrears";
import { calculateStudentFeePosition } from "@/lib/operations";

describe("computeArrearsSplit", () => {
  it("splits prior-term charges from the current term", () => {
    const split = computeArrearsSplit({
      academicYear: "2026",
      currentTerm: 2,
      fees: [
        { amount: 100000, term: 1, academic_year: "2026" },
        { amount: 120000, term: 2, academic_year: "2026" },
      ],
      payments: [],
    });

    expect(split.priorCharges).toBe(100000);
    expect(split.currentCharges).toBe(120000);
    expect(split.arrears).toBe(100000);
    expect(split.currentDue).toBe(120000);
    expect(split.balance).toBe(220000);
  });

  it("treats an earlier academic year as arrears", () => {
    const split = computeArrearsSplit({
      academicYear: "2026",
      currentTerm: 1,
      fees: [
        { amount: 80000, term: 3, academic_year: "2025" },
        { amount: 90000, term: 1, academic_year: "2026" },
      ],
      payments: [],
    });

    expect(split.arrears).toBe(80000);
    expect(split.currentDue).toBe(90000);
  });

  it("allocates payments to the oldest charges first", () => {
    const split = computeArrearsSplit({
      academicYear: "2026",
      currentTerm: 2,
      fees: [
        { amount: 100000, term: 1, academic_year: "2026" },
        { amount: 120000, term: 2, academic_year: "2026" },
      ],
      payments: [{ amount_paid: 150000 }],
    });

    // 150k clears the 100k arrears, 50k spills onto the current term.
    expect(split.arrears).toBe(0);
    expect(split.currentDue).toBe(70000);
    expect(split.balance).toBe(70000);
  });

  it("partially clears arrears when payment is short", () => {
    const split = computeArrearsSplit({
      academicYear: "2026",
      currentTerm: 2,
      fees: [
        { amount: 100000, term: 1, academic_year: "2026" },
        { amount: 120000, term: 2, academic_year: "2026" },
      ],
      payments: [{ amount_paid: 40000 }],
    });

    expect(split.arrears).toBe(60000);
    expect(split.currentDue).toBe(120000);
    expect(split.balance).toBe(180000);
  });

  it("counts a positive opening balance as brought forward", () => {
    const split = computeArrearsSplit({
      academicYear: "2026",
      currentTerm: 1,
      fees: [{ amount: 100000, term: 1, academic_year: "2026" }],
      payments: [{ amount_paid: 30000 }],
      openingBalance: 50000,
    });

    // Prior bucket = 50k opening; the 30k payment clears part of it.
    expect(split.arrears).toBe(20000);
    expect(split.currentDue).toBe(100000);
    expect(split.balance).toBe(120000);
  });

  it("reconciles the balance with calculateStudentFeePosition", () => {
    const fees = [
      { amount: 100000, term: 1, academic_year: "2026" },
      { amount: 120000, term: 2, academic_year: "2026" },
    ];
    const payments = [{ amount_paid: 60000 }];
    const adjustments = [
      { amount: 20000, adjustment_type: "scholarship" as const },
      { amount: 5000, adjustment_type: "penalty" as const },
    ];
    const openingBalance = 30000;

    const split = computeArrearsSplit({
      academicYear: "2026",
      currentTerm: 2,
      fees,
      payments,
      adjustments,
      openingBalance,
    });

    const position = calculateStudentFeePosition({
      feeTotal: fees.reduce((sum, f) => sum + f.amount, 0),
      payments,
      adjustments,
      openingBalance,
    });

    expect(split.totalExpected).toBe(position.totalExpected);
    expect(split.balance).toBe(position.balance);
    expect(split.arrears + split.currentDue).toBe(split.balance);
  });

  it("treats unscoped one-off charges as current", () => {
    const split = computeArrearsSplit({
      academicYear: "2026",
      currentTerm: 2,
      fees: [
        { amount: 100000, term: 1, academic_year: "2026" },
        { amount: 40000, term: null, academic_year: "2026" },
      ],
      payments: [],
    });

    expect(split.priorCharges).toBe(100000);
    expect(split.currentCharges).toBe(40000);
  });

  it("reports no arrears when nothing is owed", () => {
    const split = computeArrearsSplit({
      academicYear: "2026",
      currentTerm: 2,
      fees: [
        { amount: 100000, term: 1, academic_year: "2026" },
        { amount: 120000, term: 2, academic_year: "2026" },
      ],
      payments: [{ amount_paid: 220000 }],
    });

    expect(split.arrears).toBe(0);
    expect(split.currentDue).toBe(0);
    expect(split.balance).toBe(0);
  });

  it("falls back to all-current when the term is unknown", () => {
    const split = computeArrearsSplit({
      fees: [
        { amount: 100000, term: 1, academic_year: "2026" },
        { amount: 120000, term: 2, academic_year: "2026" },
      ],
      payments: [{ amount_paid: 50000 }],
    });

    expect(split.priorCharges).toBe(0);
    expect(split.arrears).toBe(0);
    expect(split.currentDue).toBe(170000);
  });
});

import { calculateStudentFeePosition } from "../lib/operations";
import { validateAdjustment, validatePayment, generateInvoice } from "../lib/server/fee-logic";
import { normalizeFeeSummary, HIGH_RISK_ARREARS_THRESHOLD, MAX_RETURNED_DEFAULTERS } from "../lib/hooks/fees";

describe("calculateStudentFeePosition", () => {
  it("returns unpaid when there are no payments or adjustments", () => {
    const result = calculateStudentFeePosition({
      feeTotal: 500000,
      payments: [],
    });

    expect(result.totalExpected).toBe(500000);
    expect(result.totalPaid).toBe(0);
    expect(result.balance).toBe(500000);
    expect(result.status).toBe("unpaid");
  });

  it("returns paid when payments equal the fee total", () => {
    const result = calculateStudentFeePosition({
      feeTotal: 500000,
      payments: [{ amount_paid: 500000 }],
    });

    expect(result.totalPaid).toBe(500000);
    expect(result.balance).toBe(0);
    expect(result.status).toBe("paid");
  });

  it("returns partial when payments are less than the fee total", () => {
    const result = calculateStudentFeePosition({
      feeTotal: 500000,
      payments: [{ amount_paid: 200000 }],
    });

    expect(result.totalPaid).toBe(200000);
    expect(result.balance).toBe(300000);
    expect(result.status).toBe("partial");
  });

  it("includes opening balance in expected total", () => {
    const result = calculateStudentFeePosition({
      feeTotal: 500000,
      openingBalance: 50000,
      payments: [{ amount_paid: 300000 }],
    });

    expect(result.totalExpected).toBe(550000);
    expect(result.totalPaid).toBe(300000);
    expect(result.balance).toBe(250000);
  });

  it("applies credit adjustments (bursary, discount, scholarship)", () => {
    const result = calculateStudentFeePosition({
      feeTotal: 500000,
      payments: [{ amount_paid: 200000 }],
      adjustments: [
        { adjustment_type: "bursary", amount: 100000 },
        { adjustment_type: "discount", amount: 50000 },
      ],
    });

    expect(result.totalCredits).toBe(150000);
    expect(result.totalExpected).toBe(350000);
    expect(result.totalPaid).toBe(200000);
    expect(result.balance).toBe(150000);
    expect(result.status).toBe("partial");
  });

  it("applies penalty adjustments that increase expected amount", () => {
    const result = calculateStudentFeePosition({
      feeTotal: 500000,
      payments: [{ amount_paid: 500000 }],
      adjustments: [{ adjustment_type: "penalty", amount: 20000 }],
    });

    expect(result.totalPenalties).toBe(20000);
    expect(result.totalExpected).toBe(520000);
    expect(result.balance).toBe(20000);
    expect(result.status).toBe("partial");
  });

  it("returns written_off status when a write_off adjustment zeroes the balance", () => {
    const result = calculateStudentFeePosition({
      feeTotal: 300000,
      openingBalance: 0,
      payments: [{ amount_paid: 100000 }],
      adjustments: [{ adjustment_type: "write_off", amount: 200000 }],
    });

    expect(result.totalCredits).toBe(200000);
    expect(result.totalExpected).toBe(100000);
    expect(result.totalPaid).toBe(100000);
    expect(result.balance).toBe(0);
    expect(result.status).toBe("written_off");
  });

  it("handles mixed adjustments (credits + penalties) correctly", () => {
    const result = calculateStudentFeePosition({
      feeTotal: 500000,
      payments: [{ amount_paid: 300000 }],
      adjustments: [
        { adjustment_type: "scholarship", amount: 100000 },
        { adjustment_type: "penalty", amount: 25000 },
        { adjustment_type: "manual_credit", amount: 50000 },
      ],
    });

    expect(result.totalCredits).toBe(150000);
    expect(result.totalPenalties).toBe(25000);
    expect(result.totalExpected).toBe(375000);
    expect(result.totalPaid).toBe(300000);
    expect(result.balance).toBe(75000);
  });

  it("handles empty adjustments array gracefully", () => {
    const result = calculateStudentFeePosition({
      feeTotal: 100000,
      payments: [],
      adjustments: [],
    });

    expect(result.totalCredits).toBe(0);
    expect(result.totalPenalties).toBe(0);
    expect(result.totalExpected).toBe(100000);
    expect(result.balance).toBe(100000);
    expect(result.status).toBe("unpaid");
  });

  it("handles multiple payments summing correctly", () => {
    const result = calculateStudentFeePosition({
      feeTotal: 1000000,
      payments: [{ amount_paid: 300000 }, { amount_paid: 200000 }, { amount_paid: 500000 }],
    });

    expect(result.totalPaid).toBe(1000000);
    expect(result.balance).toBe(0);
    expect(result.status).toBe("paid");
  });

  it("ensures balance never goes below zero", () => {
    const result = calculateStudentFeePosition({
      feeTotal: 100000,
      payments: [{ amount_paid: 200000 }],
    });

    expect(result.balance).toBe(0);
    expect(result.status).toBe("paid");
  });

  it("ensures totalExpected never goes below zero when credits exceed fees", () => {
    const result = calculateStudentFeePosition({
      feeTotal: 100000,
      payments: [],
      adjustments: [{ adjustment_type: "bursary", amount: 200000 }],
    });

    expect(result.totalExpected).toBe(0);
    expect(result.balance).toBe(0);
    expect(result.status).toBe("paid");
  });
});

describe("Fee adjustment creation validation", () => {
  const validAdjustment = {
    student_id: "00000000-0000-0000-0000-000000000001",
    adjustment_type: "bursary" as const,
    amount: 50000,
    description: "Financial aid",
  };

  it("accepts a valid bursary adjustment", () => {
    const errors = validateAdjustment(validAdjustment);
    expect(errors).toHaveLength(0);
  });

  it("accepts scholarship, discount, penalty, manual_credit, and write_off types", () => {
    const types = ["scholarship", "discount", "penalty", "manual_credit", "write_off", "bursary"] as const;
    for (const adjustment_type of types) {
      const errors = validateAdjustment({ ...validAdjustment, adjustment_type });
      expect(errors).toHaveLength(0);
    }
  });

  it("rejects missing student_id", () => {
    const errors = validateAdjustment({ ...validAdjustment, student_id: "" });
    expect(errors).toContain("Student is required");
  });

  it("rejects zero amount", () => {
    const errors = validateAdjustment({ ...validAdjustment, amount: 0 });
    expect(errors).toContain("Amount must be positive");
  });

  it("rejects negative amount", () => {
    const errors = validateAdjustment({ ...validAdjustment, amount: -100 });
    expect(errors).toContain("Amount must be positive");
  });

  it("rejects amount over 100 million", () => {
    const errors = validateAdjustment({ ...validAdjustment, amount: 100_000_001 });
    expect(errors).toContain("Amount seems too large");
  });

  it("rejects unknown adjustment type", () => {
    const errors = validateAdjustment({ ...validAdjustment, adjustment_type: "unknown" as any });
    expect(errors).toContain("Invalid adjustment type");
  });
});

describe("Invoice generation", () => {
  it("generates invoice with correct total and balance from fee structure", () => {
    const feeItems = [
      { name: "Tuition", amount: 300000 },
      { name: "Development", amount: 100000 },
    ];
    const payments = [{ student_id: "stu-1", amount_paid: 200000 }];

    const invoice = generateInvoice({
      studentId: "stu-1",
      studentName: "John Doe",
      studentNumber: "STU-001",
      className: "P.5",
      feeItems,
      payments,
      term: 1,
      academicYear: "2026",
    });

    expect(invoice.total_amount).toBe(400000);
    expect(invoice.amount_paid).toBe(200000);
    expect(invoice.balance).toBe(200000);
    expect(invoice.fee_items).toHaveLength(2);
    expect(invoice.status).toBe("issued");
  });

  it("generates invoice with zero balance when fully paid", () => {
    const feeItems = [{ name: "Tuition", amount: 300000 }];
    const payments = [{ student_id: "stu-1", amount_paid: 300000 }];

    const invoice = generateInvoice({
      studentId: "stu-1",
      studentName: "Jane Doe",
      studentNumber: "STU-002",
      className: "S.1",
      feeItems,
      payments,
      term: 1,
      academicYear: "2026",
    });

    expect(invoice.total_amount).toBe(300000);
    expect(invoice.balance).toBe(0);
    expect(invoice.status).toBe("paid");
  });

  it("handles no fee items", () => {
    const invoice = generateInvoice({
      studentId: "stu-1",
      studentName: "No Fees",
      studentNumber: "STU-003",
      className: "P.1",
      feeItems: [],
      payments: [],
      term: 2,
      academicYear: "2026",
    });

    expect(invoice.total_amount).toBe(0);
    expect(invoice.balance).toBe(0);
    expect(invoice.fee_items).toHaveLength(0);
  });

  it("handles multiple payments correctly", () => {
    const feeItems = [
      { name: "Tuition", amount: 500000 },
      { name: "Boarding", amount: 300000 },
    ];
    const payments = [
      { student_id: "stu-1", amount_paid: 400000 },
      { student_id: "stu-1", amount_paid: 200000 },
      { student_id: "stu-1", amount_paid: 200000 },
    ];

    const invoice = generateInvoice({
      studentId: "stu-1",
      studentName: "Multi Pay",
      studentNumber: "STU-004",
      className: "S.2",
      feeItems,
      payments,
      term: 1,
      academicYear: "2026",
    });

    expect(invoice.total_amount).toBe(800000);
    expect(invoice.amount_paid).toBe(800000);
    expect(invoice.balance).toBe(0);
  });

  it("ignores payments from other students", () => {
    const feeItems = [{ name: "Tuition", amount: 200000 }];
    const payments = [
      { student_id: "stu-1", amount_paid: 100000 },
      { student_id: "stu-2", amount_paid: 50000 },
    ];

    const invoice = generateInvoice({
      studentId: "stu-1",
      studentName: "Selective",
      studentNumber: "STU-005",
      className: "P.3",
      feeItems,
      payments,
      term: 1,
      academicYear: "2026",
    });

    expect(invoice.amount_paid).toBe(100000);
    expect(invoice.balance).toBe(100000);
  });
});

describe("Payment validation", () => {
  it("validates a correct payment", () => {
    const errors = validatePayment({
      student_id: "00000000-0000-0000-0000-000000000001",
      amount_paid: 50000,
      payment_method: "cash",
    });
    expect(errors).toHaveLength(0);
  });

  it("rejects missing student_id", () => {
    const errors = validatePayment({
      student_id: "",
      amount_paid: 50000,
      payment_method: "cash",
    });
    expect(errors).toContain("Student is required");
  });

  it("rejects zero amount", () => {
    const errors = validatePayment({
      student_id: "00000000-0000-0000-0000-000000000001",
      amount_paid: 0,
      payment_method: "cash",
    });
    expect(errors).toContain("Amount must be positive");
  });

  it("rejects negative amount", () => {
    const errors = validatePayment({
      student_id: "00000000-0000-0000-0000-000000000001",
      amount_paid: -100,
      payment_method: "cash",
    });
    expect(errors).toContain("Amount must be positive");
  });

  it("rejects amount over 100 million", () => {
    const errors = validatePayment({
      student_id: "00000000-0000-0000-0000-000000000001",
      amount_paid: 100_000_001,
      payment_method: "cash",
    });
    expect(errors).toContain("Amount seems too large");
  });

  it("rejects invalid payment method", () => {
    const errors = validatePayment({
      student_id: "00000000-0000-0000-0000-000000000001",
      amount_paid: 50000,
      payment_method: "credit_card",
    });
    expect(errors).toContain("Invalid payment method");
  });

  it("accepts all valid payment methods", () => {
    const methods = ["cash", "mobile_money", "bank", "installment"];
    for (const method of methods) {
      const errors = validatePayment({
        student_id: "00000000-0000-0000-0000-000000000001",
        amount_paid: 50000,
        payment_method: method,
      });
      expect(errors).toHaveLength(0);
    }
  });

  it("accepts optional reference and notes", () => {
    const errors = validatePayment({
      student_id: "00000000-0000-0000-0000-000000000001",
      amount_paid: 50000,
      payment_method: "mobile_money",
      payment_reference: "MTN-12345",
      paid_by: "Parent Name",
      notes: "Payment for Term 1 fees",
    });
    expect(errors).toHaveLength(0);
  });
});

// fee_summary() runs in the database so the Bursar dashboard sums the whole
// school instead of the first 100 students / 50 payments. Postgres NUMERIC and
// BIGINT columns arrive as JSON strings, so the normaliser has to coerce them
// or every headline figure silently renders as 0.
describe("normalizeFeeSummary", () => {
  it("maps the RPC row to camelCase numbers", () => {
    expect(
      normalizeFeeSummary({
        students_count: 594,
        expected_total: 2019600000,
        collected_total: 375000,
        overdue_count: 594,
        high_risk_count: 12,
        this_month_total: 150000,
        last_month_total: 225000,
        overdue_balance: 1980000000,
        defaulters: [
          {
            student_id: "84f26cdf-0000-0000-0000-000000000001",
            first_name: "Nahweera",
            last_name: "Promise",
            parent_name: "Kyasimiire Scovia",
            parent_phone: "256756620272",
            class_name: "P.1",
            balance: 200000,
          },
        ],
      }),
    ).toEqual({
      studentsCount: 594,
      expectedTotal: 2019600000,
      collectedTotal: 375000,
      overdueCount: 594,
      highRiskCount: 12,
      thisMonthTotal: 150000,
      lastMonthTotal: 225000,
      overdueBalance: 1980000000,
      defaulters: [
        {
          student_id: "84f26cdf-0000-0000-0000-000000000001",
          first_name: "Nahweera",
          last_name: "Promise",
          parent_name: "Kyasimiire Scovia",
          parent_phone: "256756620272",
          class_name: "P.1",
          balance: 200000,
        },
      ],
    });
  });

  it("defaults the defaulter block when a pre-migration row lacks it", () => {
    const summary = normalizeFeeSummary({
      students_count: 10,
      expected_total: 1000,
      collected_total: 0,
      overdue_count: 3,
      high_risk_count: 0,
      this_month_total: 0,
      last_month_total: 0,
    });

    expect(summary?.overdueBalance).toBe(0);
    expect(summary?.defaulters).toEqual([]);
  });

  it("drops unusable defaulter rows and coerces their balances", () => {
    const summary = normalizeFeeSummary({
      students_count: 5,
      expected_total: 500,
      collected_total: 0,
      overdue_count: 1,
      high_risk_count: 0,
      this_month_total: 0,
      last_month_total: 0,
      overdue_balance: "900",
      defaulters: [
        { student_id: "s1", balance: "450", first_name: "A", class_name: "P.1" },
        { student_id: null, balance: 500 },
        "garbage",
        null,
        { student_id: "s2", balance: null },
      ],
    });

    expect(summary?.overdueBalance).toBe(900);
    expect(summary?.defaulters).toEqual([
      {
        student_id: "s1",
        first_name: "A",
        last_name: null,
        parent_name: null,
        parent_phone: null,
        class_name: "P.1",
        balance: 450,
      },
      {
        student_id: "s2",
        first_name: null,
        last_name: null,
        parent_name: null,
        parent_phone: null,
        class_name: null,
        balance: 0,
      },
    ]);
  });

  it("leaves a non-array defaulters payload empty rather than throwing", () => {
    expect(normalizeFeeSummary({ expected_total: 1, defaulters: "oops" })?.defaulters).toEqual([]);
    expect(normalizeFeeSummary({ expected_total: 1, defaulters: { a: 1 } })?.defaulters).toEqual([]);
  });

  it("coerces numeric strings returned by PostgREST", () => {
    const summary = normalizeFeeSummary({
      students_count: "173",
      expected_total: "22150000.00",
      collected_total: "0",
      overdue_count: "140",
      high_risk_count: "0",
      this_month_total: "0",
      last_month_total: null,
      overdue_balance: "3100000",
    });

    expect(summary).toEqual({
      studentsCount: 173,
      expectedTotal: 22150000,
      collectedTotal: 0,
      overdueCount: 140,
      highRiskCount: 0,
      thisMonthTotal: 0,
      lastMonthTotal: 0,
      overdueBalance: 3100000,
      defaulters: [],
    });
  });

  it("returns null so callers fall back to client-side totals", () => {
    expect(normalizeFeeSummary(null)).toBeNull();
    expect(normalizeFeeSummary(undefined)).toBeNull();
    expect(normalizeFeeSummary("boom")).toBeNull();
    expect(normalizeFeeSummary({ other_function: 1 })).toBeNull();
  });

  it("treats malformed numbers as zero rather than NaN", () => {
    const summary = normalizeFeeSummary({
      students_count: "not-a-number",
      expected_total: "1000.50",
      collected_total: "",
      overdue_count: null,
      high_risk_count: null,
      this_month_total: null,
      last_month_total: null,
    });

    expect(summary).toEqual({
      studentsCount: 0,
      expectedTotal: 1000.5,
      collectedTotal: 0,
      overdueCount: 0,
      highRiskCount: 0,
      thisMonthTotal: 0,
      lastMonthTotal: 0,
      overdueBalance: 0,
      defaulters: [],
    });
  });
});

describe("HIGH_RISK_ARREARS_THRESHOLD", () => {
  it("matches the threshold the fee_summary() SQL function uses", () => {
    expect(HIGH_RISK_ARREARS_THRESHOLD).toBe(300000);
  });
});

describe("MAX_RETURNED_DEFAULTERS", () => {
  it("matches the LIMIT the fee_summary() SQL function uses", () => {
    expect(MAX_RETURNED_DEFAULTERS).toBe(20);
  });

  it("caps the row count even if the payload comes back longer", () => {
    const defaulters = Array.from({ length: 60 }, (_, i) => ({
      student_id: `s${i}`,
      balance: 100 - i,
    }));
    const summary = normalizeFeeSummary({
      students_count: 60,
      expected_total: 6000,
      collected_total: 0,
      overdue_count: 60,
      high_risk_count: 0,
      this_month_total: 0,
      last_month_total: 0,
      defaulters,
    });

    expect(summary?.defaulters).toHaveLength(MAX_RETURNED_DEFAULTERS);
    expect(summary?.defaulters[0].student_id).toBe("s0");
    expect(summary?.defaulters.at(-1)?.student_id).toBe("s19");
  });
});

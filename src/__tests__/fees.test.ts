import { calculateStudentFeePosition } from "../lib/operations";

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

// --- Helper functions for validation used in tests ---

interface AdjustmentInput {
  student_id: string;
  adjustment_type: string;
  amount: number;
  description?: string;
}

function validateAdjustment(adj: AdjustmentInput): string[] {
  const errors: string[] = [];
  const validTypes = ["discount", "scholarship", "penalty", "manual_credit", "write_off", "bursary", "amnesty"];

  if (!adj.student_id) errors.push("Student is required");
  if (!adj.amount || adj.amount <= 0) errors.push("Amount must be positive");
  if (adj.amount > 100_000_000) errors.push("Amount seems too large");
  if (!validTypes.includes(adj.adjustment_type)) errors.push("Invalid adjustment type");

  return errors;
}

interface PaymentInput {
  student_id: string;
  amount_paid: number;
  payment_method: string;
  payment_reference?: string;
  paid_by?: string;
  notes?: string;
}

function validatePayment(payment: PaymentInput): string[] {
  const errors: string[] = [];
  const validMethods = ["cash", "mobile_money", "bank", "installment", "in_kind"];

  if (!payment.student_id) errors.push("Student is required");
  if (!payment.amount_paid || payment.amount_paid <= 0) errors.push("Amount must be positive");
  if (payment.amount_paid > 100_000_000) errors.push("Amount seems too large");
  if (!validMethods.includes(payment.payment_method)) errors.push("Invalid payment method");

  return errors;
}

interface FeeItem {
  name: string;
  amount: number;
}

interface InvoiceInput {
  studentId: string;
  studentName: string;
  studentNumber: string;
  className: string;
  feeItems: FeeItem[];
  payments: Array<{ student_id: string; amount_paid: number }>;
  term: number;
  academicYear: string;
}

interface GeneratedInvoice {
  student_id: string;
  student_name: string;
  student_number: string;
  class_name: string;
  fee_items: FeeItem[];
  total_amount: number;
  amount_paid: number;
  balance: number;
  status: string;
}

function generateInvoice(input: InvoiceInput): GeneratedInvoice {
  const totalAmount = input.feeItems.reduce((sum, f) => sum + f.amount, 0);
  const studentPayments = input.payments.filter((p) => p.student_id === input.studentId);
  const amountPaid = studentPayments.reduce((sum, p) => sum + p.amount_paid, 0);
  const balance = Math.max(0, totalAmount - amountPaid);
  const status = balance === 0 ? "paid" : "issued";

  return {
    student_id: input.studentId,
    student_name: input.studentName,
    student_number: input.studentNumber,
    class_name: input.className,
    fee_items: input.feeItems,
    total_amount: totalAmount,
    amount_paid: amountPaid,
    balance,
    status,
  };
}

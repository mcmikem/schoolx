import { isUnebFeeCategory, summarizeUnebQuarantine } from "@/lib/uneb-quarantine";

describe("isUnebFeeCategory", () => {
  it("recognises UNEB and exam categories", () => {
    expect(isUnebFeeCategory("uneb")).toBe(true);
    expect(isUnebFeeCategory("UNEB Registration")).toBe(true);
    expect(isUnebFeeCategory("Exam")).toBe(true);
    expect(isUnebFeeCategory("Mock Examination")).toBe(true);
  });

  it("rejects tuition, registration-only and unknown categories", () => {
    expect(isUnebFeeCategory("tuition")).toBe(false);
    expect(isUnebFeeCategory("registration")).toBe(false);
    expect(isUnebFeeCategory("boarding")).toBe(false);
    expect(isUnebFeeCategory(null)).toBe(false);
  });
});

describe("summarizeUnebQuarantine", () => {
  const fees = [
    { id: "u1", name: "UNEB Registration", category: "uneb" },
    { id: "e1", name: "Mock Exam Fee", category: "exam" },
    { id: "t1", name: "Tuition", category: "tuition" },
  ];

  it("counts only payments against UNEB/exam fee lines", () => {
    const summary = summarizeUnebQuarantine({
      fees,
      payments: [
        { amount_paid: 120000, fee_id: "u1" },
        { amount_paid: 30000, fee_id: "e1" },
        { amount_paid: 500000, fee_id: "t1" },
        { amount_paid: 20000, fee_id: null },
      ],
    });

    expect(summary.collectedFromPupils).toBe(150000);
    expect(summary.collected).toBe(150000);
    expect(summary.held).toBe(150000);
    expect(summary.remitted).toBe(0);
  });

  it("reconciles invoiced, collected and remitted", () => {
    const summary = summarizeUnebQuarantine({
      fees,
      payments: [{ amount_paid: 400000, fee_id: "u1" }],
      remittances: [
        { amount_invoiced: 500000, amount_collected: 400000, amount_remitted: 250000, status: "part_remitted" },
      ],
    });

    expect(summary.invoiced).toBe(500000);
    expect(summary.remitted).toBe(250000);
    expect(summary.held).toBe(150000);
    expect(summary.outstandingToCollect).toBe(100000);
    expect(summary.hasRecords).toBe(true);
  });

  it("uses a hand-recorded collected figure when payments are not attributed", () => {
    const summary = summarizeUnebQuarantine({
      fees,
      payments: [{ amount_paid: 300000, fee_id: null }],
      remittances: [{ amount_invoiced: 300000, amount_collected: 300000, amount_remitted: 0 }],
    });

    expect(summary.collectedFromPupils).toBe(0);
    expect(summary.recordedCollected).toBe(300000);
    expect(summary.collected).toBe(300000);
    expect(summary.held).toBe(300000);
  });

  it("never reports a negative liability when over-remitted", () => {
    const summary = summarizeUnebQuarantine({
      fees,
      payments: [{ amount_paid: 100000, fee_id: "u1" }],
      remittances: [{ amount_invoiced: 100000, amount_collected: 100000, amount_remitted: 120000 }],
    });

    expect(summary.held).toBe(0);
    expect(summary.outstandingToCollect).toBe(0);
  });

  it("is empty when there is nothing UNEB-related", () => {
    const summary = summarizeUnebQuarantine({
      fees,
      payments: [{ amount_paid: 500000, fee_id: "t1" }],
    });

    expect(summary.collected).toBe(0);
    expect(summary.held).toBe(0);
    expect(summary.hasRecords).toBe(false);
  });
});

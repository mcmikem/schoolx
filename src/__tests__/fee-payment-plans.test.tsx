import React from "react";
import { render, screen } from "@testing-library/react";
import FeePaymentPlans from "@/components/fees/FeePaymentPlans";

const plans = [
  {
    id: "plan-1",
    student_id: "stu-1",
    total_amount: 300000,
    installments: 3,
    start_date: "2026-10-01T00:00:00.000Z",
    status: "active" as const,
    students: { first_name: "Amina", last_name: "Nakato", classes: { name: "P.5" } },
  },
  {
    id: "plan-2",
    student_id: "stu-2",
    total_amount: 120000,
    installments: 2,
    start_date: "2026-09-01T00:00:00.000Z",
    status: "completed" as const,
    students: { first_name: "Brian", last_name: "Okello", classes: { name: "P.4" } },
  },
];

function renderPlans(overrides: Partial<Parameters<typeof FeePaymentPlans>[0]> = {}) {
  return render(
    <FeePaymentPlans
      plans={plans}
      activePlanCount={1}
      completedPlanCount={1}
      totalOutstanding={300000}
      formatCurrency={(amount) => `UGX ${amount.toLocaleString()}`}
      showCreatePlan={false}
      setShowCreatePlan={() => {}}
      newPlan={{ student_id: "", total_amount: 0, installments: 3, start_date: "" }}
      setNewPlan={() => {}}
      planStudents={[]}
      createPlan={async () => {}}
      selectedPlan={null}
      setSelectedPlan={() => {}}
      installments={[]}
      markInstallmentPaid={async () => {}}
      plansLoading={false}
      {...overrides}
    />,
  );
}

describe("FeePaymentPlans", () => {
  it("shows the summary and readable plan statuses", () => {
    renderPlans();
    expect(screen.getByText("Total Plans")).toBeInTheDocument();
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Amina Nakato/).length).toBeGreaterThan(0);
  });

  it("shows the empty state", () => {
    renderPlans({ plans: [], activePlanCount: 0, completedPlanCount: 0, totalOutstanding: 0 });
    expect(screen.getByText("No payment plans")).toBeInTheDocument();
  });
});

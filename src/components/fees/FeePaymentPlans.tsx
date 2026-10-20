"use client";
import { useMemo } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { Button, DataTable, Modal, StatStrip, type DataColumn } from "@/components/ui/index";

interface PlanStudent {
  id: string;
  first_name: string;
  last_name: string;
  classes?: { name: string };
}

interface PaymentPlan {
  id: string;
  student_id: string;
  total_amount: number;
  installments: number;
  start_date: string;
  status: "active" | "completed" | "defaulted";
  students?: {
    first_name: string;
    last_name: string;
    classes: { name: string };
  };
}

interface Installment {
  id: string;
  plan_id: string;
  due_date: string;
  amount: number;
  paid: boolean;
  paid_date?: string;
}

interface FeePaymentPlansProps {
  plans: PaymentPlan[];
  activePlanCount: number;
  completedPlanCount: number;
  totalOutstanding: number;
  formatCurrency: (amount: number) => string;
  showCreatePlan: boolean;
  setShowCreatePlan: (show: boolean) => void;
  newPlan: {
    student_id: string;
    total_amount: number;
    installments: number;
    start_date: string;
  };
  setNewPlan: (plan: { student_id: string; total_amount: number; installments: number; start_date: string }) => void;
  planStudents: PlanStudent[];
  createPlan: () => Promise<void>;
  selectedPlan: PaymentPlan | null;
  setSelectedPlan: (plan: PaymentPlan | null) => void;
  installments: Installment[];
  markInstallmentPaid: (id: string) => Promise<void>;
  plansLoading: boolean;
}

const STATUS_STYLE: Record<PaymentPlan["status"], string> = {
  active: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  defaulted: "bg-red-100 text-red-800",
};

const STATUS_LABEL: Record<PaymentPlan["status"], string> = {
  active: "Active",
  completed: "Completed",
  defaulted: "Defaulted",
};

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export default function FeePaymentPlans({
  plans,
  activePlanCount,
  completedPlanCount,
  totalOutstanding,
  formatCurrency,
  showCreatePlan,
  setShowCreatePlan,
  newPlan,
  setNewPlan,
  planStudents,
  createPlan,
  selectedPlan,
  setSelectedPlan,
  installments,
  markInstallmentPaid,
  plansLoading,
}: FeePaymentPlansProps) {
  const canCreatePlan =
    planStudents.length > 0 && !!newPlan.student_id && newPlan.total_amount > 0 && !!newPlan.start_date;
  const createPlanDisabledReason =
    planStudents.length === 0
      ? "Add students first before creating payment plans."
      : !newPlan.student_id
        ? "Select a student to continue."
        : newPlan.total_amount <= 0
          ? "Enter a total amount greater than 0."
          : !newPlan.start_date
            ? "Choose a start date for the plan."
            : "";

  const installmentSummary = useMemo(() => {
    const paid = installments.filter((item) => item.paid);
    const paidAmount = paid.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return {
      paidCount: paid.length,
      paidAmount,
      remaining: Math.max(0, Number(selectedPlan?.total_amount || 0) - paidAmount),
    };
  }, [installments, selectedPlan]);

  const columns: DataColumn<PaymentPlan>[] = [
    {
      key: "student",
      header: "Student",
      sortValue: (plan) => `${plan.students?.first_name ?? ""} ${plan.students?.last_name ?? ""}`,
      render: (plan) => (
        <span className="font-medium">
          {plan.students?.first_name} {plan.students?.last_name}
        </span>
      ),
    },
    {
      key: "class",
      header: "Class",
      sortValue: (plan) => plan.students?.classes?.name ?? "",
      render: (plan) => <span className="text-sm text-[var(--t3)]">{plan.students?.classes?.name || "—"}</span>,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      sortValue: (plan) => Number(plan.total_amount),
      render: (plan) => <span className="font-bold text-[var(--t1)]">{formatCurrency(Number(plan.total_amount))}</span>,
    },
    {
      key: "installments",
      header: "Instalments",
      align: "center",
      sortValue: (plan) => plan.installments,
      render: (plan) => <span className="text-sm">{plan.installments}</span>,
    },
    {
      key: "start",
      header: "Start date",
      hideOnMobile: true,
      sortValue: (plan) => plan.start_date,
      render: (plan) => <span className="text-sm text-[var(--t3)]">{formatDate(plan.start_date)}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortValue: (plan) => plan.status,
      render: (plan) => (
        <span className={`rounded px-2 py-1 text-xs font-bold uppercase ${STATUS_STYLE[plan.status]}`}>
          {STATUS_LABEL[plan.status]}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      hideOnMobile: true,
      render: (plan) => (
        <Button size="sm" variant="ghost" onClick={() => setSelectedPlan(plan)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <>
      <StatStrip
        columns={4}
        className="mb-6"
        items={[
          { label: "Total Plans", value: plans.length },
          { label: "Active", value: activePlanCount, tone: "info" },
          { label: "Completed", value: completedPlanCount, tone: "positive" },
          { label: "Outstanding", value: formatCurrency(totalOutstanding), tone: "warning" },
        ]}
      />

      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[var(--t1)]">Payment Plans</h3>
          <p className="text-sm text-[var(--t3)]">Instalment plans for parents</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreatePlan(true)}>
          <MaterialIcon icon="add" />
          Create Plan
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={plans}
        getRowId={(plan) => plan.id}
        loading={plansLoading}
        caption="Payment plans"
        initialSort={{ key: "student", dir: "asc" }}
        empty={
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-12 text-center text-[var(--t3)]">
            No payment plans
          </div>
        }
        footer={
          <span className="text-[var(--t3)]">
            {plans.length} plan{plans.length === 1 ? "" : "s"} · {activePlanCount} active
          </span>
        }
        renderMobileCard={(plan) => (
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {plan.students?.first_name} {plan.students?.last_name}
                </p>
                <p className="text-xs text-[var(--t3)]">{plan.students?.classes?.name || "—"}</p>
              </div>
              <span
                className={`shrink-0 rounded px-2 py-1 text-[10px] font-bold uppercase ${STATUS_STYLE[plan.status]}`}
              >
                {STATUS_LABEL[plan.status]}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-[var(--t3)]">
                {plan.installments} instalments · starts {formatDate(plan.start_date)}
              </span>
              <span className="font-bold">{formatCurrency(Number(plan.total_amount))}</span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSelectedPlan(plan)}>
              View
            </Button>
          </div>
        )}
      />

      <Modal isOpen={showCreatePlan} onClose={() => setShowCreatePlan(false)} title="Create Payment Plan" size="md">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--t1)]">Student</label>
            {planStudents.length === 0 ? (
              <div className="rounded-xl border border-[var(--amber)]/30 bg-[var(--amber-soft)] px-3 py-2 text-sm text-[var(--t1)]">
                No students available
              </div>
            ) : (
              <select
                value={newPlan.student_id}
                onChange={(e) => setNewPlan({ ...newPlan, student_id: e.target.value })}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm"
              >
                <option value="">Select student...</option>
                {planStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.first_name} {student.last_name} - {student.classes?.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--t1)]">Total Amount (UGX)</label>
            <input
              type="number"
              inputMode="numeric"
              value={newPlan.total_amount}
              onChange={(e) => setNewPlan({ ...newPlan, total_amount: Number(e.target.value) })}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm"
              placeholder="Enter total amount"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--t1)]">Number of Instalments</label>
            <select
              value={newPlan.installments}
              onChange={(e) => setNewPlan({ ...newPlan, installments: Number(e.target.value) })}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm"
            >
              <option value={2}>2 Instalments</option>
              <option value={3}>3 Instalments</option>
              <option value={4}>4 Instalments</option>
              <option value={5}>5 Instalments</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--t1)]">Start Date</label>
            <input
              type="date"
              value={newPlan.start_date}
              onChange={(e) => setNewPlan({ ...newPlan, start_date: e.target.value })}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm"
            />
          </div>
          {newPlan.total_amount > 0 && newPlan.installments > 0 && (
            <div className="rounded-lg bg-[var(--primary)]/10 p-3">
              <div className="text-sm text-[var(--primary)]">
                Each instalment:{" "}
                <strong>{formatCurrency(Math.round(newPlan.total_amount / newPlan.installments))}</strong>
              </div>
            </div>
          )}
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setShowCreatePlan(false)}>
            Cancel
          </Button>
          <Button variant="primary" className="flex-1" onClick={createPlan} disabled={!canCreatePlan}>
            Create Plan
          </Button>
        </div>
        {!canCreatePlan && createPlanDisabledReason && (
          <p className="mt-3 text-sm text-[var(--t3)]">{createPlanDisabledReason}</p>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(selectedPlan)}
        onClose={() => setSelectedPlan(null)}
        title="Payment Details"
        size="md"
        headerAction={
          selectedPlan && (
            <span className="text-xs font-semibold text-[var(--t3)]">
              {installmentSummary.paidCount}/{installments.length} paid
            </span>
          )
        }
      >
        {selectedPlan && (
          <>
            <p className="mb-4 text-sm text-[var(--t3)]">
              {selectedPlan.students?.first_name} {selectedPlan.students?.last_name} ·{" "}
              {selectedPlan.students?.classes?.name}
            </p>
            <div className="mb-4 rounded-xl bg-[var(--surface-container-low)] px-4 py-3 text-sm">
              <p className="text-[var(--t2)]">
                Paid <strong className="text-[var(--green)]">{formatCurrency(installmentSummary.paidAmount)}</strong> of{" "}
                {formatCurrency(Number(selectedPlan.total_amount))}
              </p>
              <p className="mt-1 text-[var(--t3)]">
                Remaining{" "}
                <strong className="text-[var(--amber)]">{formatCurrency(installmentSummary.remaining)}</strong>
              </p>
            </div>
            <div className="space-y-3">
              {installments.map((inst, idx) => (
                <div
                  key={inst.id}
                  className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3"
                >
                  <div>
                    <div className="font-medium text-[var(--t1)]">Instalment {idx + 1}</div>
                    <div className="text-sm text-[var(--t3)]">Due: {formatDate(inst.due_date)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-[var(--t1)]">{formatCurrency(inst.amount)}</div>
                    {inst.paid ? (
                      <span className="text-sm text-[var(--green)]">Paid</span>
                    ) : (
                      <button
                        onClick={() => markInstallmentPaid(inst.id)}
                        className="rounded-lg bg-[var(--green)] px-3 py-1 text-sm font-semibold text-white"
                      >
                        Mark Paid
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Button variant="secondary" className="mt-4 w-full" onClick={() => setSelectedPlan(null)}>
              Close
            </Button>
          </>
        )}
      </Modal>
    </>
  );
}

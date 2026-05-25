"use client";
import MaterialIcon from "@/components/MaterialIcon";
import { Button } from "@/components/ui/index";
import { Card, CardBody } from "@/components/ui/Card";

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
  setNewPlan: (plan: {
    student_id: string;
    total_amount: number;
    installments: number;
    start_date: string;
  }) => void;
  planStudents: PlanStudent[];
  createPlan: () => Promise<void>;
  selectedPlan: PaymentPlan | null;
  setSelectedPlan: (plan: PaymentPlan | null) => void;
  installments: Installment[];
  markInstallmentPaid: (id: string) => Promise<void>;
  plansLoading: boolean;
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
    planStudents.length > 0 &&
    !!newPlan.student_id &&
    newPlan.total_amount > 0 &&
    !!newPlan.start_date;
  const createPlanDisabledReason = planStudents.length === 0
    ? "Add students first before creating payment plans."
    : !newPlan.student_id
      ? "Select a student to continue."
      : newPlan.total_amount <= 0
        ? "Enter a total amount greater than 0."
        : !newPlan.start_date
          ? "Choose a start date for the plan."
          : "";

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-[var(--t1)]">
              {plans.length}
            </div>
            <div className="text-sm text-[var(--t3)] mt-1">
              Total Plans
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-[var(--primary)]">
              {activePlanCount}
            </div>
            <div className="text-sm text-[var(--t3)] mt-1">Active</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-[var(--green)]">
              {completedPlanCount}
            </div>
            <div className="text-sm text-[var(--t3)] mt-1">Completed</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-[var(--amber)]">
              {formatCurrency(totalOutstanding)}
            </div>
            <div className="text-sm text-[var(--t3)] mt-1">
              Outstanding
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-on-surface">
              Payment Plans
            </h3>
            <p className="text-sm text-on-surface-variant">
              Installment plans for parents
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreatePlan(true)}
          >
            <MaterialIcon icon="add" />
            Create Plan
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-left">
                <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                  Student
                </th>
                <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                  Class
                </th>
                <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                  Total
                </th>
                <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                  Installments
                </th>
                <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                  Start Date
                </th>
                <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                  Status
                </th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {plans.map((plan) => (
                <tr key={plan.id} className="hover:bg-surface-bright">
                  <td className="px-6 py-4 font-medium">
                    {plan.students?.first_name} {plan.students?.last_name}
                  </td>
                  <td className="px-6 py-4 text-sm text-on-surface-variant">
                    {plan.students?.classes?.name}
                  </td>
                  <td className="px-6 py-4 font-bold text-secondary">
                    {formatCurrency(Number(plan.total_amount))}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {plan.installments}
                  </td>
                  <td className="px-6 py-4 text-sm text-on-surface-variant">
                    {new Date(plan.start_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                        plan.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : plan.status === "active"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {plan.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedPlan(plan)}
                    >
                      View
                    </Button>
                  </td>
                </tr>
              ))}
              {plans.length === 0 && !plansLoading && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-8 text-on-surface-variant"
                  >
                    No payment plans
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreatePlan && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4">
          <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-md max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto shadow-xl my-auto">
            <h2 className="text-xl font-bold text-on-surface mb-4">
              Create Payment Plan
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">
                  Student
                </label>
                {planStudents.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">
                    No students available
                  </div>
                ) : (
                  <select
                    value={newPlan.student_id}
                    onChange={(e) =>
                      setNewPlan({
                        ...newPlan,
                        student_id: e.target.value,
                      })
                    }
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 px-4 text-sm"
                  >
                    <option value="">Select student...</option>
                    {planStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.first_name} {s.last_name} - {s.classes?.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">
                  Total Amount (UGX)
                </label>
                <input
                  type="number"
                  value={newPlan.total_amount}
                  onChange={(e) =>
                    setNewPlan({
                      ...newPlan,
                      total_amount: Number(e.target.value),
                    })
                  }
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 px-4 text-sm"
                  placeholder="Enter total amount"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">
                  Number of Installments
                </label>
                <select
                  value={newPlan.installments}
                  onChange={(e) =>
                    setNewPlan({
                      ...newPlan,
                      installments: Number(e.target.value),
                    })
                  }
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 px-4 text-sm"
                >
                  <option value={2}>2 Installments</option>
                  <option value={3}>3 Installments</option>
                  <option value={4}>4 Installments</option>
                  <option value={5}>5 Installments</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={newPlan.start_date}
                  onChange={(e) => setNewPlan({ ...newPlan, start_date: e.target.value })}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 px-4 text-sm"
                />
              </div>
              {newPlan.total_amount > 0 && newPlan.installments > 0 && (
                <div className="p-3 bg-primary/10 rounded-lg">
                  <div className="text-sm text-primary">
                    Each installment:{" "}
                    <strong>
                      {formatCurrency(
                        Math.round(
                          newPlan.total_amount / newPlan.installments,
                        ),
                      )}
                    </strong>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreatePlan(false)}
                className="flex-1 py-3 bg-surface-container font-semibold rounded-xl text-on-surface-variant"
              >
                Cancel
              </button>
              <button
                onClick={createPlan}
                disabled={!canCreatePlan}
                className="flex-1 py-3 bg-primary text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Plan
              </button>
            </div>
            {!canCreatePlan && createPlanDisabledReason && (
              <p className="mt-3 text-sm text-[var(--t3)]">{createPlanDisabledReason}</p>
            )}
          </div>
        </div>
      )}

      {selectedPlan && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4">
          <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-md max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto shadow-xl my-auto">
            <h2 className="text-xl font-bold text-on-surface mb-2">
              Payment Details
            </h2>
            <p className="text-sm text-on-surface-variant mb-4">
              {selectedPlan.students?.first_name}{" "}
              {selectedPlan.students?.last_name} -{" "}
              {selectedPlan.students?.classes?.name}
            </p>
            <div className="space-y-3">
              {installments.map((inst, idx) => (
                <div
                  key={inst.id}
                  className="flex items-center justify-between p-3 border border-outline-variant/20 rounded-lg"
                >
                  <div>
                    <div className="font-medium text-on-surface">
                      Installment {idx + 1}
                    </div>
                    <div className="text-sm text-on-surface-variant">
                      Due: {new Date(inst.due_date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-on-surface">
                      {formatCurrency(inst.amount)}
                    </div>
                    {inst.paid ? (
                      <span className="text-sm text-green-600">Paid</span>
                    ) : (
                      <button
                        onClick={() => markInstallmentPaid(inst.id)}
                        className="text-sm bg-green-600 text-white px-3 py-1 rounded-lg"
                      >
                        Mark Paid
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setSelectedPlan(null)}
              className="w-full mt-4 py-3 bg-surface-container font-semibold rounded-xl text-on-surface-variant"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

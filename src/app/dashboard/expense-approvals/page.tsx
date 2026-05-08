"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useBudget } from "@/lib/hooks/fees";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { getErrorMessage } from "@/lib/validation";

export default function ExpenseApprovalsPage() {
  const { school } = useAuth();
  const toast = useToast();
  const { expenses, loading, updateExpenseStatus } = useBudget(school?.id);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const pendingExpenses = useMemo(() => {
    return expenses.filter((e) => e.status === "pending");
  }, [expenses]);

  const handleAction = async (id: string, status: "approved" | "rejected") => {
    setProcessingId(id);
    try {
      await updateExpenseStatus(id, status);
      toast.success(`Expense ${status} successfully`);
    } catch (err: any) {
      toast.error(getErrorMessage(err, `Failed to ${status} expense`));
    } finally {
      setProcessingId(null);
    }
  };

  if (loading && expenses.length === 0) {
    return (
      <div className="p-8">
        <TableSkeleton />
      </div>
    );
  }

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8">
        <PageHeader
          title="Expense Approvals"
          subtitle="Review and approve staff requisitions and school expenses"
        />

        {pendingExpenses.length === 0 ? (
          <EmptyState
            icon="task_alt"
            title="All caught up!"
            description="There are no pending expense requisitions requiring your approval."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {pendingExpenses.map((expense) => (
              <Card key={expense.id} className="overflow-hidden border-l-4 border-l-amber-500">
                <CardBody className="p-0">
                  <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700">
                          {expense.category}
                        </span>
                        <span className="text-xs text-[var(--t3)]">
                          Requested on {new Date(expense.expense_date || expense.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-[var(--primary)] mb-1">
                        {expense.description}
                      </h3>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--t2)]">
                          <MaterialIcon icon="payments" className="text-lg text-emerald-600" />
                          UGX {Number(expense.amount).toLocaleString()}
                        </div>
                        {expense.requested_by_name && (
                          <div className="flex items-center gap-1.5 text-sm text-[var(--t3)]">
                            <MaterialIcon icon="person" className="text-lg" />
                            {expense.requested_by_name}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        className="text-rose-600 hover:bg-rose-50"
                        onClick={() => handleAction(expense.id, "rejected")}
                        disabled={processingId === expense.id}
                      >
                        <MaterialIcon icon="close" />
                        Reject
                      </Button>
                      <Button
                        className="bg-emerald-600 shadow-emerald-600/20"
                        onClick={() => handleAction(expense.id, "approved")}
                        disabled={processingId === expense.id}
                        loading={processingId === expense.id}
                      >
                        <MaterialIcon icon="check" />
                        Approve
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-10">
          <h3 className="text-sm font-bold text-[var(--t3)] uppercase tracking-widest mb-4">
            Recent Decisions
          </h3>
          <div className="space-y-2 opacity-60">
            {expenses
              .filter((e) => e.status !== "pending")
              .slice(0, 5)
              .map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-container)] text-sm"
                >
                  <div className="flex items-center gap-3">
                    <MaterialIcon
                      icon={expense.status === "approved" ? "check_circle" : "cancel"}
                      className={expense.status === "approved" ? "text-emerald-500" : "text-rose-500"}
                    />
                    <span className="font-medium">{expense.description}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono font-semibold">
                      UGX {Number(expense.amount).toLocaleString()}
                    </span>
                    <span className="text-[10px] font-bold uppercase">
                      {expense.status}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </PageErrorBoundary>
  );
}

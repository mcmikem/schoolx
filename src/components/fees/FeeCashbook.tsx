"use client";
import MaterialIcon from "@/components/MaterialIcon";
import { Button } from "@/components/ui/index";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/EmptyState";

interface CashbookPayment {
  id: string;
  payment_date: string;
  student_id: string;
  amount_paid: number | string;
  payment_method: string;
  payment_reference?: string;
  students?: {
    first_name?: string;
    last_name?: string;
  };
}

interface FeeCashbookProps {
  cashbookSummary: {
    total: number;
    cash: number;
    momo: number;
    bank: number;
    count: number;
  };
  formatCurrency: (amount: number) => string;
  cashbookDateFilter: string;
  setCashbookDateFilter: (filter: string) => void;
  exportCashbookCSV: () => void;
  filteredCashbookPayments: CashbookPayment[];
}

export default function FeeCashbook({
  cashbookSummary,
  formatCurrency,
  cashbookDateFilter,
  setCashbookDateFilter,
  exportCashbookCSV,
  filteredCashbookPayments,
}: FeeCashbookProps) {
  const dateLabel =
    cashbookDateFilter === "today"
      ? "Today"
      : cashbookDateFilter === "week"
        ? "This Week"
        : "This Month";

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardBody>
            <div className="text-xl font-bold text-[var(--t1)]">
              {formatCurrency(cashbookSummary.total)}
            </div>
            <div className="text-sm text-[var(--t3)]">
              Total Collected
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xl font-bold text-[var(--green)]">
              {formatCurrency(cashbookSummary.cash)}
            </div>
            <div className="text-sm text-[var(--t3)]">Cash</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xl font-bold text-[var(--amber)]">
              {formatCurrency(cashbookSummary.momo)}
            </div>
            <div className="text-sm text-[var(--t3)]">Mobile Money</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xl font-bold text-[var(--navy)]">
              {formatCurrency(cashbookSummary.bank)}
            </div>
            <div className="text-sm text-[var(--t3)]">Bank</div>
          </CardBody>
        </Card>
      </div>

      <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-semibold text-on-surface">
              Transactions
            </h3>
            <p className="text-sm text-on-surface-variant">
              {cashbookSummary.count} transactions &bull; {dateLabel}
            </p>
          </div>
          <div className="flex gap-3">
            <select
              value={cashbookDateFilter}
              onChange={(e) => setCashbookDateFilter(e.target.value)}
              className="bg-surface-container-lowest border border-outline-variant rounded-xl py-2 px-4 text-sm"
              aria-label="Date range filter"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
            <Button
              variant="secondary"
              size="sm"
              onClick={exportCashbookCSV}
            >
              <MaterialIcon icon="download" />
              Export CSV
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-left">
                <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                  Date
                </th>
                <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                  Student
                </th>
                <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-right">
                  Amount
                </th>
                <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-center">
                  Method
                </th>
                <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                  Reference
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {filteredCashbookPayments.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      icon="receipt_long"
                      title="No transactions found"
                      description="There are no payments recorded for the selected period"
                    />
                  </td>
                </tr>
              ) : (
                filteredCashbookPayments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="hover:bg-surface-bright"
                  >
                    <td className="px-6 py-4 text-sm text-on-surface">
                      {new Date(
                        payment.payment_date,
                      ).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-medium text-on-surface">
                      {payment.students?.first_name}{" "}
                      {payment.students?.last_name}
                    </td>
                    <td className="px-6 py-4 text-right text-green-600 font-medium">
                      {formatCurrency(Number(payment.amount_paid))}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {payment.payment_method === "mobile_money"
                          ? "MoMo"
                          : payment.payment_method === "cash"
                            ? "Cash"
                            : payment.payment_method === "bank"
                              ? "Bank"
                              : "Other"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">
                      {payment.payment_reference || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

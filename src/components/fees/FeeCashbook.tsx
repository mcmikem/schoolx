"use client";
import MaterialIcon from "@/components/MaterialIcon";
import { EmptyState } from "@/components/EmptyState";
import { Button, DataTable, StatStrip, type DataColumn } from "@/components/ui/index";
import { paymentMethodLabel } from "@/lib/constants";

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

function paymentStudent(payment: CashbookPayment): string {
  const name = `${payment.students?.first_name ?? ""} ${payment.students?.last_name ?? ""}`.trim();
  return name || "Unknown student";
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
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
    cashbookDateFilter === "today" ? "Today" : cashbookDateFilter === "week" ? "This Week" : "This Month";

  const columns: DataColumn<CashbookPayment>[] = [
    {
      key: "date",
      header: "Date",
      sortValue: (payment) => payment.payment_date,
      render: (payment) => <span className="whitespace-nowrap">{formatDate(payment.payment_date)}</span>,
    },
    {
      key: "student",
      header: "Student",
      sortValue: paymentStudent,
      render: (payment) => <span className="font-medium">{paymentStudent(payment)}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sortValue: (payment) => Number(payment.amount_paid),
      render: (payment) => (
        <span className="font-medium text-[var(--green)]">{formatCurrency(Number(payment.amount_paid))}</span>
      ),
    },
    {
      key: "method",
      header: "Method",
      align: "center",
      sortValue: (payment) => paymentMethodLabel(payment.payment_method),
      render: (payment) => (
        <span className="inline-flex rounded-full bg-[var(--primary)]/10 px-2.5 py-1 text-xs font-medium text-[var(--primary)]">
          {paymentMethodLabel(payment.payment_method)}
        </span>
      ),
    },
    {
      key: "reference",
      header: "Reference",
      hideOnMobile: true,
      render: (payment) => <span className="text-sm text-[var(--t3)]">{payment.payment_reference || "—"}</span>,
    },
  ];

  return (
    <>
      <StatStrip
        columns={4}
        className="mb-6"
        items={[
          { label: "Total Collected", value: formatCurrency(cashbookSummary.total) },
          { label: "Cash", value: formatCurrency(cashbookSummary.cash), tone: "positive" },
          { label: "Mobile Money", value: formatCurrency(cashbookSummary.momo), tone: "warning" },
          { label: "Bank", value: formatCurrency(cashbookSummary.bank), tone: "info" },
        ]}
      />

      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-[var(--t1)]">Transactions</h3>
          <p className="text-sm text-[var(--t3)]">
            {cashbookSummary.count} transactions · {dateLabel}
          </p>
        </div>
        <div className="flex gap-3">
          <select
            value={cashbookDateFilter}
            onChange={(e) => setCashbookDateFilter(e.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm"
            aria-label="Date range filter"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
          <Button variant="secondary" size="sm" onClick={exportCashbookCSV}>
            <MaterialIcon icon="download" />
            Export CSV
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filteredCashbookPayments}
        getRowId={(payment) => payment.id}
        caption="Cashbook transactions"
        initialSort={{ key: "date", dir: "desc" }}
        empty={
          <EmptyState
            icon="receipt_long"
            title="No transactions found"
            description="There are no payments recorded for the selected period"
          />
        }
        footer={
          <span className="text-[var(--t3)]">
            {filteredCashbookPayments.length} transaction
            {filteredCashbookPayments.length === 1 ? "" : "s"} shown
          </span>
        }
        renderMobileCard={(payment) => (
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0 font-medium">{paymentStudent(payment)}</span>
              <span className="shrink-0 font-medium text-[var(--green)]">
                {formatCurrency(Number(payment.amount_paid))}
              </span>
            </div>
            <p className="text-xs text-[var(--t3)]">
              {formatDate(payment.payment_date)} · {paymentMethodLabel(payment.payment_method)}
            </p>
            {payment.payment_reference && (
              <p className="font-mono text-xs text-[var(--t3)]">{payment.payment_reference}</p>
            )}
          </div>
        )}
      />
    </>
  );
}

"use client";
import { useMemo } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { Button, DataTable, type DataColumn } from "@/components/ui/index";
import { PageSection } from "@/components/ui/PageHeader";
import { paymentMethodLabel } from "@/lib/constants";

interface PaymentData {
  id: string;
  student_id: string;
  amount_paid: number | string;
  payment_method: string;
  payment_reference?: string;
  payment_date: string;
}

interface StudentData {
  id: string;
  first_name: string;
  last_name: string;
}

interface FeePaymentHistoryProps {
  payments: PaymentData[];
  students: StudentData[];
  formatCurrency: (amount: number) => string;
  onDeletePayment: (id: string) => void;
  onRecordPayment: () => void;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export default function FeePaymentHistory({
  payments,
  students,
  formatCurrency,
  onDeletePayment,
  onRecordPayment,
}: FeePaymentHistoryProps) {
  const studentNames = useMemo(
    () => new Map(students.map((student) => [student.id, `${student.first_name} ${student.last_name}`])),
    [students],
  );
  const nameFor = (payment: PaymentData) => studentNames.get(payment.student_id) || "Unknown student";

  const total = payments.reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0);

  const columns: DataColumn<PaymentData>[] = [
    {
      key: "date",
      header: "Date",
      sortValue: (payment) => payment.payment_date,
      render: (payment) => <span className="whitespace-nowrap">{formatDate(payment.payment_date)}</span>,
    },
    {
      key: "student",
      header: "Student",
      sortValue: nameFor,
      render: (payment) => <span className="font-medium">{nameFor(payment)}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sortValue: (payment) => Number(payment.amount_paid),
      render: (payment) => (
        <span className="font-bold text-[var(--green)]">{formatCurrency(Number(payment.amount_paid))}</span>
      ),
    },
    {
      key: "method",
      header: "Method",
      sortValue: (payment) => paymentMethodLabel(payment.payment_method),
      render: (payment) => (
        <span className="rounded bg-[var(--surface-container)] px-2 py-1 text-xs font-bold text-[var(--t2)]">
          {paymentMethodLabel(payment.payment_method)}
        </span>
      ),
    },
    {
      key: "reference",
      header: "Reference",
      hideOnMobile: true,
      render: (payment) => (
        <span className="font-mono text-xs text-[var(--t3)]">{payment.payment_reference || "—"}</span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      hideOnMobile: true,
      render: (payment) => (
        <button
          onClick={() => onDeletePayment(payment.id)}
          aria-label={`Delete payment for ${nameFor(payment)}`}
          className="rounded-lg p-2 text-[var(--error)] hover:bg-[var(--error-container)]"
        >
          <MaterialIcon icon="delete" className="text-lg" />
        </button>
      ),
    },
  ];

  return (
    <PageSection className="mt-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-[var(--t1)]">Payments</h3>
          <p className="text-sm text-[var(--t3)]">Recent payment transactions</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onRecordPayment}>
          <MaterialIcon icon="add" />
          Add Payment
        </Button>
      </div>
      <DataTable
        columns={columns}
        rows={payments}
        getRowId={(payment) => payment.id}
        caption="Payment history"
        initialSort={{ key: "date", dir: "desc" }}
        empty={
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-12 text-center">
            <MaterialIcon className="mb-4 text-4xl text-[var(--t3)]/40">payments</MaterialIcon>
            <h3 className="mb-2 text-lg font-semibold text-[var(--t1)]">No payments recorded</h3>
            <p className="text-sm text-[var(--t3)]">Record the first payment to see it here</p>
          </div>
        }
        footer={
          <span className="text-[var(--t3)]">
            {payments.length} payment{payments.length === 1 ? "" : "s"} · {formatCurrency(total)}
          </span>
        }
        renderMobileCard={(payment) => (
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0 font-medium">{nameFor(payment)}</span>
              <span className="shrink-0 font-bold text-[var(--green)]">
                {formatCurrency(Number(payment.amount_paid))}
              </span>
            </div>
            <p className="text-xs text-[var(--t3)]">
              {formatDate(payment.payment_date)} · {paymentMethodLabel(payment.payment_method)}
            </p>
            {payment.payment_reference && (
              <p className="font-mono text-xs text-[var(--t3)]">{payment.payment_reference}</p>
            )}
            <button
              onClick={() => onDeletePayment(payment.id)}
              aria-label={`Delete payment for ${nameFor(payment)}`}
              className="pt-1 text-xs font-semibold text-[var(--error)]"
            >
              Delete
            </button>
          </div>
        )}
      />
    </PageSection>
  );
}

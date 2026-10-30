"use client";
import { useMemo } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { Button, DataTable, type DataColumn } from "@/components/ui/index";
import { PageSection } from "@/components/ui/PageHeader";
import { paymentMethodLabel } from "@/lib/constants";
import { describeWho, formatTimeOfDay } from "@/components/fees/FeeTable";

interface PaymentData {
  id: string;
  student_id: string;
  amount_paid: number | string;
  payment_method: string;
  payment_reference?: string;
  payment_date: string;
  created_at?: string | null;
  recorded_by?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
  paid_by?: string | null;
  notes?: string | null;
  fee_id?: string | null;
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
  recordedByName?: Map<string, string>;
  onEditPayment: (payment: PaymentData) => void;
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
  recordedByName,
  onEditPayment,
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
      key: "accountability",
      header: "Recorded",
      hideOnMobile: true,
      sortValue: (payment) => payment.created_at || "",
      render: (payment) => (
        <div className="min-w-[150px] text-xs text-[var(--t2)]">
          <div>
            {payment.created_at
              ? `${formatDate(payment.created_at)}${formatTimeOfDay(payment.created_at) ? ` · ${formatTimeOfDay(payment.created_at)}` : ""}`
              : "Time not recorded"}
          </div>
          <div className="text-[var(--t3)]">by {describeWho(payment.recorded_by, recordedByName)}</div>
          {payment.updated_at && (
            <div className="mt-1 text-[var(--t3)]">
              Edited {formatTimeOfDay(payment.updated_at) || formatDate(payment.updated_at)} ·{" "}
              {describeWho(payment.updated_by, recordedByName)}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      hideOnMobile: true,
      render: (payment) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onEditPayment(payment)}
            aria-label={`Edit payment for ${nameFor(payment)}`}
            title="Edit payment"
            className="rounded-lg p-2 text-[var(--primary)] hover:bg-[var(--primary)]/10"
          >
            <MaterialIcon icon="edit" className="text-lg" />
          </button>
          <button
            onClick={() => onDeletePayment(payment.id)}
            aria-label={`Delete payment for ${nameFor(payment)}`}
            title="Void payment"
            className="rounded-lg p-2 text-[var(--error)] hover:bg-[var(--error-container)]"
          >
            <MaterialIcon icon="delete" className="text-lg" />
          </button>
        </div>
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
            <p className="text-xs text-[var(--t3)]">
              Recorded{" "}
              {payment.created_at
                ? `${formatDate(payment.created_at)}${formatTimeOfDay(payment.created_at) ? ` · ${formatTimeOfDay(payment.created_at)}` : ""}`
                : "time not recorded"}{" "}
              by {describeWho(payment.recorded_by, recordedByName)}
            </p>
            {payment.updated_at && (
              <p className="text-xs text-[var(--t3)]">
                Edited {formatDate(payment.updated_at)}
                {formatTimeOfDay(payment.updated_at) ? ` · ${formatTimeOfDay(payment.updated_at)}` : ""} by{" "}
                {describeWho(payment.updated_by, recordedByName)}
              </p>
            )}
            {payment.payment_reference && (
              <p className="font-mono text-xs text-[var(--t3)]">{payment.payment_reference}</p>
            )}
            <div className="flex gap-4 pt-1">
              <button
                type="button"
                onClick={() => onEditPayment(payment)}
                className="text-xs font-semibold text-[var(--primary)]"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDeletePayment(payment.id)}
                aria-label={`Delete payment for ${nameFor(payment)}`}
                className="text-xs font-semibold text-[var(--error)]"
              >
                Void payment
              </button>
            </div>
          </div>
        )}
      />
    </PageSection>
  );
}

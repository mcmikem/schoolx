"use client";

import Link from "next/link";
import { useState } from "react";
import { NoData } from "@/components/EmptyState";
import { Button, DataTable, Input, Select, StatStrip, type DataColumn } from "@/components/ui/index";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth-context";
import { paymentMethodLabel } from "@/lib/constants";
import { formatCurrency } from "@/lib/currency";
import { useClasses, useFeePayments, useStudents } from "@/lib/hooks";
import type { FeePayment } from "@/types";

export default function FeeLedgerPage() {
  const { school } = useAuth();
  const [page, setPage] = useState(1);
  const { payments, loading, error, totalCount, refetch } = useFeePayments(school?.id, page, 50);
  const { students } = useStudents(school?.id);
  const { classes } = useClasses(school?.id);
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<FeePayment | null>(null);
  const studentFor = (payment: FeePayment) =>
    payment.students || students.find((student) => student.id === payment.student_id);
  const classNameFor = (payment: FeePayment) => {
    const student = studentFor(payment);
    return student?.classes?.name || classes.find((item) => item.id === student?.class_id)?.name || "No class";
  };
  const filtered = payments.filter((payment) => {
    const student = studentFor(payment);
    const className = classNameFor(payment);
    const query = search.trim().toLowerCase();
    return (
      (!classId || student?.class_id === classId) &&
      (!query ||
        `${student?.first_name || ""} ${student?.last_name || ""} ${student?.student_number || ""} ${className} ${payment.payment_reference || ""}`
          .toLowerCase()
          .includes(query))
    );
  });
  const total = filtered.reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0);
  const sumMethod = (method: string) =>
    filtered
      .filter((payment) => payment.payment_method === method)
      .reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / 50));

  const columns: DataColumn<FeePayment>[] = [
    {
      key: "date",
      header: "Date",
      sortValue: (payment) => payment.payment_date,
      render: (payment) => (
        <span className="whitespace-nowrap">{new Date(payment.payment_date).toLocaleDateString("en-GB")}</span>
      ),
    },
    {
      key: "student",
      header: "Student",
      sortValue: (payment) => {
        const student = studentFor(payment);
        return student ? `${student.first_name} ${student.last_name}` : "Unknown student";
      },
      render: (payment) => {
        const student = studentFor(payment);
        const name = student ? `${student.first_name} ${student.last_name}` : "Unknown student";
        return (
          <span className="font-medium">
            {name}
            <span className="block text-xs font-normal text-[var(--t3)]">{classNameFor(payment)}</span>
          </span>
        );
      },
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
      render: (payment) => (
        <span className="font-mono text-xs text-[var(--t3)]">{payment.payment_reference || "—"}</span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sortValue: (payment) => Number(payment.amount_paid),
      render: (payment) => (
        <span className="font-bold text-[var(--primary)]">{formatCurrency(Number(payment.amount_paid))}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6 min-w-0 p-4 sm:p-6 pb-24 sm:pb-6">
      <PageHeader
        title="Payment Ledger"
        subtitle="Review recorded receipts. Search and class filters apply to the current page."
        actions={
          <Link href="/dashboard/fees/" className="btn btn-primary">
            Record payment
          </Link>
        }
      />

      {/* Every figure here is scoped to the rows on screen, and says so — this
          page pages receipts, so a school-wide total would be a different
          number every page. */}
      <StatStrip
        variant="flat"
        columns={4}
        items={[
          { label: "Receipts shown", value: loading ? "—" : filtered.length },
          { label: "Amount shown", value: loading ? "—" : formatCurrency(total) },
          { label: "Cash", value: loading ? "—" : formatCurrency(sumMethod("cash")), tone: "positive" },
          {
            label: "Mobile Money",
            value: loading ? "—" : formatCurrency(sumMethod("mobile_money")),
            tone: "warning",
          },
        ]}
      />

      <div className="space-y-4">
        <div className="grid gap-3 border-b border-[var(--border)] pb-4 sm:grid-cols-2">
          <Input
            label="Search payments"
            placeholder="Student, class or reference…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select
            label="Class"
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
            options={[
              { value: "", label: "All classes" },
              ...classes.map((item) => ({ value: item.id, label: item.name })),
            ]}
          />
        </div>
        {error ? (
          <div role="alert" className="rounded-xl bg-[var(--error-container)] p-4">
            <p>{error}</p>
            <Button variant="ghost" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={filtered}
            getRowId={(payment) => payment.id}
            loading={loading}
            onRowClick={(payment) => setSelectedPayment(payment)}
            rowLabel={(payment) => {
              const student = studentFor(payment);
              return `Payment details for ${student ? `${student.first_name} ${student.last_name}` : "unknown student"}`;
            }}
            caption="Recorded fee receipts"
            initialSort={{ key: "date", dir: "desc" }}
            empty={
              <NoData
                title="No payments found"
                description={
                  search || classId
                    ? "Change the filters or check another page."
                    : "Recorded payments will appear here."
                }
              />
            }
            renderMobileCard={(payment) => {
              const student = studentFor(payment);
              const name = student ? `${student.first_name} ${student.last_name}` : "Unknown student";
              return (
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{name}</span>
                      <span className="block text-xs text-[var(--t3)]">{classNameFor(payment)}</span>
                    </span>
                    <span className="shrink-0 font-bold text-[var(--primary)]">
                      {formatCurrency(Number(payment.amount_paid))}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--t3)]">
                    {new Date(payment.payment_date).toLocaleDateString("en-GB")} ·{" "}
                    {paymentMethodLabel(payment.payment_method)}
                  </p>
                  {payment.payment_reference && (
                    <p className="font-mono text-xs text-[var(--t3)]">{payment.payment_reference}</p>
                  )}
                </div>
              );
            }}
            footer={
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-[var(--t3)]">
                  Page {page} of {totalPages} · {filtered.length} shown
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    disabled={page === 1 || loading}
                    onClick={() => setPage((previous) => previous - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((previous) => previous + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            }
          />
        )}
      </div>

      <Modal isOpen={Boolean(selectedPayment)} onClose={() => setSelectedPayment(null)} title="Payment Details">
        {selectedPayment && (
          <dl className="space-y-4">
            <div>
              <dt className="text-sm text-[var(--t3)]">Amount received</dt>
              <dd className="text-xl font-bold">{formatCurrency(Number(selectedPayment.amount_paid))}</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--t3)]">Method</dt>
              <dd>{paymentMethodLabel(selectedPayment.payment_method)}</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--t3)]">Reference</dt>
              <dd className="break-words">{selectedPayment.payment_reference || "No reference recorded"}</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--t3)]">Paid by</dt>
              <dd>{selectedPayment.paid_by || "Not recorded"}</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--t3)]">Notes</dt>
              <dd className="break-words">{selectedPayment.notes || "No notes"}</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--t3)]">Receipt ID</dt>
              <dd className="break-all text-sm">{selectedPayment.id}</dd>
            </div>
          </dl>
        )}
      </Modal>
    </div>
  );
}

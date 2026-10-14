"use client";

import Link from "next/link";
import { useState } from "react";
import { NoData } from "@/components/EmptyState";
import { Card, CardBody } from "@/components/ui/Card";
import { Button, Input, Select } from "@/components/ui/index";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/lib/auth-context";
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
  const filtered = payments.filter((payment) => {
    const student = studentFor(payment);
    const className = student?.classes?.name || classes.find((item) => item.id === student?.class_id)?.name || "";
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
  const totalPages = Math.max(1, Math.ceil(totalCount / 50));

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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <CardBody className="p-4">
            <p className="text-sm text-[var(--t3)]">Receipts shown</p>
            <p className="mt-1 text-2xl font-bold">{loading ? "—" : filtered.length}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <p className="text-sm text-[var(--t3)]">Amount shown</p>
            <p className="mt-1 text-2xl font-bold break-words">{loading ? "—" : formatCurrency(total)}</p>
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardBody className="space-y-5 p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
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
          ) : loading ? (
            <TableSkeleton rows={5} />
          ) : filtered.length === 0 ? (
            <NoData
              title="No payments found"
              description={
                search || classId ? "Change the filters or check another page." : "Recorded payments will appear here."
              }
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((payment) => {
                const student = studentFor(payment);
                const name = student ? `${student.first_name} ${student.last_name}` : "Unknown student";
                return (
                  <div
                    key={payment.id}
                    className="flex flex-col gap-3 rounded-xl border border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <h2 className="font-semibold break-words">{name}</h2>
                      <p className="mt-1 text-sm text-[var(--t3)]">
                        {new Date(payment.payment_date).toLocaleDateString("en-GB")} ·{" "}
                        {payment.payment_method.replace(/_/g, " ")}
                      </p>
                      <p className="mt-1 text-sm text-[var(--t3)]">
                        {student?.classes?.name ||
                          classes.find((item) => item.id === student?.class_id)?.name ||
                          "No class"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="mr-auto font-bold text-primary">
                        {formatCurrency(Number(payment.amount_paid))}
                      </span>
                      <Button
                        variant="ghost"
                        onClick={() => setSelectedPayment(payment)}
                        aria-label={`Payment details for ${name}`}
                      >
                        Details
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
            <p className="text-sm text-[var(--t3)]">
              Page {page} of {totalPages}
            </p>
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
        </CardBody>
      </Card>
      <Modal isOpen={Boolean(selectedPayment)} onClose={() => setSelectedPayment(null)} title="Payment Details">
        {selectedPayment && (
          <dl className="space-y-4">
            <div>
              <dt className="text-sm text-[var(--t3)]">Amount received</dt>
              <dd className="text-xl font-bold">{formatCurrency(Number(selectedPayment.amount_paid))}</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--t3)]">Method</dt>
              <dd>{selectedPayment.payment_method.replace(/_/g, " ")}</dd>
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

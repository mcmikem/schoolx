"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import SearchField from "@/components/ui/SearchField";
import { paymentMethodLabel } from "@/lib/constants";
import { formatCurrency } from "@/lib/currency";
import type { FeePayment, Student } from "@/types";

function isToday(value: string) {
  const date = new Date(value);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export default function BursarReceiptPanel({
  payments,
  students,
  loading,
  error,
  onRetry,
}: {
  payments: FeePayment[];
  students: Student[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<"recent" | "today">("recent");
  const rows = useMemo(() => {
    const studentMap = new Map(students.map((student) => [student.id, student]));
    const search = query.trim().toLowerCase();
    return [...payments]
      .sort((first, second) => new Date(second.payment_date).getTime() - new Date(first.payment_date).getTime())
      .map((payment) => {
        const student = payment.students || studentMap.get(payment.student_id);
        const name = student ? `${student.first_name || ""} ${student.last_name || ""}`.trim() : "Student unavailable";
        return { payment, student, name };
      })
      .filter(
        ({ payment, student, name }) =>
          (period !== "today" || isToday(payment.payment_date)) &&
          (!search ||
            `${name} ${student?.student_number || ""} ${student?.classes?.name || ""} ${payment.payment_reference || ""}`
              .toLowerCase()
              .includes(search)),
      );
  }, [payments, students, query, period]);

  return (
    <section aria-labelledby="bursar-receipts-title" className="min-w-0 border-t border-[var(--border)] pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="bursar-receipts-title" className="text-base font-bold text-[var(--t1)]">
          Recent receipts
        </h2>
        <Link
          href="/dashboard/fee-ledger"
          className="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-[var(--primary)]"
        >
          Full ledger
          <MaterialIcon icon="arrow_forward" className="text-base" />
        </Link>
      </div>
      <div
        className="mb-4 flex flex-wrap gap-1 rounded-xl bg-[var(--surface-container-low)] p-1"
        role="group"
        aria-label="Receipt period"
      >
        {(["recent", "today"] as const).map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={period === value}
            onClick={() => setPeriod(value)}
            className={`min-h-11 flex-1 rounded-lg px-3 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)] ${period === value ? "bg-[var(--surface)] text-[var(--primary)] shadow-sm" : "text-[var(--t3)] hover:text-[var(--t1)]"}`}
          >
            {value === "recent" ? "Latest receipts" : "Dated today"}
          </button>
        ))}
      </div>
      <SearchField
        label="Find a receipt"
        value={query}
        onChange={setQuery}
        placeholder="Student, class or reference…"
      />
      {error ? (
        <div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p>Receipts could not be loaded. Try again before relying on today&apos;s figures.</p>
          <button type="button" onClick={onRetry} className="mt-2 min-h-11 rounded-lg px-3 font-bold underline">
            Retry receipts
          </button>
        </div>
      ) : loading ? (
        <p role="status" className="py-10 text-center text-sm text-[var(--t3)]">
          Loading receipts…
        </p>
      ) : rows.length === 0 ? (
        <div role="status" className="py-10 text-center">
          <MaterialIcon icon="receipt_long" className="text-3xl text-[var(--t3)]" />
          <p className="mt-2 text-sm font-semibold text-[var(--t1)]">
            {query.trim()
              ? "No receipts match your search"
              : period === "today"
                ? "No receipts dated today"
                : "No receipts to show yet"}
          </p>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-[var(--t3)]">
            {query.trim()
              ? "Try a name, student number or payment reference."
              : "Only loaded records are shown. Check the full ledger before reconciling."}
          </p>
          {(query || period !== "recent") && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setPeriod("recent");
              }}
              className="mt-3 min-h-11 rounded-xl border border-[var(--border)] px-4 text-xs font-bold text-[var(--primary)]"
            >
              Reset receipt filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div
            className="mt-5 hidden grid-cols-[minmax(0,1fr)_100px_110px] gap-3 border-b border-[var(--border)] pb-2 text-xs font-semibold uppercase tracking-wider text-[var(--t3)] sm:grid"
            aria-hidden="true"
          >
            <span>Student / reference</span>
            <span>Method</span>
            <span className="text-right">Amount</span>
          </div>
          <ul aria-label="Loaded receipts" className="mt-2 divide-y divide-[var(--border)]">
            {rows.slice(0, 5).map(({ payment, student, name }) => (
              <li
                key={payment.id}
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_100px_110px] sm:gap-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--t1)]">{name}</p>
                  <p className="mt-1 truncate text-xs text-[var(--t3)]">
                    {student?.classes?.name || "Class unavailable"} ·{" "}
                    {new Date(payment.payment_date).toLocaleDateString("en-UG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  <p className="mt-1 break-all text-xs text-[var(--t3)]">
                    {payment.payment_reference || "No reference recorded"}
                  </p>
                </div>
                <span className="col-start-1 row-start-2 w-fit rounded-md bg-[var(--surface-container-low)] px-2 py-1 text-xs font-semibold text-[var(--t2)] sm:col-start-auto sm:row-start-auto">
                  {payment.payment_method ? paymentMethodLabel(payment.payment_method) : "Not specified"}
                </span>
                <p className="col-start-2 row-start-1 text-right text-xs font-bold tabular-nums text-[var(--green)] sm:col-start-auto sm:row-start-auto sm:text-sm">
                  {formatCurrency(Number(payment.amount_paid))}
                </p>
              </li>
            ))}
          </ul>
          <p role="status" className="border-t border-[var(--border)] pt-3 text-xs text-[var(--t3)]">
            Showing {Math.min(rows.length, 5)} of {rows.length} matching loaded receipts
          </p>
        </>
      )}
    </section>
  );
}

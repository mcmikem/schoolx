"use client";
import Link from "next/link";
import { useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import type { FeeDefaulter } from "@/lib/hooks";

function formatCurrency(amount: number) {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
  return `${amount}`;
}

/**
 * Head of the defaulter ranking produced by fee_summary(), not a client-side
 * pass over the roster. Ranking here used to sum the first 100 students
 * against the first 50 payments, so a school past either limit showed the
 * wrong debtors and a wrong total right underneath headline figures that are
 * now summed across the whole school.
 *
 * `debtorCount` / `totalBalance` cover every debtor; `defaulters` is just the
 * window this panel renders.
 */
export default function TopDefaulters({
  defaulters,
  debtorCount,
  totalBalance,
}: {
  defaulters: FeeDefaulter[];
  debtorCount: number;
  totalBalance: number;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (debtorCount === 0 || defaulters.length === 0) return null;

  const topDebtors = defaulters.slice(0, 5);

  return (
    <div className="rounded-[24px] bg-white border border-[var(--border)] p-5 mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between mb-2 focus:outline-none focus:ring-2 focus:ring-[var(--t1)] rounded"
        aria-expanded={isOpen}
        aria-controls="defaulters-list"
      >
        <div className="flex items-center gap-2">
          <h2 id="defaulters-heading" className="text-sm font-bold text-[var(--t1)]">
            Top defaulters ({debtorCount})
          </h2>
          <MaterialIcon icon={isOpen ? "expand_less" : "expand_more"} className="text-[var(--t3)] text-lg" />
        </div>
        <span className="text-xs font-bold text-[var(--red)] bg-[var(--red-soft)] px-2 py-0.5 rounded-full">
          UGX {formatCurrency(totalBalance)}
        </span>
      </button>

      {isOpen && (
        <div id="defaulters-list" className="space-y-2 mt-4" role="list" aria-labelledby="defaulters-heading">
          {topDebtors.map((student) => (
            <div
              key={student.student_id}
              role="listitem"
              className="flex items-center gap-3 rounded-[18px] bg-[var(--surface-container-low)] border border-[var(--border)] px-3 py-2.5"
            >
              <div
                className="h-9 w-9 rounded-full bg-[var(--red-soft)] flex items-center justify-center text-sm font-bold text-[var(--red)] shrink-0"
                aria-hidden="true"
              >
                {student.first_name?.[0] || ""}
                {student.last_name?.[0] || ""}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[var(--t1)] truncate">
                  {student.first_name} {student.last_name}
                </p>
                <p className="text-[10px] text-[var(--t3)]">
                  {student.parent_name} · {student.class_name || ""}
                </p>
              </div>
              <p className="text-sm font-bold text-[var(--red)]">-UGX {formatCurrency(student.balance)}</p>
              {student.parent_phone && (
                <div className="flex gap-1 shrink-0">
                  <a
                    href={`tel:${student.parent_phone}`}
                    aria-label={`Call parent of ${student.first_name}`}
                    className="rounded-lg bg-[var(--primary-50)] px-2 py-1.5 text-[var(--t2)] hover:bg-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--t1)]"
                  >
                    <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                      call
                    </span>
                  </a>
                  <a
                    href={`/dashboard/messages?to=${student.parent_phone}`}
                    aria-label={`Send SMS to parent of ${student.first_name}`}
                    className="rounded-lg bg-[var(--t1)] px-2 py-1.5 text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--t1)]"
                  >
                    <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                      sms
                    </span>
                  </a>
                </div>
              )}
            </div>
          ))}
          <div className="pt-2 text-center">
            <Link href="/dashboard/fees" className="card-action-pill">
              View all {debtorCount} debtors →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

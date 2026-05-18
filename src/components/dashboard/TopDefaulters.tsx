"use client";
import { useState } from "react";
import { Student, FeeStructure, FeePayment } from "@/types";
import MaterialIcon from "@/components/MaterialIcon";

function formatCurrency(amount: number) {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
  return `${amount}`;
}

export default function TopDefaulters({
  students,
  feeStructure,
  payments,
}: {
  students: any[];
  feeStructure: any[];
  payments: any[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Pre-calculate debtors
  const debtors = students
    .filter((s) => {
      const paid = payments
        .filter((p) => p.student_id === s.id)
        .reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
      const expected = feeStructure
        .filter((f) => !f.class_id || f.class_id === s.class_id)
        .reduce((sum, f) => sum + Number(f.amount || 0), 0);
      return paid < expected && expected > 0;
    })
    .map((s) => {
      const paid = payments
        .filter((p) => p.student_id === s.id)
        .reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
      const expected = feeStructure
        .filter((f) => !f.class_id || f.class_id === s.class_id)
        .reduce((sum, f) => sum + Number(f.amount || 0), 0);
      return { student: s, balance: expected - paid };
    })
    .sort((a, b) => b.balance - a.balance);

  if (debtors.length === 0) return null;

  const topDebtors = debtors.slice(0, 5);

  return (
    <div className="rounded-[20px] bg-white border border-[#e5ecf4] p-5 mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between mb-2 focus:outline-none focus:ring-2 focus:ring-[#17325f] rounded"
        aria-expanded={isOpen}
        aria-controls="defaulters-list"
      >
        <div className="flex items-center gap-2">
          <h2 id="defaulters-heading" className="text-sm font-bold text-[#17325f]">
            Top defaulters ({debtors.length})
          </h2>
          <MaterialIcon
            icon={isOpen ? "expand_less" : "expand_more"}
            className="text-[#7f91aa] text-lg"
          />
        </div>
        <span className="text-xs font-bold text-[#c2472b] bg-[#ffefe8] px-2 py-0.5 rounded-full">
          UGX {formatCurrency(debtors.reduce((sum, d) => sum + d.balance, 0))}
        </span>
      </button>

      {isOpen && (
        <div id="defaulters-list" className="space-y-2 mt-4" role="list" aria-labelledby="defaulters-heading">
          {topDebtors.map(({ student, balance }) => (
            <div
              key={student.id}
              role="listitem"
              className="flex items-center gap-3 rounded-[14px] bg-[#fcfcfd] border border-[#eaedf2] px-3 py-2.5"
            >
              <div
                className="h-9 w-9 rounded-full bg-[#ffefe8] flex items-center justify-center text-sm font-bold text-[#c2472b] shrink-0"
                aria-hidden="true"
              >
                {student.first_name?.[0] || ""}
                {student.last_name?.[0] || ""}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#17325f] truncate">
                  {student.first_name} {student.last_name}
                </p>
                <p className="text-[10px] text-[#7890ad]">
                  {student.parent_name} · {(student as any).classes?.name || ""}
                </p>
              </div>
              <p className="text-sm font-bold text-[#c2472b]">-UGX {formatCurrency(balance)}</p>
              {student.parent_phone && (
                <div className="flex gap-1 shrink-0">
                  <a
                    href={`tel:${student.parent_phone}`}
                    aria-label={`Call parent of ${student.first_name}`}
                    className="rounded-lg bg-[#eef4fb] px-2 py-1.5 text-[#42638d] hover:bg-[#dce8f5] focus:outline-none focus:ring-2 focus:ring-[#17325f]"
                  >
                    <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                      call
                    </span>
                  </a>
                  <a
                    href={`/dashboard/messages?to=${student.parent_phone}`}
                    aria-label={`Send SMS to parent of ${student.first_name}`}
                    className="rounded-lg bg-[#17325f] px-2 py-1.5 text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#17325f]"
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
            <a href="/dashboard/fees" className="text-xs font-bold text-[#42638d] hover:underline focus:outline-none focus:ring-2 focus:ring-[#17325f] rounded">
              View all {debtors.length} debtors →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";
import { useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";

function formatCurrency(amount: number) {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
  return `${amount}`;
}

export default function RecentPayments({
  payments,
  students,
  thisMonthTotal,
}: {
  payments: any[];
  students: any[];
  thisMonthTotal: number;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (payments.length === 0) return null;

  return (
    <div className="rounded-[20px] bg-white border border-[#e5ecf4] p-5 mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between mb-2 focus:outline-none focus:ring-2 focus:ring-[#17325f] rounded"
        aria-expanded={isOpen}
        aria-controls="recent-payments-list"
      >
        <div className="flex items-center gap-2">
          <h2 id="recent-payments-heading" className="text-sm font-bold text-[#17325f]">
            Recent payments
          </h2>
          <MaterialIcon
            icon={isOpen ? "expand_less" : "expand_more"}
            className="text-[#7f91aa] text-lg"
          />
        </div>
        <span className="text-xs font-bold text-[#1f8a70] bg-[#e1f3ee] px-2 py-0.5 rounded-full">
          +UGX {formatCurrency(thisMonthTotal)}
        </span>
      </button>

      {isOpen && (
        <div id="recent-payments-list" className="space-y-2 mt-4" role="list" aria-labelledby="recent-payments-heading">
          {payments.slice(0, 5).map((p: any) => {
            const student = students.find((s) => s.id === p.student_id);
            const method = p.payment_method || "Cash";
            const methodColor =
              method === "Cash"
                ? "bg-[#e1f3ee] text-[#1f8a70]"
                : method === "Mobile Money" || method === "mobile_money"
                  ? "bg-[#e0efff] text-[#2563eb]"
                  : "bg-[#eef1ff] text-[#5564d8]";

            return (
              <div
                key={p.id}
                role="listitem"
                className="flex items-center gap-3 rounded-[14px] bg-[#f6f9fc] px-3 py-2.5"
              >
                <div
                  className="h-8 w-8 rounded-lg bg-white border border-[#eaedf2] flex items-center justify-center text-xs font-bold text-[#17325f] shrink-0"
                  aria-hidden="true"
                >
                  {student
                    ? (student.first_name?.[0] || "") + (student.last_name?.[0] || "")
                    : "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#17325f] truncate">
                    {student ? `${student.first_name} ${student.last_name}` : "Unknown"}
                  </p>
                  <p className="text-[10px] text-[#7890ad]">
                    {new Date(p.payment_date).toLocaleDateString("en-UG", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${methodColor}`}>
                  {method === "mobile_money" ? "Mobile" : method}
                </span>
                <p className="text-sm font-bold text-[#1f8a70]">
                  UGX {formatCurrency(p.amount_paid || p.amount || 0)}
                </p>
              </div>
            );
          })}
          <div className="pt-2 text-center">
            <a href="/dashboard/fees" className="text-xs font-bold text-[#42638d] hover:underline focus:outline-none focus:ring-2 focus:ring-[#17325f] rounded">
              View all payments →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

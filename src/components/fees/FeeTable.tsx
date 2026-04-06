"use client";
import MaterialIcon from "@/components/MaterialIcon";

export interface StudentBalance {
  id: string;
  name: string;
  student_number: string;
  class_name: string;
  expected: number;
  paid: number;
  balance: number;
  status?: "paid" | "partial" | "unpaid" | "written_off";
  payments: Array<{
    id: string;
    amount: number;
    method: string;
    reference: string;
    date: string;
  }>;
  adjustments: Array<{
    id: string;
    adjustment_type: string;
    amount: number;
    description: string;
  }>;
}

interface FeeTableProps {
  balances: StudentBalance[];
  onViewReceipt: (student: StudentBalance) => void;
}

const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`;

function FeeProgressBar({
  percentage,
  amount,
  total,
}: {
  percentage: number;
  amount: number;
  total: number;
}) {
  const getBarColor = () => {
    if (percentage >= 100) return "bg-green-500";
    if (percentage >= 75) return "bg-green-500";
    if (percentage >= 50) return "bg-amber-500";
    if (percentage >= 25) return "bg-orange-500";
    return "bg-red-500";
  };

  const getBgColor = () => {
    if (percentage >= 100) return "bg-green-100";
    if (percentage >= 75) return "bg-green-50";
    if (percentage >= 50) return "bg-amber-50";
    if (percentage >= 25) return "bg-orange-50";
    return "bg-red-50";
  };

  const getTextColor = () => {
    if (percentage >= 100) return "text-green-600";
    if (percentage >= 75) return "text-green-600";
    if (percentage >= 50) return "text-amber-600";
    if (percentage >= 25) return "text-orange-600";
    return "text-red-600";
  };

  const shortFormat = (n: number) => {
    if (n >= 1000000) return `UGX ${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `UGX ${(n / 1000).toFixed(0)}K`;
    return `UGX ${n}`;
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-on-surface-variant">
          {shortFormat(amount)} / {shortFormat(total)}
        </span>
        <span className={`font-semibold ${getTextColor()}`}>
          {percentage >= 100 ? "✓ Paid" : `${Math.min(percentage, 99)}%`}
        </span>
      </div>
      <div className={`h-2 ${getBgColor()} rounded-full overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${getBarColor()}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

function getStatusBadge(status: string | undefined, percentage: number) {
  if (status === "written_off") {
    return (
      <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 text-xs font-bold uppercase">
        Written Off
      </span>
    );
  }
  if (percentage >= 100) {
    return (
      <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-bold">
        ✓ Paid
      </span>
    );
  }
  if (percentage === 0) {
    return (
      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-xs font-bold">
        Unpaid
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
      {Math.min(percentage, 99)}%
    </span>
  );
}

export default function FeeTable({ balances, onViewReceipt }: FeeTableProps) {
  return (
    <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-outline-variant/5">
      <div className="overflow-x-auto table-responsive">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface-container-low text-left">
              <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                Student
              </th>
              <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                Class
              </th>
              <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                Payment Progress
              </th>
              <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                Expected
              </th>
              <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                Paid
              </th>
              <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                Balance
              </th>
              <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">
                Status
              </th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/5">
            {balances.map((student) => {
              const total = student.expected || 0;
              const paid = student.paid || 0;
              const percentage =
                total > 0 ? Math.round((paid / total) * 100) : 0;

              return (
                <tr
                  key={student.id}
                  className="hover:bg-surface-bright transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="font-bold text-primary">{student.name}</div>
                    <div className="text-xs text-on-surface-variant">
                      {student.student_number}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-on-surface-variant">
                    {student.class_name}
                  </td>
                  <td className="px-6 py-4 min-w-[200px]">
                    <FeeProgressBar
                      percentage={percentage}
                      amount={paid}
                      total={total}
                    />
                  </td>
                  <td className="px-6 py-4 font-medium">
                    {formatCurrency(total)}
                  </td>
                  <td className="px-6 py-4 font-bold text-secondary">
                    {formatCurrency(paid)}
                  </td>
                  <td
                    className={`px-6 py-4 font-bold ${student.balance > 0 ? "text-error" : "text-secondary"}`}
                  >
                    {formatCurrency(student.balance)}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(student.status, percentage)}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => onViewReceipt(student)}
                      className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg"
                    >
                      <MaterialIcon icon="visibility" className="text-lg" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

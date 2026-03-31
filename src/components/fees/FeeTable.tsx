'use client'
import MaterialIcon from '@/components/MaterialIcon'

export interface StudentBalance {
  id: string
  name: string
  student_number: string
  class_name: string
  expected: number
  paid: number
  balance: number
  payments: Array<{
    id: string
    amount: number
    method: string
    reference: string
    date: string
  }>
}

interface FeeTableProps {
  balances: StudentBalance[]
  onViewReceipt: (student: StudentBalance) => void
}

const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`

export default function FeeTable({ balances, onViewReceipt }: FeeTableProps) {
  return (
    <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-outline-variant/5">
      <div className="overflow-x-auto table-responsive">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface-container-low text-left">
              <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Student</th>
              <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Class</th>
              <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Expected</th>
              <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Paid</th>
              <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Balance</th>
              <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Status</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/5">
            {balances.map((student) => (
              <tr key={student.id} className="hover:bg-surface-bright transition-colors">
                <td className="px-6 py-4">
                  <div className="font-bold text-primary">{student.name}</div>
                  <div className="text-xs text-on-surface-variant">{student.student_number}</div>
                </td>
                <td className="px-6 py-4 text-sm text-on-surface-variant">{student.class_name}</td>
                <td className="px-6 py-4 font-medium">{formatCurrency(student.expected)}</td>
                <td className="px-6 py-4 font-bold text-secondary">{formatCurrency(student.paid)}</td>
                <td className={`px-6 py-4 font-bold ${student.balance > 0 ? 'text-error' : 'text-secondary'}`}>{formatCurrency(student.balance)}</td>
                <td className="px-6 py-4">
                  {student.balance === 0 ? (
                    <span className="px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container text-xs font-bold uppercase">Paid</span>
                  ) : student.paid > 0 ? (
                    <span className="px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-xs font-bold uppercase">Partial</span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-error-container text-on-error-container text-xs font-bold uppercase">Not Paid</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <button onClick={() => onViewReceipt(student)} className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg">
                    <MaterialIcon icon="visibility" className="text-lg" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

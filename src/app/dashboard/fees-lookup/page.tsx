'use client'
import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useStudents, useFeePayments, useFeeStructure } from '@/lib/hooks'
import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'

export default function FeesLookupPage() {
  const { school } = useAuth()
  const { students, loading: studentsLoading } = useStudents(school?.id)
  const { payments } = useFeePayments(school?.id)
  const { feeStructure } = useFeeStructure(school?.id)
  const [searchTerm, setSearchTerm] = useState('')

  const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`

  const totalFees = useMemo(() => {
    return feeStructure.reduce((sum, f) => sum + Number(f.amount || 0), 0)
  }, [feeStructure])

  const results = useMemo(() => {
    if (!searchTerm.trim()) return []
    const term = searchTerm.toLowerCase()
    return students
      .filter(s => {
        const name = `${s.first_name} ${s.last_name}`.toLowerCase()
        const number = (s.student_number || '').toLowerCase()
        return name.includes(term) || number.includes(term)
      })
      .slice(0, 20)
      .map(student => {
        const studentPayments = payments.filter(p => p.student_id === student.id)
        const paid = studentPayments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)
        return {
          id: student.id,
          name: `${student.first_name} ${student.last_name}`,
          student_number: student.student_number || '',
          class_name: student.classes?.name || '',
          total: totalFees,
          paid,
          balance: Math.max(0, totalFees - paid),
        }
      })
  }, [students, payments, searchTerm, totalFees])

  const loading = studentsLoading

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Fee Balance Lookup"
        subtitle="Search student fee balances (read-only)"
      />

      <Card className="p-6 mb-6">
        <div className="relative">
          <MaterialIcon icon="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--t3)]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[var(--surface-container)] border border-[var(--border)] rounded-xl py-4 pl-12 pr-4 text-base focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
            placeholder="Search by student name or number..."
            autoFocus
          />
        </div>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-6">
              <div className="w-1/2 h-5 bg-[var(--surface-container)] rounded mb-3" />
              <div className="w-1/3 h-4 bg-[var(--surface-container)] rounded" />
            </Card>
          ))}
        </div>
      ) : searchTerm.trim() && results.length === 0 ? (
        <Card className="p-12 text-center">
          <MaterialIcon icon="search_off" className="text-4xl text-[var(--t3)] mb-3" />
          <h3 className="text-lg font-semibold text-[var(--t1)] mb-1">No students found</h3>
          <p className="text-[var(--t3)]">Try a different name or student number</p>
        </Card>
      ) : !searchTerm.trim() ? (
        <Card className="p-12 text-center">
          <MaterialIcon icon="account_balance_wallet" className="text-4xl text-[var(--t3)] mb-3" />
          <h3 className="text-lg font-semibold text-[var(--t1)] mb-1">Look Up Fee Balance</h3>
          <p className="text-[var(--t3)]">Type a student name or number above to view their fee balance</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {results.map((student) => (
            <Card key={student.id} className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-[var(--primary)] rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-[var(--t1)] text-lg">{student.name}</h3>
                      <p className="text-sm text-[var(--t3)]">{student.student_number} &middot; {student.class_name}</p>
                    </div>
                  </div>
                </div>
                <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${
                  student.balance === 0
                    ? 'bg-green-100 text-green-700'
                    : student.paid > 0
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {student.balance === 0 ? 'Cleared' : student.paid > 0 ? 'Partial' : 'Not Paid'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-[var(--border)]">
                <div className="text-center">
                  <div className="text-xs text-[var(--t3)] uppercase tracking-wider font-medium mb-1">Total Fees</div>
                  <div className="font-bold text-[var(--t1)]">{formatCurrency(student.total)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-[var(--t3)] uppercase tracking-wider font-medium mb-1">Paid</div>
                  <div className="font-bold text-green-600">{formatCurrency(student.paid)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-[var(--t3)] uppercase tracking-wider font-medium mb-1">Balance</div>
                  <div className={`font-bold ${student.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(student.balance)}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'
import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useStudents, useFeePayments, useFeeStructure } from '@/lib/hooks'
import MaterialIcon from '@/components/MaterialIcon'

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Fee Balance Lookup</h1>
        <p className="text-[#5c6670] mt-1">Search student fee balances (read-only)</p>
      </div>

      <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 mb-6">
        <div className="relative">
          <MaterialIcon icon="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5c6670]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#f8fafb] border border-[#e8eaed] rounded-xl py-4 pl-12 pr-4 text-base focus:outline-none focus:ring-2 focus:ring-[#002045]/20 focus:border-[#002045]"
            placeholder="Search by student name or number..."
            autoFocus
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-[#e8eaed] p-6">
              <div className="w-1/2 h-5 bg-[#e8eaed] rounded mb-3" />
              <div className="w-1/3 h-4 bg-[#e8eaed] rounded" />
            </div>
          ))}
        </div>
      ) : searchTerm.trim() && results.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-12 text-center">
          <MaterialIcon icon="search_off" className="text-4xl text-[#5c6670] mb-3" />
          <h3 className="text-lg font-semibold text-[#191c1d] mb-1">No students found</h3>
          <p className="text-[#5c6670]">Try a different name or student number</p>
        </div>
      ) : !searchTerm.trim() ? (
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-12 text-center">
          <MaterialIcon icon="account_balance_wallet" className="text-4xl text-[#5c6670] mb-3" />
          <h3 className="text-lg font-semibold text-[#191c1d] mb-1">Look Up Fee Balance</h3>
          <p className="text-[#5c6670]">Type a student name or number above to view their fee balance</p>
        </div>
      ) : (
        <div className="space-y-4">
          {results.map((student) => (
            <div key={student.id} className="bg-white rounded-2xl border border-[#e8eaed] p-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-[#002045] rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-[#191c1d] text-lg">{student.name}</h3>
                      <p className="text-sm text-[#5c6670]">{student.student_number} &middot; {student.class_name}</p>
                    </div>
                  </div>
                </div>
                <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${
                  student.balance === 0
                    ? 'bg-[#e8f5e9] text-[#006e1c]'
                    : student.paid > 0
                    ? 'bg-[#fff3e0] text-[#b86e00]'
                    : 'bg-[#ffebee] text-[#c62828]'
                }`}>
                  {student.balance === 0 ? 'Cleared' : student.paid > 0 ? 'Partial' : 'Not Paid'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-[#e8eaed]">
                <div className="text-center">
                  <div className="text-xs text-[#5c6670] uppercase tracking-wider font-medium mb-1">Total Fees</div>
                  <div className="font-bold text-[#191c1d]">{formatCurrency(student.total)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-[#5c6670] uppercase tracking-wider font-medium mb-1">Paid</div>
                  <div className="font-bold text-[#006e1c]">{formatCurrency(student.paid)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-[#5c6670] uppercase tracking-wider font-medium mb-1">Balance</div>
                  <div className={`font-bold ${student.balance > 0 ? 'text-[#c62828]' : 'text-[#006e1c]'}`}>
                    {formatCurrency(student.balance)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

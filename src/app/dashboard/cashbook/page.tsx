'use client'
import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useFeePayments } from '@/lib/hooks'
import MaterialIcon from '@/components/MaterialIcon'

export default function CashbookPage() {
  const { school } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const { payments } = useFeePayments(school?.id)
  const [dateFilter, setDateFilter] = useState('today')

  const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`

  const filteredPayments = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return payments.filter(p => {
      const paymentDate = new Date(p.payment_date)
      paymentDate.setHours(0, 0, 0, 0)

      if (dateFilter === 'today') {
        return paymentDate.getTime() === today.getTime()
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(today)
        weekAgo.setDate(weekAgo.getDate() - 7)
        return paymentDate >= weekAgo
      } else if (dateFilter === 'month') {
        return paymentDate.getMonth() === today.getMonth() && 
               paymentDate.getFullYear() === today.getFullYear()
      }
      return true
    })
  }, [payments, dateFilter])

  const summary = useMemo(() => {
    const cash = filteredPayments.filter(p => p.payment_method === 'cash')
    const momo = filteredPayments.filter(p => p.payment_method === 'mobile_money')
    const bank = filteredPayments.filter(p => p.payment_method === 'bank')

    return {
      total: filteredPayments.reduce((sum, p) => sum + Number(p.amount_paid), 0),
      cash: cash.reduce((sum, p) => sum + Number(p.amount_paid), 0),
      momo: momo.reduce((sum, p) => sum + Number(p.amount_paid), 0),
      bank: bank.reduce((sum, p) => sum + Number(p.amount_paid), 0),
      count: filteredPayments.length,
    }
  }, [filteredPayments])

  const exportCSV = () => {
    const headers = ['Date', 'Student', 'Amount', 'Method', 'Reference']
    const rows = filteredPayments.map(p => [
      p.payment_date,
      `${(p as any).students?.first_name || ''} ${(p as any).students?.last_name || ''}`,
      p.amount_paid,
      p.payment_method,
      p.payment_reference || '',
    ])

    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cashbook_${dateFilter}.csv`
    a.click()
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Cashbook</h1>
        <p className="text-[#5c6670] mt-1">Daily payment summary for bursars</p>
      </div>

      {/* Date Filter */}
      <div className="flex gap-3 mb-6">
        <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="input sm:w-40">
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
        <button onClick={exportCSV} className="btn btn-secondary">
          <MaterialIcon icon="download" />
          Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
          <div className="stat-value">{formatCurrency(summary.total)}</div>
          <div className="stat-label">Total Collected</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
          <div className="stat-value text-green-600">{formatCurrency(summary.cash)}</div>
          <div className="stat-label">Cash</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
          <div className="stat-value text-yellow-600">{formatCurrency(summary.momo)}</div>
          <div className="stat-label">Mobile Money</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
          <div className="stat-value text-blue-600">{formatCurrency(summary.bank)}</div>
          <div className="stat-label">Bank</div>
        </div>
      </div>

      {/* Transactions */}
      <div className="table-wrapper">
        <table className="table">
          <thead className="bg-[#f8fafb]">
            <tr>
              <th>Date</th>
              <th>Student</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Reference</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-500">No transactions found</td>
              </tr>
            ) : (
              filteredPayments.map((payment) => (
                <tr key={payment.id}>
                  <td>{new Date(payment.payment_date).toLocaleDateString()}</td>
                  <td className="font-medium">{(payment as any).students?.first_name} {(payment as any).students?.last_name}</td>
                  <td className="text-green-600 font-medium">{formatCurrency(Number(payment.amount_paid))}</td>
                  <td>
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#e3f2fd] text-[#1565c0]">
                      {payment.payment_method === 'mobile_money' ? 'MoMo' :
                       payment.payment_method === 'cash' ? 'Cash' :
                       payment.payment_method === 'bank' ? 'Bank' : 'Other'}
                    </span>
                  </td>
                  <td className="text-gray-500">{payment.payment_reference || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

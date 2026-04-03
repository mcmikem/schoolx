'use client'
import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useFeePayments } from '@/lib/hooks'
import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/index'
import { EmptyState } from '@/components/EmptyState'

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
      `${(p as { students?: { first_name?: string; last_name?: string } }).students?.first_name || ''} ${(p as { students?: { first_name?: string; last_name?: string } }).students?.last_name || ''}`,
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
      <PageHeader
        title="Cashbook"
        subtitle="Daily payment summary for bursars"
        actions={
          <>
            <select 
              value={dateFilter} 
              onChange={(e) => setDateFilter(e.target.value)} 
              className="px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 sm:w-40"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
            <Button variant="secondary" onClick={exportCSV}>
              <MaterialIcon icon="download" />
              Export CSV
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardBody>
            <div className="text-xl font-bold text-[var(--t1)]">{formatCurrency(summary.total)}</div>
            <div className="text-sm text-[var(--t3)]">Total Collected</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xl font-bold text-[var(--green)]">{formatCurrency(summary.cash)}</div>
            <div className="text-sm text-[var(--t3)]">Cash</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xl font-bold text-[var(--amber)]">{formatCurrency(summary.momo)}</div>
            <div className="text-sm text-[var(--t3)]">Mobile Money</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xl font-bold text-[var(--navy)]">{formatCurrency(summary.bank)}</div>
            <div className="text-sm text-[var(--t3)]">Bank</div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--surface-container)]">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--t2)]">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--t2)]">Student</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-[var(--t2)]">Amount</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-[var(--t2)]">Method</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--t2)]">Reference</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      icon="receipt_long"
                      title="No transactions found"
                      description="There are no payments recorded for the selected period"
                    />
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr key={payment.id} className="border-b border-[var(--border)]">
                    <td className="px-4 py-3 text-[var(--t1)]">{new Date(payment.payment_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-[var(--t1)]">{(payment as { students?: { first_name?: string; last_name?: string } }).students?.first_name} {(payment as { students?: { first_name?: string; last_name?: string } }).students?.last_name}</td>
                    <td className="px-4 py-3 text-right text-[var(--green)] font-medium">{formatCurrency(Number(payment.amount_paid))}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--navy-soft)] text-[var(--navy)]">
                        {payment.payment_method === 'mobile_money' ? 'MoMo' :
                         payment.payment_method === 'cash' ? 'Cash' :
                         payment.payment_method === 'bank' ? 'Bank' : 'Other'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--t3)]">{payment.payment_reference || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
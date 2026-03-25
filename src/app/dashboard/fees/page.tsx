'use client'
import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useStudents, useFeePayments, useFeeStructure, useClasses } from '@/lib/hooks'
import { useToast } from '@/components/Toast'

export default function FeesPage() {
  const { school } = useAuth()
  const toast = useToast()
  const { students } = useStudents(school?.id)
  const { classes } = useClasses(school?.id)
  const { payments, loading: paymentsLoading, createPayment, deletePayment } = useFeePayments(school?.id)
  const { feeStructure, loading: structureLoading } = useFeeStructure(school?.id)
  const [tab, setTab] = useState<'payments' | 'structure'>('payments')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedClass, setSelectedClass] = useState('all')
  const [saving, setSaving] = useState(false)
  const [newPayment, setNewPayment] = useState({
    student_id: '',
    amount_paid: '',
    payment_method: 'cash' as 'cash' | 'mobile_money' | 'bank' | 'installment',
    payment_reference: '',
    paid_by: '',
    notes: '',
  })

  const totalCollected = useMemo(() => {
    return payments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)
  }, [payments])

  const totalExpected = useMemo(() => {
    return feeStructure.reduce((sum, f) => sum + Number(f.amount || 0), 0) * Math.max(students.length, 1)
  }, [feeStructure, students])

  const formatCurrency = (amount: number) => {
    return `UGX ${amount.toLocaleString()}`
  }

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (selectedClass === 'all') return true
      return p.students?.class_id === selectedClass
    })
  }, [payments, selectedClass])

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      await createPayment({
        student_id: newPayment.student_id,
        amount_paid: Number(newPayment.amount_paid),
        payment_method: newPayment.payment_method,
        payment_reference: newPayment.payment_reference || undefined,
        paid_by: newPayment.paid_by || undefined,
        notes: newPayment.notes || undefined,
      })
      toast.success('Payment recorded')
      setShowPaymentModal(false)
      setNewPayment({ student_id: '', amount_paid: '', payment_method: 'cash', payment_reference: '', paid_by: '', notes: '' })
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to record payment'
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePayment = async (id: string) => {
    if (!confirm('Delete this payment record?')) return
    try {
      await deletePayment(id)
      toast.success('Payment deleted')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete'
      toast.error(errorMessage)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fees</h1>
          <p className="text-gray-500 mt-1">Track payments and fee structure</p>
        </div>
        <button onClick={() => setShowPaymentModal(true)} className="btn btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Record Payment
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-value text-green-600">{formatCurrency(totalCollected)}</div>
          <div className="stat-label">Total Collected</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatCurrency(totalExpected)}</div>
          <div className="stat-label">Expected Revenue</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-red-600">{formatCurrency(Math.max(0, totalExpected - totalCollected))}</div>
          <div className="stat-label">Outstanding Balance</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 mb-6">
        <div className="tabs">
          <button
            onClick={() => setTab('payments')}
            className={`tab ${tab === 'payments' ? 'active' : ''}`}
          >
            Payments
          </button>
          <button
            onClick={() => setTab('structure')}
            className={`tab ${tab === 'structure' ? 'active' : ''}`}
          >
            Fee Structure
          </button>
        </div>
        {tab === 'payments' && (
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="input w-40 ml-auto"
          >
            <option value="all">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Content */}
      {tab === 'payments' ? (
        paymentsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card">
                <div className="skeleton w-full h-6 mb-2" />
                <div className="skeleton w-3/4 h-4" />
              </div>
            ))}
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No payments recorded</h3>
            <p className="text-gray-500 mb-4">Record your first payment to get started</p>
            <button onClick={() => setShowPaymentModal(true)} className="btn btn-primary">
              Record Payment
            </button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="font-medium">
                      {payment.students?.first_name} {payment.students?.last_name}
                    </td>
                    <td className="text-gray-600">{payment.students?.classes?.name || '-'}</td>
                    <td className="font-medium text-green-600">{formatCurrency(Number(payment.amount_paid))}</td>
                    <td>
                      <span className="badge badge-info">
                        {payment.payment_method === 'mobile_money' ? 'Mobile Money' :
                         payment.payment_method === 'cash' ? 'Cash' :
                         payment.payment_method === 'bank' ? 'Bank' : 'Installment'}
                      </span>
                    </td>
                    <td className="text-gray-600">
                      {new Date(payment.payment_date).toLocaleDateString()}
                    </td>
                    <td>
                      <button
                        onClick={() => handleDeletePayment(payment.id)}
                        className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        structureLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="card">
                <div className="skeleton w-full h-6 mb-2" />
                <div className="skeleton w-1/2 h-4" />
              </div>
            ))}
          </div>
        ) : feeStructure.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No fee structure set</h3>
            <p className="text-gray-500">Set up your fee structure in Settings</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Fee Name</th>
                  <th>Class</th>
                  <th>Amount</th>
                  <th>Term</th>
                  <th>Year</th>
                </tr>
              </thead>
              <tbody>
                {feeStructure.map((fee) => (
                  <tr key={fee.id}>
                    <td className="font-medium">{fee.name}</td>
                    <td className="text-gray-600">{fee.classes?.name || 'All Classes'}</td>
                    <td className="font-medium">{formatCurrency(Number(fee.amount))}</td>
                    <td className="text-gray-600">Term {fee.term}</td>
                    <td className="text-gray-600">{fee.academic_year}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Record Payment</h2>
                <button onClick={() => setShowPaymentModal(false)} className="p-2 text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <form onSubmit={handleCreatePayment} className="p-6 space-y-4">
              <div>
                <label className="label">Student</label>
                <select
                  value={newPayment.student_id}
                  onChange={(e) => setNewPayment({ ...newPayment, student_id: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">Select student</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Amount (UGX)</label>
                  <input
                    type="number"
                    placeholder="50000"
                    value={newPayment.amount_paid}
                    onChange={(e) => setNewPayment({ ...newPayment, amount_paid: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">Payment Method</label>
                  <select
                    value={newPayment.payment_method}
                    onChange={(e) => setNewPayment({ ...newPayment, payment_method: e.target.value as any })}
                    className="input"
                  >
                    <option value="cash">Cash</option>
                    <option value="mobile_money">Mobile Money</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="installment">Installment</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Reference Number (Optional)</label>
                <input
                  type="text"
                  placeholder="Transaction ID or receipt number"
                  value={newPayment.payment_reference}
                  onChange={(e) => setNewPayment({ ...newPayment, payment_reference: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Paid By (Optional)</label>
                <input
                  type="text"
                  placeholder="Name of person who paid"
                  value={newPayment.paid_by}
                  onChange={(e) => setNewPayment({ ...newPayment, paid_by: e.target.value })}
                  className="input"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary flex-1">
                  {saving ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

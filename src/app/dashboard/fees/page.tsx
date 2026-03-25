'use client'
import { useState, useMemo, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useStudents, useFeePayments, useFeeStructure, useClasses } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

interface StudentBalance {
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

export default function FeesPage() {
  const { school } = useAuth()
  const toast = useToast()
  const { students } = useStudents(school?.id)
  const { classes } = useClasses(school?.id)
  const { payments, loading: paymentsLoading, createPayment, deletePayment } = useFeePayments(school?.id)
  const { feeStructure, loading: structureLoading } = useFeeStructure(school?.id)
  const receiptRef = useRef<HTMLDivElement>(null)
  
  const [tab, setTab] = useState<'balances' | 'payments' | 'momo' | 'structure'>('balances')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<StudentBalance | null>(null)
  const [selectedClass, setSelectedClass] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [saving, setSaving] = useState(false)
  const [newPayment, setNewPayment] = useState({
    student_id: '',
    amount_paid: '',
    payment_method: 'cash' as 'cash' | 'mobile_money' | 'bank' | 'installment',
    payment_reference: '',
    momo_provider: 'mtn' as 'mtn' | 'airtel',
    momo_transaction_id: '',
    paid_by: '',
    notes: '',
  })

  const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`

  // Calculate student balances
  const studentBalances: StudentBalance[] = useMemo(() => {
    const totalExpected = feeStructure.reduce((sum, f) => sum + Number(f.amount || 0), 0)
    
    return students.map(student => {
      const studentPayments = payments.filter(p => p.student_id === student.id)
      const paid = studentPayments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)
      
      return {
        id: student.id,
        name: `${student.first_name} ${student.last_name}`,
        student_number: student.student_number || '',
        class_name: student.classes?.name || '',
        expected: totalExpected,
        paid,
        balance: Math.max(0, totalExpected - paid),
        payments: studentPayments.map(p => ({
          id: p.id,
          amount: Number(p.amount_paid),
          method: p.payment_method,
          reference: p.payment_reference || '',
          date: p.payment_date,
        }))
      }
    })
  }, [students, payments, feeStructure])

  // Filter balances
  const filteredBalances = useMemo(() => {
    return studentBalances.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           s.student_number.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesClass = selectedClass === 'all' || s.class_name === selectedClass
      return matchesSearch && matchesClass
    }).sort((a, b) => b.balance - a.balance) // Sort by highest balance first
  }, [studentBalances, searchTerm, selectedClass])

  // Summary stats
  const stats = useMemo(() => {
    const totalExpected = studentBalances.reduce((sum, s) => sum + s.expected, 0)
    const totalPaid = studentBalances.reduce((sum, s) => sum + s.paid, 0)
    const totalBalance = studentBalances.reduce((sum, s) => sum + s.balance, 0)
    const fullyPaid = studentBalances.filter(s => s.balance === 0).length
    const partialPaid = studentBalances.filter(s => s.paid > 0 && s.balance > 0).length
    const notPaid = studentBalances.filter(s => s.paid === 0).length
    
    const momoPayments = payments.filter(p => p.payment_method === 'mobile_money')
    const momoTotal = momoPayments.reduce((sum, p) => sum + Number(p.amount_paid), 0)
    const cashTotal = payments.filter(p => p.payment_method === 'cash').reduce((sum, p) => sum + Number(p.amount_paid), 0)
    const bankTotal = payments.filter(p => p.payment_method === 'bank').reduce((sum, p) => sum + Number(p.amount_paid), 0)
    
    return { totalExpected, totalPaid, totalBalance, fullyPaid, partialPaid, notPaid, momoTotal, cashTotal, bankTotal }
  }, [studentBalances, payments])

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPayment.student_id || !newPayment.amount_paid) {
      toast.error('Please fill all required fields')
      return
    }

    try {
      setSaving(true)
      
      let reference = newPayment.payment_reference
      if (newPayment.payment_method === 'mobile_money' && newPayment.momo_transaction_id) {
        reference = `${newPayment.momo_provider.toUpperCase()}-${newPayment.momo_transaction_id}`
      }

      await createPayment({
        student_id: newPayment.student_id,
        amount_paid: Number(newPayment.amount_paid),
        payment_method: newPayment.payment_method,
        payment_reference: reference || undefined,
        paid_by: newPayment.paid_by || undefined,
        notes: newPayment.notes || undefined,
      })

      // Find student for receipt
      const student = studentBalances.find(s => s.id === newPayment.student_id)
      if (student) {
        setSelectedStudent({
          ...student,
          paid: student.paid + Number(newPayment.amount_paid),
          balance: Math.max(0, student.balance - Number(newPayment.amount_paid)),
        })
        setShowReceiptModal(true)
      }

      toast.success('Payment recorded successfully')
      setShowPaymentModal(false)
      setNewPayment({
        student_id: '', amount_paid: '', payment_method: 'cash', payment_reference: '',
        momo_provider: 'mtn', momo_transaction_id: '', paid_by: '', notes: '',
      })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to record payment')
    } finally {
      setSaving(false)
    }
  }

  const handlePrintReceipt = () => {
    if (receiptRef.current) {
      const printContent = receiptRef.current.innerHTML
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(`
          <html><head><title>Fee Receipt</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #1e40af; padding-bottom: 10px; margin-bottom: 15px; }
            .school-name { font-size: 18px; font-weight: bold; color: #1e40af; }
            .receipt-title { font-size: 14px; color: #666; margin-top: 5px; }
            .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #ddd; }
            .label { color: #666; font-size: 13px; }
            .value { font-weight: bold; font-size: 13px; }
            .total { font-size: 16px; border-top: 2px solid #1e40af; margin-top: 10px; padding-top: 10px; }
            .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #999; }
          </style></head><body>${printContent}</body></html>
        `)
        printWindow.document.close()
        printWindow.print()
      }
    }
  }

  const sendBalanceSMS = async (student: StudentBalance) => {
    if (student.balance <= 0) {
      toast.error('Student has no outstanding balance')
      return
    }

    try {
      const studentData = students.find(s => s.id === student.id)
      if (!studentData?.parent_phone) {
        toast.error('No parent phone number on record')
        return
      }

      const message = `Dear Parent, ${student.name} (${student.student_number}) has a fee balance of ${formatCurrency(student.balance)}. Total paid: ${formatCurrency(student.paid)} of ${formatCurrency(student.expected)}. Please clear the balance. Thank you.`

      const response = await fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: studentData.parent_phone,
          message,
          schoolId: school?.id,
        })
      })

      if (response.ok) {
        toast.success('Balance reminder sent to parent')
      } else {
        toast.error('Failed to send SMS')
      }
    } catch {
      toast.error('Failed to send SMS')
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fee Management</h1>
          <p className="text-gray-500 mt-1">Track payments, balances, and mobile money</p>
        </div>
        <button onClick={() => setShowPaymentModal(true)} className="btn btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Record Payment
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-value text-green-600">{formatCurrency(stats.totalPaid)}</div>
          <div className="stat-label">Total Collected</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-red-600">{formatCurrency(stats.totalBalance)}</div>
          <div className="stat-label">Outstanding Balance</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.fullyPaid}</div>
          <div className="stat-label">Fully Paid</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.partialPaid}</div>
          <div className="stat-label">Partial Payments</div>
        </div>
      </div>

      {/* Payment Method Breakdown */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card bg-green-50 border-green-100">
          <div className="text-sm text-green-700 font-medium">Mobile Money</div>
          <div className="text-xl font-bold text-green-800">{formatCurrency(stats.momoTotal)}</div>
        </div>
        <div className="card bg-blue-50 border-blue-100">
          <div className="text-sm text-blue-700 font-medium">Cash</div>
          <div className="text-xl font-bold text-blue-800">{formatCurrency(stats.cashTotal)}</div>
        </div>
        <div className="card bg-purple-50 border-purple-100">
          <div className="text-sm text-purple-700 font-medium">Bank Transfer</div>
          <div className="text-xl font-bold text-purple-800">{formatCurrency(stats.bankTotal)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="tabs">
          <button onClick={() => setTab('balances')} className={`tab ${tab === 'balances' ? 'active' : ''}`}>
            Student Balances
          </button>
          <button onClick={() => setTab('payments')} className={`tab ${tab === 'payments' ? 'active' : ''}`}>
            All Payments
          </button>
          <button onClick={() => setTab('momo')} className={`tab ${tab === 'momo' ? 'active' : ''}`}>
            Mobile Money
          </button>
          <button onClick={() => setTab('structure')} className={`tab ${tab === 'structure' ? 'active' : ''}`}>
            Fee Structure
          </button>
        </div>
      </div>

      {/* Filters */}
      {(tab === 'balances' || tab === 'payments') && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Search by name or student number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input flex-1"
          />
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input sm:w-48">
            <option value="all">All Classes</option>
            {classes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      )}

      {/* Content */}
      {tab === 'balances' && (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th>Expected</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBalances.map((student) => (
                <tr key={student.id}>
                  <td>
                    <div className="font-medium">{student.name}</div>
                    <div className="text-xs text-gray-500">{student.student_number}</div>
                  </td>
                  <td className="text-gray-600">{student.class_name}</td>
                  <td>{formatCurrency(student.expected)}</td>
                  <td className="text-green-600 font-medium">{formatCurrency(student.paid)}</td>
                  <td className={`font-medium ${student.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(student.balance)}
                  </td>
                  <td>
                    {student.balance === 0 ? (
                      <span className="badge badge-success">Paid</span>
                    ) : student.paid > 0 ? (
                      <span className="badge badge-warning">Partial</span>
                    ) : (
                      <span className="badge badge-danger">Not Paid</span>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      {student.balance > 0 && (
                        <button
                          onClick={() => sendBalanceSMS(student)}
                          className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                          title="Send balance reminder"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedStudent(student)
                          setShowReceiptModal(true)
                        }}
                        className="p-2 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50"
                        title="View receipt"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'momo' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Mobile Money Transactions</h3>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Student</th>
                    <th>Amount</th>
                    <th>Provider</th>
                    <th>Transaction ID</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.filter(p => p.payment_method === 'mobile_money').map((payment) => {
                    const student = students.find(s => s.id === payment.student_id)
                    const ref = payment.payment_reference || ''
                    const isMTN = ref.toUpperCase().includes('MTN')
                    return (
                      <tr key={payment.id}>
                        <td>{new Date(payment.payment_date).toLocaleDateString()}</td>
                        <td>{student?.first_name} {student?.last_name}</td>
                        <td className="font-medium text-green-600">{formatCurrency(Number(payment.amount_paid))}</td>
                        <td>
                          <span className={`badge ${isMTN ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                            {isMTN ? 'MTN MoMo' : 'Airtel Money'}
                          </span>
                        </td>
                        <td className="font-mono text-sm">{ref}</td>
                        <td><span className="badge badge-success">Recorded</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'payments' && (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Student</th>
                <th>Class</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Reference</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => {
                const student = students.find(s => s.id === payment.student_id)
                return (
                  <tr key={payment.id}>
                    <td>{new Date(payment.payment_date).toLocaleDateString()}</td>
                    <td className="font-medium">{student?.first_name} {student?.last_name}</td>
                    <td className="text-gray-600">{student?.classes?.name}</td>
                    <td className="font-medium text-green-600">{formatCurrency(Number(payment.amount_paid))}</td>
                    <td>
                      <span className="badge badge-info">
                        {payment.payment_method === 'mobile_money' ? 'MoMo' :
                         payment.payment_method === 'cash' ? 'Cash' :
                         payment.payment_method === 'bank' ? 'Bank' : 'Installment'}
                      </span>
                    </td>
                    <td className="font-mono text-sm">{payment.payment_reference || '-'}</td>
                    <td>
                      <button
                        onClick={() => deletePayment(payment.id)}
                        className="p-2 text-gray-400 hover:text-red-600"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'structure' && (
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
                  <td>{fee.classes?.name || 'All Classes'}</td>
                  <td>{formatCurrency(Number(fee.amount))}</td>
                  <td>Term {fee.term}</td>
                  <td>{fee.academic_year}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Record Payment</h2>
            </div>
            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              <div>
                <label className="label">Student</label>
                <select value={newPayment.student_id} onChange={(e) => setNewPayment({...newPayment, student_id: e.target.value})} className="input" required>
                  <option value="">Select student</option>
                  {studentBalances.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} - Balance: {formatCurrency(s.balance)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Amount (UGX)</label>
                  <input type="number" value={newPayment.amount_paid} onChange={(e) => setNewPayment({...newPayment, amount_paid: e.target.value})} className="input" required />
                </div>
                <div>
                  <label className="label">Payment Method</label>
                  <select value={newPayment.payment_method} onChange={(e) => setNewPayment({...newPayment, payment_method: e.target.value as any})} className="input">
                    <option value="cash">Cash</option>
                    <option value="mobile_money">Mobile Money</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="installment">Installment</option>
                  </select>
                </div>
              </div>

              {newPayment.payment_method === 'mobile_money' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Provider</label>
                    <select value={newPayment.momo_provider} onChange={(e) => setNewPayment({...newPayment, momo_provider: e.target.value as any})} className="input">
                      <option value="mtn">MTN Mobile Money</option>
                      <option value="airtel">Airtel Money</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Transaction ID</label>
                    <input type="text" placeholder="e.g. MP240315.1234" value={newPayment.momo_transaction_id} onChange={(e) => setNewPayment({...newPayment, momo_transaction_id: e.target.value})} className="input" />
                  </div>
                </div>
              )}

              <div>
                <label className="label">Paid By (Optional)</label>
                <input type="text" placeholder="Name of person who paid" value={newPayment.paid_by} onChange={(e) => setNewPayment({...newPayment, paid_by: e.target.value})} className="input" />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary flex-1">
                  {saving ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceiptModal && selectedStudent && (
        <div className="modal-overlay" onClick={() => setShowReceiptModal(false)}>
          <div className="modal max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Fee Receipt</h2>
              <button onClick={() => setShowReceiptModal(false)} className="p-2 text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div ref={receiptRef} className="p-6">
              <div className="header text-center border-b-2 border-blue-800 pb-4 mb-4">
                <div className="school-name text-xl font-bold text-blue-800">{school?.name || 'School Name'}</div>
                <div className="receipt-title text-sm text-gray-500">Fee Payment Receipt</div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-dashed">
                  <span className="text-gray-600">Student:</span>
                  <span className="font-bold">{selectedStudent.name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-dashed">
                  <span className="text-gray-600">Student No:</span>
                  <span className="font-bold">{selectedStudent.student_number}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-dashed">
                  <span className="text-gray-600">Class:</span>
                  <span className="font-bold">{selectedStudent.class_name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-dashed">
                  <span className="text-gray-600">Total Paid:</span>
                  <span className="font-bold text-green-600">{formatCurrency(selectedStudent.paid)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-dashed">
                  <span className="text-gray-600">Remaining Balance:</span>
                  <span className={`font-bold ${selectedStudent.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(selectedStudent.balance)}
                  </span>
                </div>
                <div className="flex justify-between py-3 border-t-2 border-blue-800 mt-2">
                  <span className="text-gray-600">Date:</span>
                  <span className="font-bold">{new Date().toLocaleDateString()}</span>
                </div>
              </div>
              <div className="text-center mt-6 text-xs text-gray-400">
                Thank you for your payment
              </div>
            </div>
            <div className="p-6 border-t border-gray-100">
              <button onClick={handlePrintReceipt} className="btn btn-primary w-full">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'
import { useState, useMemo, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useStudents, useFeePayments, useFeeStructure, useClasses } from '@/lib/hooks'
import { useToast } from '@/components/Toast'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

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
  const { payments, createPayment, deletePayment } = useFeePayments(school?.id)
  const { feeStructure } = useFeeStructure(school?.id)
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

  const filteredBalances = useMemo(() => {
    return studentBalances.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           s.student_number.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesClass = selectedClass === 'all' || s.class_name === selectedClass
      return matchesSearch && matchesClass
    }).sort((a, b) => b.balance - a.balance)
  }, [studentBalances, searchTerm, selectedClass])

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
      setNewPayment({ student_id: '', amount_paid: '', payment_method: 'cash', payment_reference: '', momo_provider: 'mtn', momo_transaction_id: '', paid_by: '', notes: '' })
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
        printWindow.document.write(`<html><head><title>Fee Receipt</title><style>body{font-family:Arial,sans-serif;padding:20px;max-width:400px;margin:0 auto}.header{text-align:center;border-bottom:2px solid #002045;padding-bottom:10px;margin-bottom:15px}.school-name{font-size:18px;font-weight:bold;color:#002045}.receipt-title{font-size:14px;color:#666;margin-top:5px}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #ddd}.label{color:#666;font-size:13px}.value{font-weight:bold;font-size:13px}.total{font-size:16px;border-top:2px solid #002045;margin-top:10px;padding-top:10px}.footer{text-align:center;margin-top:20px;font-size:11px;color:#999}</style></head><body>${printContent}</body></html>`)
        printWindow.document.close()
        printWindow.print()
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="font-headline font-bold text-3xl text-primary tracking-tight mb-2">Bursar Overview</h2>
          <p className="text-on-surface-variant text-sm font-medium">Term III, 2024 Financial Operations</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-outline-variant/30 text-primary font-semibold text-sm hover:bg-surface-container-low transition-all">
            <MaterialIcon className="text-lg">receipt_long</MaterialIcon>
            Generate Invoice
          </button>
          <button onClick={() => setShowPaymentModal(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/10">
            <MaterialIcon className="text-lg">add</MaterialIcon>
            Add Payment
          </button>
        </div>
      </header>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-container-lowest p-6 rounded-xl border-t-4 border-error relative overflow-hidden group hover:bg-surface-bright transition-colors">
          <div className="flex justify-between items-start mb-4">
            <MaterialIcon className="text-error bg-error-container p-2 rounded-lg" style={{ fontVariationSettings: 'FILL 1' }}>account_balance_wallet</MaterialIcon>
            <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant opacity-60">High Priority</span>
          </div>
          <p className="text-on-surface-variant text-xs font-semibold uppercase tracking-wider mb-1">Total Arrears</p>
          <h3 className="font-headline font-extrabold text-2xl text-on-surface tracking-tight">{formatCurrency(stats.totalBalance)}</h3>
          <div className="mt-4 flex items-center gap-2 text-[11px] font-bold text-error">
            <MaterialIcon className="text-sm">trending_up</MaterialIcon>
            <span>12% from last month</span>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl border-t-4 border-secondary relative overflow-hidden group hover:bg-surface-bright transition-colors">
          <div className="flex justify-between items-start mb-4">
            <MaterialIcon className="text-secondary bg-secondary-container p-2 rounded-lg" style={{ fontVariationSettings: 'FILL 1' }}>payments</MaterialIcon>
            <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant opacity-60">Real-time</span>
          </div>
          <p className="text-on-surface-variant text-xs font-semibold uppercase tracking-wider mb-1">Total Collected</p>
          <h3 className="font-headline font-extrabold text-2xl text-on-surface tracking-tight">{formatCurrency(stats.totalPaid)}</h3>
          <div className="mt-4 flex items-center gap-2 text-[11px] font-bold text-secondary">
            <MaterialIcon className="text-sm">check_circle</MaterialIcon>
            <span>{stats.fullyPaid} Fully Paid</span>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl border-t-4 border-tertiary-fixed-dim relative overflow-hidden group hover:bg-surface-bright transition-colors">
          <div className="flex justify-between items-start mb-4">
            <MaterialIcon className="text-tertiary bg-tertiary-fixed p-2 rounded-lg" style={{ fontVariationSettings: 'FILL 1' }}>sync</MaterialIcon>
            <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant opacity-60">Processing</span>
          </div>
          <p className="text-on-surface-variant text-xs font-semibold uppercase tracking-wider mb-1">Partial Payments</p>
          <h3 className="font-headline font-extrabold text-2xl text-on-surface tracking-tight">{stats.partialPaid} Students</h3>
          <div className="mt-4 flex items-center gap-2 text-[11px] font-bold text-on-tertiary-fixed-variant">
            <MaterialIcon className="text-sm">schedule</MaterialIcon>
            <span>Last sync 14 mins ago</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface-container-low rounded-xl p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-center">
          <div className="relative w-full lg:flex-1">
            <MaterialIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</MaterialIcon>
            <input type="text" placeholder="Search by name or student number..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-surface-container-lowest border-none rounded-xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all" />
          </div>
          <div className="flex gap-3 w-full lg:w-auto overflow-x-auto no-scrollbar">
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-xs font-bold text-primary cursor-pointer min-w-[140px]">
              <option value="all">All Classes</option>
              {classes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <button className="bg-surface-container-highest px-4 py-3 rounded-xl flex items-center justify-center hover:bg-outline-variant/30">
              <MaterialIcon className="text-lg">filter_list</MaterialIcon>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
        <button onClick={() => setTab('balances')} className={`px-6 py-2.5 rounded-full font-semibold text-sm whitespace-nowrap ${tab === 'balances' ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-bright'}`}>Student Balances</button>
        <button onClick={() => setTab('payments')} className={`px-6 py-2.5 rounded-full font-semibold text-sm whitespace-nowrap ${tab === 'payments' ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-bright'}`}>All Payments</button>
        <button onClick={() => setTab('momo')} className={`px-6 py-2.5 rounded-full font-semibold text-sm whitespace-nowrap ${tab === 'momo' ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-bright'}`}>Mobile Money</button>
        <button onClick={() => setTab('structure')} className={`px-6 py-2.5 rounded-full font-semibold text-sm whitespace-nowrap ${tab === 'structure' ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-bright'}`}>Fee Structure</button>
      </div>

      {/* Content */}
      {tab === 'balances' && (
        <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-outline-variant/5">
          <div className="overflow-x-auto">
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
                {filteredBalances.map((student) => (
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
                      <button onClick={() => { setSelectedStudent(student); setShowReceiptModal(true) }} className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg">
                        <MaterialIcon className="text-lg">visibility</MaterialIcon>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'momo' && (
        <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-left">
                  <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Date</th>
                  <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Student</th>
                  <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Amount</th>
                  <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Provider</th>
                  <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {payments.filter(p => p.payment_method === 'mobile_money').map((payment) => {
                  const student = students.find(s => s.id === payment.student_id)
                  const ref = payment.payment_reference || ''
                  const isMTN = ref.toUpperCase().includes('MTN')
                  return (
                    <tr key={payment.id} className="hover:bg-surface-bright">
                      <td className="px-6 py-4 text-sm">{new Date(payment.payment_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 font-medium">{student?.first_name} {student?.last_name}</td>
                      <td className="px-6 py-4 font-bold text-secondary">{formatCurrency(Number(payment.amount_paid))}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${isMTN ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{isMTN ? 'MTN' : 'Airtel'}</span>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-on-surface-variant">{ref}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'payments' && (
        <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-left">
                  <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Date</th>
                  <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Student</th>
                  <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Amount</th>
                  <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Method</th>
                  <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {payments.map((payment) => {
                  const student = students.find(s => s.id === payment.student_id)
                  return (
                    <tr key={payment.id} className="hover:bg-surface-bright">
                      <td className="px-6 py-4 text-sm">{new Date(payment.payment_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 font-medium">{student?.first_name} {student?.last_name}</td>
                      <td className="px-6 py-4 font-bold text-secondary">{formatCurrency(Number(payment.amount_paid))}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-surface-container text-on-surface-variant rounded text-xs font-bold uppercase">{payment.payment_method}</span>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-on-surface-variant">{payment.payment_reference || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'structure' && (
        <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-left">
                  <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Fee Name</th>
                  <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Class</th>
                  <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Amount</th>
                  <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Term</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {feeStructure.map((fee) => (
                  <tr key={fee.id} className="hover:bg-surface-bright">
                    <td className="px-6 py-4 font-medium">{fee.name}</td>
                    <td className="px-6 py-4">{fee.classes?.name || 'All Classes'}</td>
                    <td className="px-6 py-4 font-bold text-primary">{formatCurrency(Number(fee.amount))}</td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">Term {fee.term}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowPaymentModal(false)}>
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-outline-variant/10">
              <h2 className="font-headline font-bold text-xl text-primary">Record Payment</h2>
            </div>
            <form onSubmit={handleRecordPayment} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Student</label>
                <select value={newPayment.student_id} onChange={(e) => setNewPayment({...newPayment, student_id: e.target.value})} className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm" required>
                  <option value="">Select student</option>
                  {studentBalances.map((s) => <option key={s.id} value={s.id}>{s.name} - {formatCurrency(s.balance)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Amount (UGX)</label>
                  <input type="number" value={newPayment.amount_paid} onChange={(e) => setNewPayment({...newPayment, amount_paid: e.target.value})} className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Method</label>
                  <select value={newPayment.payment_method} onChange={(e) => setNewPayment({...newPayment, payment_method: e.target.value as any})} className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm">
                    <option value="cash">Cash</option>
                    <option value="mobile_money">Mobile Money</option>
                    <option value="bank">Bank Transfer</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="flex-1 py-3 bg-surface-container text-on-surface-variant font-semibold rounded-xl">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-3 bg-primary text-white font-semibold rounded-xl">{saving ? 'Saving...' : 'Record Payment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceiptModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowReceiptModal(false)}>
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div ref={receiptRef} className="p-6">
              <div className="text-center border-b-2 border-primary pb-4 mb-4">
                <h3 className="font-headline font-bold text-xl text-primary">{school?.name || 'School Name'}</h3>
                <p className="text-sm text-on-surface-variant">Fee Payment Receipt</p>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-dashed">
                  <span className="text-on-surface-variant">Student:</span>
                  <span className="font-bold text-primary">{selectedStudent.name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-dashed">
                  <span className="text-on-surface-variant">Student No:</span>
                  <span className="font-bold">{selectedStudent.student_number}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-dashed">
                  <span className="text-on-surface-variant">Total Paid:</span>
                  <span className="font-bold text-secondary">{formatCurrency(selectedStudent.paid)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-dashed">
                  <span className="text-on-surface-variant">Balance:</span>
                  <span className={`font-bold ${selectedStudent.balance > 0 ? 'text-error' : 'text-secondary'}`}>{formatCurrency(selectedStudent.balance)}</span>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-outline-variant/10">
              <button onClick={handlePrintReceipt} className="w-full py-3 bg-primary text-white font-semibold rounded-xl flex items-center justify-center gap-2">
                <MaterialIcon className="text-lg">print</MaterialIcon>
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
'use client'
import { useState, useMemo, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useStudents, useFeePayments, useFeeStructure, useClasses } from '@/lib/hooks'
import { useToast } from '@/components/Toast'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
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
  const { academicYear, currentTerm } = useAcademic()
  const toast = useToast()
  const { students } = useStudents(school?.id)
  const { classes } = useClasses(school?.id)
  const { payments, createPayment, deletePayment } = useFeePayments(school?.id)
  const { feeStructure, createFeeStructure, deleteFeeStructure } = useFeeStructure(school?.id)
  const receiptRef = useRef<HTMLDivElement>(null)
  
  const [tab, setTab] = useState<'balances' | 'payments' | 'momo' | 'structure'>('balances')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showFeeModal, setShowFeeModal] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<StudentBalance | null>(null)
  const [selectedClass, setSelectedClass] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [saving, setSaving] = useState(false)
  const [newFee, setNewFee] = useState({ name: '', class_id: '', amount: '', term: currentTerm || 1, due_date: '' })
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

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Are you sure you want to delete this payment?')) return
    try {
      await deletePayment(paymentId)
      toast.success('Payment deleted')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete payment')
    }
  }

  const handleCreateFee = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFee.name || !newFee.amount) {
      toast.error('Please fill fee name and amount')
      return
    }
    try {
      setSaving(true)
      await createFeeStructure({
        name: newFee.name,
        class_id: newFee.class_id || undefined,
        amount: Number(newFee.amount),
        term: Number(newFee.term),
        academic_year: academicYear,
        due_date: newFee.due_date || undefined,
      })
      toast.success('Fee structure created')
      setShowFeeModal(false)
      setNewFee({ name: '', class_id: '', amount: '', term: currentTerm || 1, due_date: '' })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create fee')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteFee = async (feeId: string) => {
    if (!confirm('Delete this fee structure?')) return
    try {
      await deleteFeeStructure(feeId)
      toast.success('Fee deleted')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete fee')
    }
  }

  const handleGenerateInvoice = (student: StudentBalance) => {
    setSelectedStudent(student)
    setShowInvoiceModal(true)
  }

  const handlePrintInvoice = () => {
    if (!selectedStudent) return
    const printWindow = window.open('', '_blank')
    const logoUrl = school?.logo_url || ''
    const schoolName = school?.name || 'School'
    const schoolColor = school?.primary_color || '#002045'
    const today = new Date().toLocaleDateString()
    const invoiceNo = `INV-${Date.now().toString().slice(-6)}`

    if (printWindow) {
      printWindow.document.write(`<html><head><title>Invoice</title><style>
        body{font-family:Arial,sans-serif;padding:20px;max-width:600px;margin:0 auto}
        .header{text-align:center;border-bottom:2px solid ${schoolColor};padding-bottom:15px;margin-bottom:15px}
        .logo{max-width:80px;max-height:60px;margin-bottom:10px}
        .school-name{font-size:20px;font-weight:bold;color:${schoolColor};margin:5px 0}
        .school-info{font-size:11px;color:#666;margin-bottom:5px}
        .invoice-title{font-size:16px;font-weight:bold;color:${schoolColor};margin:10px 0}
        .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #ddd}
        .label{color:#666;font-size:13px}
        .value{font-weight:bold;font-size:13px}
        .total{font-size:16px;border-top:2px solid ${schoolColor};margin-top:10px;padding-top:10px;font-weight:bold}
        .footer{text-align:center;margin-top:25px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:15px}
      </style></head><body>
        <div class="header">
          ${logoUrl ? `<img src="${logoUrl}" class="logo" alt="${schoolName}">` : ''}
          <div class="school-name">${schoolName}</div>
          <div class="school-info">Tel: ${school?.phone || ''} | Email: ${school?.email || ''}</div>
          <div class="invoice-title">FEE INVOICE</div>
          <div class="school-info">Invoice No: ${invoiceNo} | Date: ${today}</div>
        </div>
        <div class="row"><span class="label">Student:</span><span class="value">${selectedStudent.name}</span></div>
        <div class="row"><span class="label">Student No:</span><span class="value">${selectedStudent.student_number}</span></div>
        <div class="row"><span class="label">Class:</span><span class="value">${selectedStudent.class_name}</span></div>
        <div class="row"><span class="label">Term:</span><span class="value">Term ${currentTerm}, ${academicYear}</span></div>
        <div class="row"><span class="label">Total Fees:</span><span class="value">${formatCurrency(selectedStudent.expected)}</span></div>
        <div class="row"><span class="label">Amount Paid:</span><span class="value">${formatCurrency(selectedStudent.paid)}</span></div>
        <div class="total"><span class="label">Balance Due:</span><span class="value">${formatCurrency(selectedStudent.balance)}</span></div>
        <div class="footer">
          <div>This invoice is generated by Omuto SMS</div>
        </div>
      </body></html>`)
      printWindow.document.close()
      printWindow.print()
    }
  }

  const handlePrintReceipt = () => {
    if (receiptRef.current) {
      const printContent = receiptRef.current.innerHTML
      const printWindow = window.open('', '_blank')
      const logoUrl = school?.logo_url || ''
      const schoolName = school?.name || 'School'
      const schoolColor = school?.primary_color || '#002045'
      
      if (printWindow) {
        printWindow.document.write(`<html><head><title>Fee Receipt</title><style>
          body{font-family:Arial,sans-serif;padding:20px;max-width:400px;margin:0 auto}
          .header{text-align:center;border-bottom:2px solid ${schoolColor};padding-bottom:15px;margin-bottom:15px}
          .logo{max-width:80px;max-height:60px;margin-bottom:10px}
          .school-name{font-size:20px;font-weight:bold;color:${schoolColor};margin:5px 0}
          .school-info{font-size:11px;color:#666;margin-bottom:5px}
          .receipt-title{font-size:14px;color:#666;margin-top:5px;font-weight:bold}
          .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #ddd}
          .label{color:#666;font-size:13px}
          .value{font-weight:bold;font-size:13px}
          .total{font-size:16px;border-top:2px solid ${schoolColor};margin-top:10px;padding-top:10px;font-weight:bold}
          .footer{text-align:center;margin-top:25px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:15px}
          .thank-you{font-weight:bold;color:${schoolColor};margin-bottom:5px}
        </style></head><body>
          <div class="header">
            ${logoUrl ? `<img src="${logoUrl}" class="logo" alt="${schoolName}">` : ''}
            <div class="school-name">${schoolName}</div>
            <div class="school-info">Tel: ${school?.phone || ''} | Email: ${school?.email || ''}</div>
            <div class="receipt-title">OFFICIAL RECEIPT</div>
          </div>
          ${printContent}
          <div class="footer">
            <div class="thank-you">Thank you for your payment!</div>
            <div>Powered by Omuto SMS</div>
          </div>
        </body></html>`)
        printWindow.document.close()
        printWindow.print()
      }
    }
  }

  return (
    <div className="content">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="ph-title">Bursar Overview</div>
          <div className="ph-sub">Term {currentTerm}, {academicYear} Financial Operations</div>
        </div>
        <div className="ph-actions">
          <button onClick={() => setShowInvoiceModal(true)} className="btn btn-ghost">
            <MaterialIcon icon="receipt_long" style={{ fontSize: '16px' }} />
            Generate Invoice
          </button>
          <button onClick={() => setShowPaymentModal(true)} className="btn btn-primary">
            <MaterialIcon icon="add" style={{ fontSize: '16px' }} />
            Add Payment
          </button>
        </div>
      </div>

      {/* Stats Bento Grid */}
      <div className="stat-grid">
        <div className="stat-card" style={{ borderTop: '4px solid var(--red)' }}>
          <div className="stat-inner">
            <div className="stat-meta">
              <div className="stat-label">Total Arrears</div>
              <div className="stat-icon-box" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>
                <MaterialIcon icon="account_balance_wallet" style={{ fontSize: '17px' }} />
              </div>
            </div>
            <div className="stat-val" style={{ color: 'var(--red)' }}>{formatCurrency(stats.totalBalance)}</div>
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--red)', fontWeight: 600 }}>
              {stats.notPaid} students unpaid
            </div>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl border-t-4 border-secondary relative overflow-hidden group hover:bg-surface-bright transition-colors">
          <div className="flex justify-between items-start mb-4">
            <MaterialIcon icon="payments" className="text-secondary bg-secondary-container p-2 rounded-lg" style={{ fontVariationSettings: 'FILL 1' }} />
            <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant opacity-60">Real-time</span>
          </div>
          <p className="text-on-surface-variant text-xs font-semibold uppercase tracking-wider mb-1">Total Collected</p>
          <h3 className="font-headline font-extrabold text-2xl text-on-surface tracking-tight">{formatCurrency(stats.totalPaid)}</h3>
          <div className="mt-4 flex items-center gap-2 text-[11px] font-bold text-secondary">
            <MaterialIcon icon="check_circle" className="text-sm" />
            <span>{stats.fullyPaid} Fully Paid</span>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl border-t-4 border-tertiary-fixed-dim relative overflow-hidden group hover:bg-surface-bright transition-colors">
          <div className="flex justify-between items-start mb-4">
            <MaterialIcon icon="sync" className="text-tertiary bg-tertiary-fixed p-2 rounded-lg" style={{ fontVariationSettings: 'FILL 1' }} />
            <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant opacity-60">Processing</span>
          </div>
          <p className="text-on-surface-variant text-xs font-semibold uppercase tracking-wider mb-1">Partial Payments</p>
          <h3 className="font-headline font-extrabold text-2xl text-on-surface tracking-tight">{stats.partialPaid} Students</h3>
          <div className="mt-4 flex items-center gap-2 text-[11px] font-bold text-on-tertiary-fixed-variant">
            <MaterialIcon icon="schedule" className="text-sm" />
            <span>{payments.length} total transactions</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface-container-low rounded-xl p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-center">
          <div className="relative w-full lg:flex-1">
            <MaterialIcon icon="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input type="text" placeholder="Search by name or student number..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-surface-container-lowest border-none rounded-xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all" />
          </div>
          <div className="flex gap-3 w-full lg:w-auto overflow-x-auto no-scrollbar">
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-xs font-bold text-primary cursor-pointer min-w-[140px]">
              <option value="all">All Classes</option>
              {classes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <button className="bg-surface-container-highest px-4 py-3 rounded-xl flex items-center justify-center hover:bg-outline-variant/30">
                <MaterialIcon icon="filter_list" className="text-lg" />
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
                        <MaterialIcon icon="visibility" className="text-lg" />
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
                  <th className="px-6 py-4"></th>
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
                      <td className="px-6 py-4">
                        <button onClick={() => handleDeletePayment(payment.id)} className="p-2 text-error hover:bg-error-container rounded-lg">
                          <MaterialIcon icon="delete" className="text-lg" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'structure' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => setShowFeeModal(true)} className="btn btn-primary">
              <MaterialIcon icon="add" />
              Add Fee
            </button>
          </div>
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-left">
                    <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Fee Name</th>
                    <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Class</th>
                    <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Amount</th>
                    <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Term</th>
                    <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {feeStructure.map((fee) => (
                    <tr key={fee.id} className="hover:bg-surface-bright">
                      <td className="px-6 py-4 font-medium">{fee.name}</td>
                      <td className="px-6 py-4">{fee.classes?.name || 'All Classes'}</td>
                      <td className="px-6 py-4 font-bold text-primary">{formatCurrency(Number(fee.amount))}</td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant">Term {fee.term}</td>
                      <td className="px-6 py-4">
                        <button onClick={() => handleDeleteFee(fee.id)} className="text-error hover:underline text-sm">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Payment Reference</label>
                <input type="text" value={newPayment.payment_reference} onChange={(e) => setNewPayment({...newPayment, payment_reference: e.target.value})} className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm" placeholder="e.g. Receipt number" />
              </div>
              {newPayment.payment_method === 'mobile_money' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">MoMo Provider</label>
                    <select value={newPayment.momo_provider} onChange={(e) => setNewPayment({...newPayment, momo_provider: e.target.value as 'mtn' | 'airtel'})} className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm">
                      <option value="mtn">MTN</option>
                      <option value="airtel">Airtel</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Transaction ID</label>
                    <input type="text" value={newPayment.momo_transaction_id} onChange={(e) => setNewPayment({...newPayment, momo_transaction_id: e.target.value})} className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm" placeholder="MoMo transaction ID" />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Paid By</label>
                  <input type="text" value={newPayment.paid_by} onChange={(e) => setNewPayment({...newPayment, paid_by: e.target.value})} className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm" placeholder="Name of payer" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Notes</label>
                  <input type="text" value={newPayment.notes} onChange={(e) => setNewPayment({...newPayment, notes: e.target.value})} className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm" placeholder="Additional notes" />
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
                <MaterialIcon icon="print" className="text-lg" />
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Fee Modal */}
      {showFeeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowFeeModal(false)}>
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-outline-variant/10">
              <h2 className="font-headline font-bold text-xl text-primary">Add New Fee</h2>
            </div>
            <form onSubmit={handleCreateFee} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Fee Name</label>
                <input type="text" value={newFee.name} onChange={(e) => setNewFee({...newFee, name: e.target.value})} className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm" placeholder="e.g. Tuition, Development, Library" required />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Class (Optional - leave empty for all)</label>
                <select value={newFee.class_id} onChange={(e) => setNewFee({...newFee, class_id: e.target.value})} className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm">
                  <option value="">All Classes</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Amount (UGX)</label>
                  <input type="number" value={newFee.amount} onChange={(e) => setNewFee({...newFee, amount: e.target.value})} className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Term</label>
                  <select value={newFee.term} onChange={(e) => setNewFee({...newFee, term: Number(e.target.value)})} className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm">
                    <option value={1}>Term 1</option>
                    <option value={2}>Term 2</option>
                    <option value={3}>Term 3</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Due Date (Optional)</label>
                <input type="date" value={newFee.due_date} onChange={(e) => setNewFee({...newFee, due_date: e.target.value})} className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowFeeModal(false)} className="btn btn-ghost flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary flex-1">{saving ? 'Saving...' : 'Add Fee'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Selection Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowInvoiceModal(false)}>
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-outline-variant/10">
              <h2 className="font-headline font-bold text-xl text-primary">Generate Invoice</h2>
              <p className="text-sm text-on-surface-variant mt-1">Select a student to generate their fee invoice</p>
            </div>
            <div className="p-6">
              <div className="max-h-80 overflow-y-auto space-y-2">
                {studentBalances.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => { handleGenerateInvoice(student) }}
                    className="w-full text-left p-4 rounded-xl hover:bg-surface-container transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-primary">{student.name}</div>
                      <div className="text-xs text-on-surface-variant">{student.student_number} • {student.class_name}</div>
                    </div>
                    <div className={`text-sm font-bold ${student.balance > 0 ? 'text-error' : 'text-secondary'}`}>
                      {formatCurrency(student.balance)} due
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-outline-variant/10 flex gap-3">
              <button onClick={() => setShowInvoiceModal(false)} className="flex-1 py-3 bg-surface-container text-on-surface-variant font-semibold rounded-xl">Cancel</button>
              {selectedStudent && (
                <button onClick={handlePrintInvoice} className="flex-1 py-3 bg-primary text-white font-semibold rounded-xl flex items-center justify-center gap-2">
                  <MaterialIcon icon="print" className="text-lg" />
                  Print Invoice
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'
import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useStudents, useFeePayments, useFeeStructure, useClasses } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import MaterialIcon from '@/components/MaterialIcon'

interface Invoice {
  student_id: string
  student_name: string
  student_number: string
  class_name: string
  fee_items: Array<{ name: string; amount: number }>
  total_amount: number
  amount_paid: number
  balance: number
}

export default function InvoicingPage() {
  const { school, user } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const toast = useToast()
  const { students } = useStudents(school?.id)
  const { payments } = useFeePayments(school?.id)
  const { feeStructure } = useFeeStructure(school?.id)
  const { classes } = useClasses(school?.id)
  
  const [selectedClass, setSelectedClass] = useState('all')
  const [generating, setGenerating] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`

  // Generate invoices for all students
  const invoices: Invoice[] = useMemo(() => {
    return students.map(student => {
      // Get fee items for this student's class or all classes
      const studentFeeItems = feeStructure.filter(f => 
        !f.class_id || f.class_id === student.class_id
      )

      const feeItems = studentFeeItems.map(f => ({
        name: f.name,
        amount: Number(f.amount)
      }))

      const totalAmount = feeItems.reduce((sum, f) => sum + f.amount, 0)
      const amountPaid = payments
        .filter(p => p.student_id === student.id)
        .reduce((sum, p) => sum + Number(p.amount_paid), 0)

      return {
        student_id: student.id,
        student_name: `${student.first_name} ${student.last_name}`,
        student_number: student.student_number || '',
        class_name: student.classes?.name || '',
        fee_items: feeItems,
        total_amount: totalAmount,
        amount_paid: amountPaid,
        balance: Math.max(0, totalAmount - amountPaid)
      }
    })
  }, [students, feeStructure, payments])

  const filteredInvoices = useMemo(() => {
    if (selectedClass === 'all') return invoices
    return invoices.filter(i => {
      const student = students.find(s => s.id === i.student_id)
      return student?.class_id === selectedClass
    })
  }, [invoices, selectedClass, students])

  const stats = useMemo(() => ({
    totalInvoiced: filteredInvoices.reduce((sum, i) => sum + i.total_amount, 0),
    totalCollected: filteredInvoices.reduce((sum, i) => sum + i.amount_paid, 0),
    totalBalance: filteredInvoices.reduce((sum, i) => sum + i.balance, 0),
    fullyPaid: filteredInvoices.filter(i => i.balance === 0).length,
    hasBalance: filteredInvoices.filter(i => i.balance > 0).length,
  }), [filteredInvoices])

  const printInvoice = (invoice: Invoice) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice - ${invoice.student_name}</title>
          <style>
            * { font-family: Arial, sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
            body { padding: 20px; }
            .invoice { max-width: 600px; margin: 0 auto; }
            .header { background: #1e3a5f; color: white; padding: 20px; text-align: center; }
            .school-name { font-size: 20px; font-weight: bold; }
            .subtitle { font-size: 12px; margin-top: 4px; }
            .info { padding: 15px; background: #f5f5f5; margin-bottom: 15px; }
            .info-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 13px; }
            .info-label { color: #666; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            th { background: #1e3a5f; color: white; padding: 10px; text-align: left; }
            td { padding: 10px; border-bottom: 1px solid #eee; }
            .total-row { font-weight: bold; background: #f0f9ff; }
            .balance { text-align: right; padding: 15px; }
            .balance-amount { font-size: 18px; font-weight: bold; color: ${invoice.balance > 0 ? '#dc2626' : '#16a34a'}; }
            .footer { text-align: center; padding: 15px; font-size: 11px; color: #999; border-top: 1px solid #eee; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="invoice">
            <div class="header">
              <div class="school-name">${school?.name || 'School Name'}</div>
              <div class="subtitle">Fee Invoice - Term ${currentTerm}, ${academicYear}</div>
            </div>
            
            <div class="info">
              <div class="info-row">
                <span class="info-label">Student Name:</span>
                <span>${invoice.student_name}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Student Number:</span>
                <span>${invoice.student_number}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Class:</span>
                <span>${invoice.class_name}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Date:</span>
                <span>${new Date().toLocaleDateString()}</span>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Fee Item</th>
                  <th style="text-align: right;">Amount (UGX)</th>
                </tr>
              </thead>
              <tbody>
                ${invoice.fee_items.map(item => `
                  <tr>
                    <td>${item.name}</td>
                    <td style="text-align: right;">${item.amount.toLocaleString()}</td>
                  </tr>
                `).join('')}
                <tr class="total-row">
                  <td>Total</td>
                  <td style="text-align: right;">${invoice.total_amount.toLocaleString()}</td>
                </tr>
                <tr>
                  <td>Paid</td>
                  <td style="text-align: right; color: green;">${invoice.amount_paid.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            <div class="balance">
              <div style="font-size: 12px; color: #666; margin-bottom: 5px;">Balance Due</div>
              <div class="balance-amount">${formatCurrency(invoice.balance)}</div>
            </div>

            <div class="footer">
              Thank you for your payment. Please present this invoice when making payments.
            </div>
          </div>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const sendInvoiceSMS = async (invoice: Invoice) => {
    try {
      const student = students.find(s => s.id === invoice.student_id)
      if (!student?.parent_phone) {
        toast.error('No parent phone number')
        return
      }

      const message = `Dear Parent, ${invoice.student_name} (${invoice.student_number}) fee invoice: Total ${formatCurrency(invoice.total_amount)}, Paid ${formatCurrency(invoice.amount_paid)}, Balance ${formatCurrency(invoice.balance)}. ${school?.name}`

      await fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: student.parent_phone,
          message,
          schoolId: school?.id,
        })
      })

      toast.success('Invoice sent via SMS')
    } catch {
      toast.error('Failed to send SMS')
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Fee Invoicing</h1>
        <p className="text-[#5c6670] mt-1">Generate and manage student invoices</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
          <div className="stat-value">{formatCurrency(stats.totalInvoiced)}</div>
          <div className="stat-label">Total Invoiced</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
          <div className="stat-value text-green-600">{formatCurrency(stats.totalCollected)}</div>
          <div className="stat-label">Collected</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
          <div className="stat-value text-red-600">{formatCurrency(stats.totalBalance)}</div>
          <div className="stat-label">Outstanding</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
          <div className="stat-value text-green-600">{stats.fullyPaid}</div>
          <div className="stat-label">Fully Paid</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
          <div className="stat-value text-yellow-600">{stats.hasBalance}</div>
          <div className="stat-label">Has Balance</div>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-6">
        {classes.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">No classes available</div>
        ) : (
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input sm:w-48">
            <option value="all">All Classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {/* Invoices Table */}
      <div className="table-wrapper">
        <table className="table">
          <thead className="bg-[#f8fafb]">
            <tr>
              <th>Student</th>
              <th>Class</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map((invoice) => (
              <tr key={invoice.student_id}>
                <td>
                  <div className="font-medium text-[#002045]">{invoice.student_name}</div>
                  <div className="text-xs text-[#5c6670]">{invoice.student_number}</div>
                </td>
                <td>{invoice.class_name}</td>
                <td>{formatCurrency(invoice.total_amount)}</td>
                <td className="text-green-600">{formatCurrency(invoice.amount_paid)}</td>
                <td className={invoice.balance > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                  {formatCurrency(invoice.balance)}
                </td>
                <td>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${invoice.balance === 0 ? 'bg-[#e8f5e9] text-[#006e1c]' : 'bg-[#fff3e0] text-[#e65100]'}`}>
                    {invoice.balance === 0 ? 'Paid' : 'Pending'}
                  </span>
                </td>
                <td>
                  <div className="flex gap-2">
                    <button
                      onClick={() => printInvoice(invoice)}
                      className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                      title="Print Invoice"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                    </button>
                    {invoice.balance > 0 && (
                      <button
                        onClick={() => sendInvoiceSMS(invoice)}
                        className="p-2 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50"
                        title="Send via SMS"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

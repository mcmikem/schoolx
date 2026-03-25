'use client'
import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useStudents, useFeePayments, useFeeStructure, useClasses } from '@/lib/hooks'
import { useToast } from '@/components/Toast'

export default function BoardReportPage() {
  const { school } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const toast = useToast()
  const { students } = useStudents(school?.id)
  const { payments } = useFeePayments(school?.id)
  const { feeStructure } = useFeeStructure(school?.id)
  const { classes } = useClasses(school?.id)

  const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`

  const stats = useMemo(() => {
    const boys = students.filter(s => s.gender === 'M').length
    const girls = students.filter(s => s.gender === 'F').length
    const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount_paid), 0)
    const totalExpected = feeStructure.reduce((sum, f) => sum + Number(f.amount), 0) * Math.max(students.length, 1)
    const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0

    return {
      totalStudents: students.length,
      boys,
      girls,
      totalCollected,
      totalExpected,
      collectionRate,
      totalClasses: classes.length,
    }
  }, [students, payments, feeStructure, classes])

  const generatePDF = async () => {
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF()

      // Header
      doc.setFillColor(30, 58, 95)
      doc.rect(0, 0, 210, 40, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.text(school?.name || 'School Name', 105, 15, { align: 'center' })
      doc.setFontSize(12)
      doc.text('Board Executive Report', 105, 25, { align: 'center' })
      doc.setFontSize(10)
      doc.text(`Term ${currentTerm}, ${academicYear}`, 105, 33, { align: 'center' })

      // Report Date
      doc.setTextColor(100, 100, 100)
      doc.setFontSize(9)
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 50)

      // Section 1: Enrollment
      doc.setTextColor(30, 58, 95)
      doc.setFontSize(14)
      doc.text('1. Enrollment Summary', 14, 65)
      
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(11)
      doc.text(`Total Students: ${stats.totalStudents}`, 20, 78)
      doc.text(`Boys: ${stats.boys} (${Math.round((stats.boys / stats.totalStudents) * 100)}%)`, 20, 86)
      doc.text(`Girls: ${stats.girls} (${Math.round((stats.girls / stats.totalStudents) * 100)}%)`, 20, 94)
      doc.text(`Number of Classes: ${stats.totalClasses}`, 20, 102)

      // Section 2: Financial
      doc.setTextColor(30, 58, 95)
      doc.setFontSize(14)
      doc.text('2. Financial Summary', 14, 120)
      
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(11)
      doc.text(`Total Expected Revenue: ${formatCurrency(stats.totalExpected)}`, 20, 133)
      doc.text(`Total Collected: ${formatCurrency(stats.totalCollected)}`, 20, 141)
      doc.text(`Outstanding Balance: ${formatCurrency(stats.totalExpected - stats.totalCollected)}`, 20, 149)
      doc.text(`Collection Rate: ${stats.collectionRate}%`, 20, 157)

      // Section 3: Performance
      doc.setTextColor(30, 58, 95)
      doc.setFontSize(14)
      doc.text('3. Academic Performance', 14, 175)
      
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(11)
      doc.text('Performance data available in full reports.', 20, 188)

      // Section 4: Recommendations
      doc.setTextColor(30, 58, 95)
      doc.setFontSize(14)
      doc.text('4. Recommendations', 14, 206)
      
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(11)
      doc.text('1. Continue monitoring student attendance', 20, 219)
      doc.text('2. Follow up on outstanding fee balances', 20, 227)
      doc.text('3. Support students with early warning flags', 20, 235)

      // Footer
      doc.setFillColor(240, 240, 240)
      doc.rect(0, 275, 210, 22, 'F')
      doc.setTextColor(100, 100, 100)
      doc.setFontSize(8)
      doc.text('This report is confidential and intended for board members only.', 105, 283, { align: 'center' })
      doc.text(`${school?.name || 'OmutoSMS'} | Generated ${new Date().toLocaleDateString()}`, 105, 290, { align: 'center' })

      doc.save('board_report.pdf')
      toast.success('Report downloaded')
    } catch (err) {
      toast.error('Failed to generate report')
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Board Report</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Generate executive summary for board meetings</p>
      </div>

      {/* Preview */}
      <div className="card max-w-2xl mb-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-6">Report Preview</h2>
        
        <div className="space-y-6">
          {/* Enrollment */}
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">1. Enrollment</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalStudents}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.boys}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Boys</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">{stats.girls}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Girls</div>
              </div>
            </div>
          </div>

          {/* Financial */}
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">2. Financial</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Collected</div>
                <div className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(stats.totalCollected)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Collection Rate</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">{stats.collectionRate}%</div>
              </div>
            </div>
          </div>

          {/* Classes */}
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">3. Classes</h3>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalClasses}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Active Classes</div>
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <button onClick={generatePDF} className="btn btn-primary">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Download Board Report (PDF)
      </button>

      {/* Info */}
      <div className="card mt-6 max-w-2xl">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">About Board Reports</h2>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li>Board reports provide a one-page executive summary for school owners and board members</li>
          <li>Reports include enrollment, financial, and academic performance data</li>
          <li>Generated reports are confidential and should only be shared with authorized personnel</li>
          <li>Reports can be printed or shared digitally</li>
        </ul>
      </div>
    </div>
  )
}

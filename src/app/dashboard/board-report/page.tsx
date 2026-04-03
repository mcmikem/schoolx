'use client'
import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useStudents, useFeePayments, useFeeStructure, useClasses } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/index'

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

      doc.setFillColor(30, 58, 95)
      doc.rect(0, 0, 210, 40, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.text(school?.name || 'School Name', 105, 15, { align: 'center' })
      doc.setFontSize(12)
      doc.text('Board Executive Report', 105, 25, { align: 'center' })
      doc.setFontSize(10)
      doc.text(`Term ${currentTerm}, ${academicYear}`, 105, 33, { align: 'center' })

      doc.setTextColor(100, 100, 100)
      doc.setFontSize(9)
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 50)

      doc.setTextColor(30, 58, 95)
      doc.setFontSize(14)
      doc.text('1. Enrollment Summary', 14, 65)
      
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(11)
      doc.text(`Total Students: ${stats.totalStudents}`, 20, 78)
      doc.text(`Boys: ${stats.boys} (${Math.round((stats.boys / stats.totalStudents) * 100)}%)`, 20, 86)
      doc.text(`Girls: ${stats.girls} (${Math.round((stats.girls / stats.totalStudents) * 100)}%)`, 20, 94)
      doc.text(`Number of Classes: ${stats.totalClasses}`, 20, 102)

      doc.setTextColor(30, 58, 95)
      doc.setFontSize(14)
      doc.text('2. Financial Summary', 14, 120)
      
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(11)
      doc.text(`Total Expected Revenue: ${formatCurrency(stats.totalExpected)}`, 20, 133)
      doc.text(`Total Collected: ${formatCurrency(stats.totalCollected)}`, 20, 141)
      doc.text(`Outstanding Balance: ${formatCurrency(stats.totalExpected - stats.totalCollected)}`, 20, 149)
      doc.text(`Collection Rate: ${stats.collectionRate}%`, 20, 157)

      doc.setTextColor(30, 58, 95)
      doc.setFontSize(14)
      doc.text('3. Academic Performance', 14, 175)
      
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(11)
      doc.text('Performance data available in full reports.', 20, 188)

      doc.setTextColor(30, 58, 95)
      doc.setFontSize(14)
      doc.text('4. Recommendations', 14, 206)
      
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(11)
      doc.text('1. Continue monitoring student attendance', 20, 219)
      doc.text('2. Follow up on outstanding fee balances', 20, 227)
      doc.text('3. Support students with early warning flags', 20, 235)

      doc.setFillColor(240, 240, 240)
      doc.rect(0, 275, 210, 22, 'F')
      doc.setTextColor(100, 100, 100)
      doc.setFontSize(8)
      doc.text('This report is confidential and intended for board members only.', 105, 283, { align: 'center' })
      doc.text(`${school?.name || 'SchoolX'} | Generated ${new Date().toLocaleDateString()}`, 105, 290, { align: 'center' })

      doc.save('board_report.pdf')
      toast.success('Report downloaded')
    } catch (err) {
      toast.error('Failed to generate report')
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader 
        title="Board Report"
        subtitle="Generate executive summary for board meetings"
        actions={
          <Button onClick={generatePDF} icon={<MaterialIcon icon="download" />}>
            Download Board Report (PDF)
          </Button>
        }
      />

      <Card className="max-w-2xl">
        <CardBody>
          <h2 className="font-semibold text-[var(--t1)] mb-6">Report Preview</h2>
          
          <div className="space-y-6">
            <div className="p-4 bg-[var(--surface-container-low)] rounded-lg">
              <h3 className="font-medium text-[var(--t1)] mb-3">1. Enrollment</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-[var(--t1)]">{stats.totalStudents}</div>
                  <div className="text-xs text-[var(--t3)]">Total</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">{stats.boys}</div>
                  <div className="text-xs text-[var(--t3)]">Boys</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-pink-600">{stats.girls}</div>
                  <div className="text-xs text-[var(--t3)]">Girls</div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[var(--surface-container-low)] rounded-lg">
              <h3 className="font-medium text-[var(--t1)] mb-3">2. Financial</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-[var(--t3)]">Collected</div>
                  <div className="text-xl font-bold text-green-600">{formatCurrency(stats.totalCollected)}</div>
                </div>
                <div>
                  <div className="text-sm text-[var(--t3)]">Collection Rate</div>
                  <div className="text-xl font-bold text-[var(--t1)]">{stats.collectionRate}%</div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[var(--surface-container-low)] rounded-lg">
              <h3 className="font-medium text-[var(--t1)] mb-3">3. Classes</h3>
              <div className="text-2xl font-bold text-[var(--t1)]">{stats.totalClasses}</div>
              <div className="text-sm text-[var(--t3)]">Active Classes</div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card className="max-w-2xl">
        <CardBody>
          <h2 className="font-semibold text-[var(--t1)] mb-4">About Board Reports</h2>
          <ul className="space-y-2 text-sm text-[var(--t3)]">
            <li>Board reports provide a one-page executive summary for school owners and board members</li>
            <li>Reports include enrollment, financial, and academic performance data</li>
            <li>Generated reports are confidential and should only be shared with authorized personnel</li>
            <li>Reports can be printed or shared digitally</li>
          </ul>
        </CardBody>
      </Card>
    </div>
  )
}
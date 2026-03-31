'use client'
import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useClasses, useStudents, useSubjects, useGrades, useFeePayments, useFeeStructure } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import MaterialIcon from '@/components/MaterialIcon'

interface StudentReport {
  studentId: string
  name: string
  studentNumber: string
  gender: string
  className: string
  subjects: { name: string; score: number; grade: string; gradeColor: string }[]
  totalMarks: number
  maxMarks: number
  average: number
  position: number
  division: string
  classTeacherComment: string
  hmComment: string
  feeBalance: number
}

function getGradeLabel(score: number): { grade: string; color: string } {
  if (score >= 80) return { grade: 'D1', color: 'text-green-600' }
  if (score >= 70) return { grade: 'D2', color: 'text-green-500' }
  if (score >= 65) return { grade: 'C3', color: 'text-blue-600' }
  if (score >= 60) return { grade: 'C4', color: 'text-blue-500' }
  if (score >= 55) return { grade: 'C5', color: 'text-indigo-500' }
  if (score >= 50) return { grade: 'C6', color: 'text-indigo-400' }
  if (score >= 45) return { grade: 'P7', color: 'text-yellow-600' }
  if (score >= 40) return { grade: 'P8', color: 'text-yellow-500' }
  return { grade: 'F9', color: 'text-red-500' }
}

function getDivision(total: number, maxTotal: number): string {
  const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0
  if (pct >= 80) return 'Division 1'
  if (pct >= 60) return 'Division 2'
  if (pct >= 40) return 'Division 3'
  if (pct >= 20) return 'Division 4'
  return 'Division U'
}

function getAutoComment(position: number): string {
  if (position >= 1 && position <= 5) return 'Excellent performance. Keep it up!'
  if (position >= 6 && position <= 15) return 'Good work. Strive for better.'
  return 'Needs more effort. Work harder.'
}

export default function ReportCardsPage() {
  const { school } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const toast = useToast()
  const { classes } = useClasses(school?.id)
  const { subjects } = useSubjects(school?.id)
  const { students: classStudents } = useStudents(school?.id)
  const { payments } = useFeePayments(school?.id)
  const { feeStructure } = useFeeStructure(school?.id)

  const [selectedClass, setSelectedClass] = useState('')
  const [generated, setGenerated] = useState(false)
  const [hideWithFees, setHideWithFees] = useState(false)
  const [reports, setReports] = useState<StudentReport[]>([])
  const [comments, setComments] = useState<Record<string, { classTeacher: string; hm: string }>>({})
  const [viewingReport, setViewingReport] = useState<StudentReport | null>(null)
  const [sendingSms, setSendingSms] = useState(false)

  const filteredStudents = useMemo(() => {
    if (!selectedClass) return []
    return classStudents.filter(s => s.class_id === selectedClass)
  }, [classStudents, selectedClass])

  const selectedClassName = classes.find(c => c.id === selectedClass)?.name || ''

  const totalFeePerStudent = useMemo(() => {
    return feeStructure.reduce((sum, f) => sum + Number(f.amount || 0), 0)
  }, [feeStructure])

  const getStudentFeeBalance = (studentId: string): number => {
    const studentPayments = payments.filter(p => p.student_id === studentId)
    const paid = studentPayments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)
    return Math.max(0, totalFeePerStudent - paid)
  }

  const handleGenerate = async () => {
    if (!selectedClass) {
      toast.error('Please select a class first')
      return
    }
    if (filteredStudents.length === 0) {
      toast.error('No students in this class')
      return
    }

    try {
      const { supabase: sb } = await import('@/lib/supabase')

      const { data: gradesData, error } = await sb
        .from('grades')
        .select('*, subjects(id, name)')
        .eq('class_id', selectedClass)
        .eq('term', currentTerm)
        .eq('academic_year', academicYear)

      if (error) throw error

      // Group grades by student and subject, summing all assessment types
      const studentSubjectScores: Record<string, Record<string, { total: number; name: string }>> = {}

      for (const g of (gradesData || [])) {
        if (!studentSubjectScores[g.student_id]) {
          studentSubjectScores[g.student_id] = {}
        }
        const subjName = g.subjects?.name || 'Unknown'
        if (!studentSubjectScores[g.student_id][g.subject_id]) {
          studentSubjectScores[g.student_id][g.subject_id] = { total: 0, name: subjName }
        }
        studentSubjectScores[g.student_id][g.subject_id].total += Number(g.score || 0)
      }

      const subjectList = Object.values(studentSubjectScores).length > 0
        ? Object.values(Object.values(studentSubjectScores)[0]).map(s => s.name)
        : subjects.map((s: any) => s.name)
      const numSubjects = subjectList.length || 1

      const reportList: StudentReport[] = filteredStudents.map(student => {
        const subjScores = studentSubjectScores[student.id] || {}
        const subjectDetails = Object.entries(subjScores).map(([, data]) => {
          const gradeInfo = getGradeLabel(data.total)
          return { name: data.name, score: data.total, grade: gradeInfo.grade, gradeColor: gradeInfo.color }
        })

        // Fill in subjects with 0 if missing
        const allSubjectDetails = subjects.map((sub: any) => {
          const existing = subjectDetails.find(sd => sd.name === sub.name)
          return existing || { name: sub.name, score: 0, grade: 'F9', gradeColor: 'text-red-500' }
        })

        const totalMarks = allSubjectDetails.reduce((sum, s) => sum + s.score, 0)
        const maxMarks = numSubjects * 100
        const average = numSubjects > 0 ? Math.round(totalMarks / numSubjects * 10) / 10 : 0

        return {
          studentId: student.id,
          name: `${student.first_name} ${student.last_name}`,
          studentNumber: student.student_number || '',
          gender: student.gender,
          className: selectedClassName,
          subjects: allSubjectDetails,
          totalMarks,
          maxMarks,
          average,
          position: 0,
          division: '',
          classTeacherComment: '',
          hmComment: '',
          feeBalance: getStudentFeeBalance(student.id),
        }
      })

      // Sort by total marks descending and assign positions
      reportList.sort((a, b) => b.totalMarks - a.totalMarks)
      reportList.forEach((r, i) => {
        r.position = i + 1
        r.division = getDivision(r.totalMarks, r.maxMarks)
        r.classTeacherComment = getAutoComment(r.position)
        r.hmComment = getAutoComment(r.position)
      })

      // Initialize comments state
      const initialComments: Record<string, { classTeacher: string; hm: string }> = {}
      for (const r of reportList) {
        initialComments[r.studentId] = {
          classTeacher: r.classTeacherComment,
          hm: r.hmComment,
        }
      }

      setReports(reportList)
      setComments(initialComments)
      setGenerated(true)
      toast.success(`Report cards generated for ${reportList.length} students`)
    } catch (err) {
      console.error('Error generating report cards:', err)
      toast.error('Failed to generate report cards')
    }
  }

  const handleCommentChange = (studentId: string, field: 'classTeacher' | 'hm', value: string) => {
    setComments(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }))
  }

  const handleSuggestComment = (studentId: string, position: number) => {
    const auto = getAutoComment(position)
    setComments(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], classTeacher: auto, hm: auto },
    }))
  }

  const handlePrintReport = (report: StudentReport) => {
    const studentComment = comments[report.studentId] || { classTeacher: '', hm: '' }
    const schoolName = school?.name || 'School Name'
    const schoolColor = school?.primary_color || '#002045'
    const logoUrl = school?.logo_url || ''

    const subjectRows = report.subjects.map(s =>
      `<tr>
        <td style="padding:6px 10px;border:1px solid #ddd">${s.name}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:center">${s.score}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;font-weight:bold">${s.grade}</td>
      </tr>`
    ).join('')

    const feeBlock = report.feeBalance > 0
      ? `<div style="background:#fff3f3;border:1px solid #fca5a5;border-radius:8px;padding:10px;margin-top:12px;text-align:center">
           <strong style="color:#dc2626">Fees outstanding: UGX ${report.feeBalance.toLocaleString()}</strong>
         </div>`
      : ''

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`<html><head><title>Report Card - ${report.name}</title><style>
      body{font-family:Arial,sans-serif;padding:20px;max-width:700px;margin:0 auto}
      .header{text-align:center;border-bottom:3px solid ${schoolColor};padding-bottom:15px;margin-bottom:15px}
      .logo{max-width:80px;max-height:60px;margin-bottom:10px}
      .school-name{font-size:22px;font-weight:bold;color:${schoolColor}}
      .school-info{font-size:11px;color:#666;margin:3px 0}
      .report-title{font-size:16px;font-weight:bold;color:${schoolColor};margin:10px 0}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:10px 0;font-size:13px}
      .info-grid div{padding:4px 0}
      .info-label{color:#888;display:inline-block;width:120px}
      .info-value{font-weight:bold}
      table{width:100%;border-collapse:collapse;margin:10px 0}
      th{background:${schoolColor}15;padding:8px 10px;border:1px solid #ddd;text-align:left;font-size:12px;text-transform:uppercase}
      .summary{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin:15px 0}
      .summary-card{border:1px solid #ddd;border-radius:8px;padding:10px;text-align:center}
      .summary-value{font-size:20px;font-weight:bold;color:${schoolColor}}
      .summary-label{font-size:10px;color:#888;text-transform:uppercase}
      .comment-box{border:1px solid #ddd;border-radius:8px;padding:10px;margin:8px 0}
      .comment-label{font-size:11px;font-weight:bold;text-transform:uppercase;color:#888;margin-bottom:4px}
      .footer{text-align:center;margin-top:25px;font-size:11px;color:#999;border-top:2px solid ${schoolColor};padding-top:15px}
    </style></head><body>
      <div class="header">
        ${logoUrl ? `<img src="${logoUrl}" class="logo" alt="${schoolName}">` : ''}
        <div class="school-name">${schoolName}</div>
        <div class="school-info">Tel: ${school?.phone || ''} | Email: ${school?.email || ''}</div>
        <div class="report-title">STUDENT REPORT CARD</div>
        <div class="school-info">Term ${currentTerm}, ${academicYear}</div>
      </div>
      <div class="info-grid">
        <div><span class="info-label">Student Name:</span> <span class="info-value">${report.name}</span></div>
        <div><span class="info-label">Student No:</span> <span class="info-value">${report.studentNumber}</span></div>
        <div><span class="info-label">Class:</span> <span class="info-value">${report.className}</span></div>
        <div><span class="info-label">Gender:</span> <span class="info-value">${report.gender === 'M' ? 'Male' : 'Female'}</span></div>
      </div>
      <table>
        <thead>
          <tr><th>Subject</th><th style="text-align:center">Score</th><th style="text-align:center">Grade</th></tr>
        </thead>
        <tbody>${subjectRows}</tbody>
      </table>
      <div class="summary">
        <div class="summary-card"><div class="summary-value">${report.totalMarks}/${report.maxMarks}</div><div class="summary-label">Total</div></div>
        <div class="summary-card"><div class="summary-value">${report.average}%</div><div class="summary-label">Average</div></div>
        <div class="summary-card"><div class="summary-value">${report.position}</div><div class="summary-label">Position</div></div>
        <div class="summary-card"><div class="summary-value">${report.division}</div><div class="summary-label">Division</div></div>
      </div>
      <div class="comment-box">
        <div class="comment-label">Class Teacher's Comment</div>
        <div>${studentComment.classTeacher || report.classTeacherComment}</div>
      </div>
      <div class="comment-box">
        <div class="comment-label">Headteacher's Comment</div>
        <div>${studentComment.hm || report.hmComment}</div>
      </div>
      ${feeBlock}
      <div class="footer">
        <div>Generated by Omuto SMS</div>
      </div>
    </body></html>`)
    printWindow.document.close()
    printWindow.print()
  }

  const handleSendSms = async (report: StudentReport) => {
    const studentComment = comments[report.studentId] || { classTeacher: '', hm: '' }
    const feeText = report.feeBalance > 0 ? ` Fees outstanding: ${report.feeBalance.toLocaleString()} UGX.` : ''
    const smsBody = `${selectedClassName} Term ${currentTerm} Report: ${report.name} - Total: ${report.totalMarks}/${report.maxMarks}, Position: ${report.position}/${reports.length}, Division: ${report.division}.${feeText}`

    try {
      setSendingSms(true)
      const { supabase: sb } = await import('@/lib/supabase')
      const student = filteredStudents.find(s => s.id === report.studentId)
      const phone = student?.parent_phone

      if (!phone) {
        toast.error('No parent phone number found')
        return
      }

      // Log SMS to messages table
      await sb.from('messages').insert({
        school_id: school?.id,
        recipient_phone: phone,
        message: smsBody,
        status: 'sent',
        type: 'report_card',
      })

      toast.success(`SMS sent to ${phone}`)
    } catch (err) {
      console.error('Error sending SMS:', err)
      toast.error('Failed to send SMS')
    } finally {
      setSendingSms(false)
    }
  }

  const displayedReports = useMemo(() => {
    if (hideWithFees) return reports.filter(r => r.feeBalance === 0)
    return reports
  }, [reports, hideWithFees])

  const stats = useMemo(() => {
    const withFees = reports.filter(r => r.feeBalance > 0).length
    const avgTotal = reports.length > 0 ? Math.round(reports.reduce((s, r) => s + r.average, 0) / reports.length) : 0
    const div1 = reports.filter(r => r.division === 'Division 1').length
    return { withFees, avgTotal, div1 }
  }, [reports])

  return (
    <div className="content">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="ph-title">Report Cards</div>
          <div className="ph-sub">Generate and manage student report cards</div>
        </div>
        <div className="ph-actions">
          {generated && (
            <button onClick={() => window.print()} className="btn btn-ghost">
              <MaterialIcon icon="print" style={{ fontSize: '16px' }} />
              Print All
            </button>
          )}
          <button onClick={handleGenerate} className="btn btn-primary">
            <MaterialIcon icon="description" style={{ fontSize: '16px' }} />
            Generate Report Cards
          </button>
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/5 mb-5">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Select Class</label>
            {classes.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">No classes available</div>
            ) : (
              <select value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); setGenerated(false); setReports([]) }} className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20">
                <option value="">Select Class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Term</label>
            <div className="bg-surface-container-low rounded-xl py-3 px-4 text-sm font-bold text-primary">Term {currentTerm}, {academicYear}</div>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Students</label>
            <div className="bg-surface-container-low rounded-xl py-3 px-4 text-sm font-bold text-primary">{filteredStudents.length} students</div>
          </div>
        </div>
      </div>

      {/* Stats after generation */}
      {generated && reports.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-5">
          <div className="bg-surface-container-lowest p-5 rounded-xl border-t-4 border-primary">
            <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Class Average</div>
            <div className="font-headline font-extrabold text-2xl text-primary">{stats.avgTotal}%</div>
          </div>
          <div className="bg-surface-container-lowest p-5 rounded-xl border-t-4 border-green-500">
            <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Division 1</div>
            <div className="font-headline font-extrabold text-2xl text-green-600">{stats.div1} students</div>
          </div>
          <div className="bg-surface-container-lowest p-5 rounded-xl border-t-4 border-red-500">
            <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Fee Defaulters</div>
            <div className="font-headline font-extrabold text-2xl text-red-600">{stats.withFees} students</div>
          </div>
          <div className="bg-surface-container-lowest p-5 rounded-xl border-t-4 border-tertiary">
            <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Total Students</div>
            <div className="font-headline font-extrabold text-2xl text-on-surface">{reports.length}</div>
          </div>
        </div>
      )}

      {/* Fee filter checkbox */}
      {generated && (
        <div className="flex items-center gap-3 mb-5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hideWithFees}
              onChange={(e) => setHideWithFees(e.target.checked)}
              className="w-4 h-4 rounded border-outline-variant accent-primary"
            />
            <span className="text-sm font-semibold text-on-surface-variant">Hide students with outstanding fees</span>
          </label>
        </div>
      )}

      {/* Report Cards Table */}
      {generated && displayedReports.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-outline-variant/5">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-left">
                  <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Student</th>
                  <th className="px-4 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-center">Total</th>
                  <th className="px-4 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-center">Average</th>
                  <th className="px-4 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-center">Position</th>
                  <th className="px-4 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-center">Division</th>
                  <th className="px-4 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Fees</th>
                  <th className="px-4 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Comments</th>
                  <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {displayedReports.map((report) => {
                  const studentComment = comments[report.studentId] || { classTeacher: '', hm: '' }
                  return (
                    <tr key={report.studentId} className="hover:bg-surface-bright transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white" style={{ background: report.gender === 'M' ? 'var(--navy, #002045)' : 'var(--red, #c0392b)' }}>
                            {report.name.split(' ').map(n => n.charAt(0)).join('').slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-bold text-sm text-primary">{report.name}</div>
                            <div className="text-xs text-on-surface-variant font-mono">{report.studentNumber}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="font-black text-lg text-primary">{report.totalMarks}</span>
                        <span className="text-xs text-on-surface-variant">/{report.maxMarks}</span>
                      </td>
                      <td className="px-4 py-4 text-center font-bold">{report.average}%</td>
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white font-black text-sm">{report.position}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${report.division === 'Division 1' ? 'bg-green-100 text-green-700' : report.division === 'Division 2' ? 'bg-blue-100 text-blue-700' : report.division === 'Division 3' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                          {report.division}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {report.feeBalance > 0 ? (
                          <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                            {report.feeBalance.toLocaleString()} UGX
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">Clear</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-1.5 max-w-[260px]">
                          <div>
                            <label className="text-[10px] font-bold uppercase text-on-surface-variant">Class Teacher</label>
                            <input
                              type="text"
                              value={studentComment.classTeacher}
                              onChange={(e) => handleCommentChange(report.studentId, 'classTeacher', e.target.value)}
                              className="w-full bg-surface-container-low rounded-lg py-1.5 px-2.5 text-xs border-none focus:ring-2 focus:ring-primary/20"
                              placeholder="Class teacher comment..."
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase text-on-surface-variant">Headteacher</label>
                            <input
                              type="text"
                              value={studentComment.hm}
                              onChange={(e) => handleCommentChange(report.studentId, 'hm', e.target.value)}
                              className="w-full bg-surface-container-low rounded-lg py-1.5 px-2.5 text-xs border-none focus:ring-2 focus:ring-primary/20"
                              placeholder="HM comment..."
                            />
                          </div>
                          <button onClick={() => handleSuggestComment(report.studentId, report.position)} className="text-[10px] font-bold text-primary hover:underline">
                            Auto-suggest
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={() => handlePrintReport(report)} title="Print Report Card" className="p-2 rounded-lg hover:bg-surface-container text-on-surface-variant">
                            <MaterialIcon icon="print" className="text-lg" />
                          </button>
                          <button onClick={() => handleSendSms(report)} disabled={sendingSms} title="Send SMS" className="p-2 rounded-lg hover:bg-surface-container text-on-surface-variant disabled:opacity-40">
                            <MaterialIcon icon="sms" className="text-lg" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state before generation */}
      {!generated && (
        <div className="bg-surface-container-lowest p-12 rounded-xl text-center">
          <MaterialIcon className="text-4xl text-on-surface-variant mx-auto mb-4" style={{ display: 'block' }}>summarize</MaterialIcon>
          <h3 className="font-headline font-bold text-lg text-primary mb-2">Generate Report Cards</h3>
          <p className="text-on-surface-variant text-sm">Select a class and click Generate to create report cards with positions, divisions, and comments.</p>
        </div>
      )}

      {/* No students after filter */}
      {generated && displayedReports.length === 0 && reports.length > 0 && (
        <div className="bg-surface-container-lowest p-12 rounded-xl text-center">
          <MaterialIcon className="text-4xl text-on-surface-variant mx-auto mb-4" style={{ display: 'block' }}>filter_alt_off</MaterialIcon>
          <h3 className="font-headline font-bold text-lg text-primary mb-2">All Hidden</h3>
          <p className="text-on-surface-variant text-sm">All students have outstanding fees. Uncheck the filter to view.</p>
        </div>
      )}
    </div>
  )
}

'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/index'
import { EmptyState } from '@/components/EmptyState'
import { computeSubjectTotal, generateAutoComment, getPLEGrade } from '@/lib/automation'

interface StudentReport {
  student_id: string
  first_name: string
  last_name: string
  class_id: string
  class_name: string
  subjects: Array<{
    name: string
    code: string
    ca1: number
    ca2: number
    ca3: number
    ca4: number
    project: number
    exam: number
    totalCA: number
    finalScore: number
    grade: string
    comment: string
  }>
  overall: {
    average: number
    grade: string
    division: string
    position: number
  }
}

export default function BatchReportsPage() {
  const { school, isDemo } = useAuth()
  const toast = useToast()
  const [classes, setClasses] = useState<any[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [term, setTerm] = useState('1')
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear().toString())
  const [generating, setGenerating] = useState(false)
  const [reports, setReports] = useState<StudentReport[]>([])
  const [progress, setProgress] = useState(0)
  const [step, setStep] = useState<'select' | 'generating' | 'preview' | 'done'>('select')

  useEffect(() => {
    fetchClasses()
  }, [])

  const fetchClasses = async () => {
    if (!school?.id) return
    const { data } = await supabase.from('classes').select('id, name, level').eq('school_id', school.id).order('name')
    if (data) setClasses(data)
  }

  const generateReports = useCallback(async () => {
    if (!selectedClass || !school?.id) {
      toast.error('Please select a class')
      return
    }

    setGenerating(true)
    setStep('generating')
    setProgress(0)

    try {
      // Fetch students in class
      const { data: students } = await supabase
        .from('students')
        .select('id, first_name, last_name, class_id, classes(name)')
        .eq('school_id', school.id)
        .eq('class_id', selectedClass)
        .eq('status', 'active')

      if (!students || students.length === 0) {
        toast.error('No active students found in this class')
        setGenerating(false)
        setStep('select')
        return
      }

      // Fetch subjects
      const { data: subjects } = await supabase
        .from('subjects')
        .select('id, name, code')
        .eq('school_id', school.id)

      if (!subjects || subjects.length === 0) {
        toast.error('No subjects found. Add subjects first.')
        setGenerating(false)
        setStep('select')
        return
      }

      const studentReports: StudentReport[] = []

      for (let i = 0; i < students.length; i++) {
        const student = students[i]
        setProgress(Math.round(((i + 1) / students.length) * 100))

        const subjectReports = []

        for (const subject of subjects) {
          // Fetch grades for this student and subject
          const { data: grades } = await supabase
            .from('grades')
            .select('assessment_type, score')
            .eq('student_id', student.id)
            .eq('subject_id', subject.id)
            .eq('term', parseInt(term))
            .eq('academic_year', academicYear)

          const ca1 = grades?.find(g => g.assessment_type === 'ca1')?.score || 0
          const ca2 = grades?.find(g => g.assessment_type === 'ca2')?.score || 0
          const ca3 = grades?.find(g => g.assessment_type === 'ca3')?.score || 0
          const ca4 = grades?.find(g => g.assessment_type === 'ca4')?.score || 0
          const project = grades?.find(g => g.assessment_type === 'project')?.score || 0
          const exam = grades?.find(g => g.assessment_type === 'exam')?.score || 0

          const { totalCA, finalScore, grade } = computeSubjectTotal(ca1, ca2, ca3, ca4, project, exam)
          const comment = generateAutoComment(finalScore, subject.name, `${student.first_name} ${student.last_name}`)

          subjectReports.push({
            name: subject.name,
            code: subject.code,
            ca1, ca2, ca3, ca4, project, exam,
            totalCA,
            finalScore,
            grade,
            comment,
          })
        }

        const scores = subjectReports.map(s => s.finalScore)
        const average = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
        const overallGrade = getPLEGrade(average)

        studentReports.push({
          student_id: student.id,
          first_name: student.first_name,
          last_name: student.last_name,
          class_id: student.class_id,
          class_name: (student as any).classes?.name || '',
          subjects: subjectReports,
          overall: {
            average,
            grade: overallGrade,
            division: 'N/A',
            position: 0,
          },
        })
      }

      // Calculate positions
      studentReports.sort((a, b) => b.overall.average - a.overall.average)
      studentReports.forEach((report, index) => {
        report.overall.position = index + 1
      })

      setReports(studentReports)
      setStep('done')
      toast.success(`Generated ${studentReports.length} report cards`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate reports')
      setStep('select')
    } finally {
      setGenerating(false)
    }
  }, [selectedClass, term, academicYear, school?.id, toast])

  const handleDownloadAll = async () => {
    toast.info('Downloading all reports as PDF...')
    // In production, use jsPDF to batch generate
    for (const report of reports) {
      console.log(`Generating PDF for ${report.first_name} ${report.last_name}`)
    }
  }

  const handleSendSMS = async () => {
    toast.info('Sending report card ready notifications...')
    // Integrate with SMS automation
    const { sendReportCardReady } = await import('@/lib/sms-automation')
    for (const report of reports) {
      await sendReportCardReady({
        studentId: report.student_id,
        term: parseInt(term),
        schoolId: school?.id,
        isDemo,
      })
    }
    toast.success('SMS notifications sent')
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Batch Report Cards"
        subtitle="Generate report cards for an entire class at once"
      />

      {step === 'select' && (
        <Card>
          <CardBody>
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="label">Class</label>
                  <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input">
                    <option value="">Select class...</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Term</label>
                  <select value={term} onChange={(e) => setTerm(e.target.value)} className="input">
                    <option value="1">Term 1</option>
                    <option value="2">Term 2</option>
                    <option value="3">Term 3</option>
                  </select>
                </div>
                <div>
                  <label className="label">Academic Year</label>
                  <input type="text" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className="input" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={generateReports} disabled={!selectedClass} variant="primary">
                  <MaterialIcon icon="auto_fix_high" />
                  Generate Reports
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {step === 'generating' && (
        <Card>
          <CardBody>
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MaterialIcon icon="hourglass_top" className="text-blue-600 animate-pulse" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Generating Report Cards...</h3>
              <p className="text-sm text-gray-500 mb-6">Computing grades, positions, and comments</p>
              <div className="max-w-md mx-auto">
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div className="bg-blue-600 h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-sm text-gray-500 mt-2">{progress}% complete</p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {step === 'done' && (
        <div className="space-y-4">
          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleDownloadAll} variant="primary">
              <MaterialIcon icon="download" />
              Download All PDFs
            </Button>
            <Button onClick={handleSendSMS} variant="secondary">
              <MaterialIcon icon="sms" />
              Send SMS Notifications
            </Button>
            <Button onClick={() => { setStep('select'); setReports([]) }} variant="ghost">
              <MaterialIcon icon="refresh" />
              Generate New Batch
            </Button>
          </div>

          {/* Summary */}
          <Card>
            <CardBody>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{reports.length}</div>
                  <div className="text-sm text-gray-500">Reports Generated</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{reports.filter(r => r.overall.average >= 70).length}</div>
                  <div className="text-sm text-gray-500">Distinction (70%+)</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{reports.filter(r => r.overall.average >= 50 && r.overall.average < 70).length}</div>
                  <div className="text-sm text-gray-500">Credit (50-69%)</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{reports.filter(r => r.overall.average < 50).length}</div>
                  <div className="text-sm text-gray-500">Below Average</div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Student List */}
          <div className="space-y-2">
            {reports.map((report, index) => (
              <Card key={report.student_id}>
                <CardBody>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-600">
                        {report.overall.position}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{report.first_name} {report.last_name}</div>
                        <div className="text-sm text-gray-500">{report.class_name}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-lg font-bold" style={{ color: report.overall.average >= 70 ? '#16a34a' : report.overall.average >= 50 ? '#2563eb' : '#dc2626' }}>
                          {report.overall.average}%
                        </div>
                        <div className="text-sm text-gray-500">{report.overall.grade}</div>
                      </div>
                      <div className="text-right hidden sm:block">
                        <div className="text-sm text-gray-500">{report.subjects.length} subjects</div>
                        <div className="text-xs text-gray-400">
                          {report.subjects.filter(s => s.finalScore >= 70).length} distinction
                        </div>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

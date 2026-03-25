'use client'
import { useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useStudents, useClasses } from '@/lib/hooks'
import { getUNEBGrade, getUNEBDivision } from '@/lib/grading'
import ReportCard from '@/components/reports/ReportCard'
import type { ReportCard as ReportCardType } from '@/types'
import { supabase } from '@/lib/supabase'

export default function ReportsPage() {
  const { school } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const { students, loading: studentsLoading } = useStudents(school?.id)
  const { classes } = useClasses(school?.id)
  
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [reportData, setReportData] = useState<ReportCardType | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)

  const filteredStudents = students.filter(s => {
    const matchesSearch = `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         s.student_number?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesClass = selectedClass === '' || s.class_id === selectedClass
    return matchesSearch && matchesClass
  })

  const fetchStudentReport = useCallback(async (studentId: string) => {
    try {
      setLoadingReport(true)
      const student = students.find(s => s.id === studentId)
      if (!student) return

      const { data: grades } = await supabase
        .from('grades')
        .select('*, subjects(name, code)')
        .eq('student_id', studentId)
        .eq('term', currentTerm)
        .eq('academic_year', academicYear)

      const { data: attendance } = await supabase
        .from('attendance')
        .select('status')
        .eq('student_id', studentId)

      // Group grades by subject
      const subjectGrades: Record<string, {name: string, code: string, scores: Record<string, number>}> = {}
      grades?.forEach(g => {
        const subjectName = (g.subjects as {name: string, code: string})?.name || 'Unknown'
        const subjectCode = (g.subjects as {name: string, code: string})?.code || ''
        if (!subjectGrades[subjectName]) {
          subjectGrades[subjectName] = { name: subjectName, code: subjectCode, scores: {} }
        }
        subjectGrades[subjectName].scores[g.assessment_type] = Number(g.score || 0)
      })

      const subjects = Object.values(subjectGrades).map(sg => {
        const ca1 = sg.scores['ca1'] || 0
        const ca2 = sg.scores['ca2'] || 0
        const ca3 = sg.scores['ca3'] || 0
        const ca4 = sg.scores['ca4'] || 0
        const project = sg.scores['project'] || 0
        const exam = sg.scores['exam'] || 0
        const caAvg = (ca1 + ca2 + ca3 + ca4 + project) / 5
        const final = (caAvg * 0.8) + (exam * 0.2)
        return {
          name: sg.name,
          code: sg.code,
          ca1,
          ca2,
          ca3,
          ca4,
          project,
          exam,
          totalCA: caAvg,
          finalScore: final,
          grade: getUNEBGrade(final)
        }
      })

      const avgScore = subjects.length > 0 ? subjects.reduce((acc, s) => acc + s.finalScore, 0) / subjects.length : 0

      const totalAttendanceDays = attendance?.length || 0
      const presentDays = attendance?.filter(a => a.status === 'present').length || 0
      const absentDays = attendance?.filter(a => a.status === 'absent').length || 0
      const lateDays = attendance?.filter(a => a.status === 'late').length || 0

      setReportData({
        student: {
          first_name: student.first_name,
          last_name: student.last_name,
          student_number: student.student_number || 'N/A',
          gender: student.gender,
          classes: student.classes
        },
        school: {
          name: school?.name || 'Omuto School',
          district: school?.district || 'Uganda',
        },
        term: currentTerm,
        academicYear: academicYear,
        subjects,
        attendance: {
          total: totalAttendanceDays || 90,
          present: presentDays,
          absent: absentDays,
          late: lateDays,
        },
        overall: {
          average: Math.round(avgScore),
          grade: getUNEBGrade(avgScore),
          division: getUNEBDivision(avgScore)
        }
      })

      setSelectedStudentId(studentId)
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoadingReport(false)
    }
  }, [students, currentTerm, academicYear, school])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Generate and view student report cards</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search students..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input flex-1"
        />
        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input sm:w-48">
          <option value="">All Classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Student List */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Select Student</h2>
          {studentsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton w-10 h-10 rounded-full" />
                  <div className="flex-1">
                    <div className="skeleton w-32 h-4 mb-2" />
                    <div className="skeleton w-20 h-3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredStudents.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No students found</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredStudents.map((student) => (
                <button
                  key={student.id}
                  onClick={() => fetchStudentReport(student.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                    selectedStudentId === student.id 
                      ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700' 
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 dark:text-blue-300 font-semibold text-sm">
                      {student.first_name?.charAt(0)}{student.last_name?.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white">{student.first_name} {student.last_name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{student.student_number || student.classes?.name}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Report Card */}
        <div>
          {loadingReport ? (
            <div className="card flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : reportData ? (
            <ReportCard report={reportData} />
          ) : (
            <div className="card flex flex-col items-center justify-center h-64 text-center">
              <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400">Select a student to view their report card</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

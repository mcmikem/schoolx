'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useClasses, useSubjects } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

function getGrade(score: number) {
  if (score >= 80) return { grade: 'D1', color: 'text-green-600' }
  if (score >= 70) return { grade: 'D2', color: 'text-green-500' }
  if (score >= 65) return { grade: 'C3', color: 'text-blue-600' }
  if (score >= 60) return { grade: 'C4', color: 'text-blue-500' }
  if (score >= 55) return { grade: 'C5', color: 'text-yellow-600' }
  if (score >= 50) return { grade: 'C6', color: 'text-yellow-500' }
  if (score >= 45) return { grade: 'P7', color: 'text-orange-500' }
  if (score >= 40) return { grade: 'P8', color: 'text-orange-400' }
  return { grade: 'F9', color: 'text-red-500' }
}

export default function GradesPage() {
  const { school, user } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const toast = useToast()
  const { classes, loading: classesLoading } = useClasses(school?.id)
  const { subjects } = useSubjects(school?.id)
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [assessmentType, setAssessmentType] = useState('ca1')
  const [students, setStudents] = useState<Array<{id: string, first_name: string, last_name: string, student_number: string}>>([])
  const [gradesData, setGradesData] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function fetchData() {
      if (!selectedClass || !selectedSubject || !school?.id) return

      try {
        setLoading(true)

        const { data: studentsData } = await supabase
          .from('students')
          .select('*')
          .eq('school_id', school.id)
          .eq('class_id', selectedClass)
          .eq('status', 'active')
          .order('first_name')

        setStudents(studentsData || [])

        const { data: gradesData } = await supabase
          .from('grades')
          .select('*')
          .eq('class_id', selectedClass)
          .eq('subject_id', selectedSubject)
          .eq('term', currentTerm)
          .eq('academic_year', academicYear)

        const gradesMap: Record<string, number> = {}
        gradesData?.forEach((g: {student_id: string, assessment_type: string, score: number}) => {
          const key = `${g.student_id}_${g.assessment_type}`
          gradesMap[key] = Number(g.score)
        })
        setGradesData(gradesMap)
      } catch (err) {
        console.error('Error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [selectedClass, selectedSubject, school?.id, currentTerm, academicYear])

  const updateGrade = async (studentId: string, value: number) => {
    if (!user?.id || !selectedClass || !selectedSubject) return

    const key = `${studentId}_${assessmentType}`
    setGradesData(prev => ({ ...prev, [key]: value }))

    try {
      setSaving(true)
      const { error } = await supabase
        .from('grades')
        .upsert({
          student_id: studentId,
          subject_id: selectedSubject,
          class_id: selectedClass,
          assessment_type: assessmentType,
          score: value,
          max_score: 100,
          term: currentTerm,
          academic_year: academicYear,
          recorded_by: user.id,
        }, { onConflict: 'student_id,subject_id,assessment_type,term,academic_year' })

      if (error) throw error
    } catch (err) {
      console.error('Error saving grade:', err)
    } finally {
      setSaving(false)
    }
  }

  const getStudentGrade = (studentId: string, field: string) => {
    return gradesData[`${studentId}_${field}`] || 0
  }

  const getStudentAverage = (studentId: string) => {
    const ca1 = getStudentGrade(studentId, 'ca1')
    const ca2 = getStudentGrade(studentId, 'ca2')
    const ca3 = getStudentGrade(studentId, 'ca3')
    const ca4 = getStudentGrade(studentId, 'ca4')
    const project = getStudentGrade(studentId, 'project')
    const exam = getStudentGrade(studentId, 'exam')
    
    const caAvg = (ca1 + ca2 + ca3 + ca4 + project) / 5
    return Math.round((caAvg * 0.8) + (exam * 0.2))
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Grades</h1>
        <p className="text-gray-500 mt-1">Enter and manage student marks</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input sm:w-48">
          <option value="">Select Class</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="input sm:w-48">
          <option value="">Select Subject</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={assessmentType} onChange={(e) => setAssessmentType(e.target.value)} className="input sm:w-40">
          <option value="ca1">CA 1</option>
          <option value="ca2">CA 2</option>
          <option value="ca3">CA 3</option>
          <option value="ca4">CA 4</option>
          <option value="project">Project</option>
          <option value="exam">Exam</option>
        </select>
      </div>

      {!selectedClass || !selectedSubject ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Select class and subject</h3>
          <p className="text-gray-500">Choose a class and subject to enter grades</p>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card">
              <div className="skeleton w-full h-8" />
            </div>
          ))}
        </div>
      ) : students.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No students in this class</h3>
          <p className="text-gray-500">Add students to this class first</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Score</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const score = getStudentGrade(student.id, assessmentType)
                const gradeInfo = getGrade(score)
                return (
                  <tr key={student.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-semibold text-xs">
                            {student.first_name?.charAt(0)}{student.last_name?.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">{student.first_name} {student.last_name}</div>
                          <div className="text-xs text-gray-500">{student.student_number}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={score || ''}
                        onChange={(e) => updateGrade(student.id, Number(e.target.value))}
                        className="input w-24 text-center"
                        placeholder="0"
                      />
                    </td>
                    <td>
                      <span className={`font-bold ${gradeInfo.color}`}>{gradeInfo.grade}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

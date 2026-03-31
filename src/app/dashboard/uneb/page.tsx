'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useStudents, useClasses } from '@/lib/hooks'
import { getUCEGrade, getUCEDivision, getUACEGrade, getUACEPoints, getGradeForLevel } from '@/lib/grading'
import { supabase } from '@/lib/supabase'
import MaterialIcon from '@/components/MaterialIcon'

interface StudentResult {
  id: string
  name: string
  student_number: string
  class_name: string
  subjects: Array<{
    name: string
    code: string
    score: number
    grade: string
  }>
  average: number
  grade: string
  division: string
  points?: number
}

export default function UNEBAnalysisPage() {
  const { school } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const { students } = useStudents(school?.id)
  const { classes } = useClasses(school?.id)
  
  const [results, setResults] = useState<StudentResult[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClass, setSelectedClass] = useState('')
  const [examType, setExamType] = useState<'ple' | 'uce' | 'uace'>('uce')

  const fetchResults = useCallback(async () => {
    if (!school?.id) return
    
    setLoading(true)
    try {
      let query = supabase
        .from('grades')
        .select('*, students(first_name, last_name, student_number, classes(name)), subjects(name, code)')
        .eq('school_id', school.id)
        .eq('term', currentTerm)
        .eq('academic_year', academicYear)
        .eq('assessment_type', 'exam')

      if (selectedClass) {
        query = query.eq('class_id', selectedClass)
      }

      const { data: grades } = await query

      if (!grades || grades.length === 0) {
        setResults([])
        setLoading(false)
        return
      }

      const studentMap = new Map<string, StudentResult>()
      
      grades.forEach((g: any) => {
        const studentId = g.student_id
        if (!studentMap.has(studentId)) {
          studentMap.set(studentId, {
            id: studentId,
            name: `${g.students?.first_name} ${g.students?.last_name}`,
            student_number: g.students?.student_number || '',
            class_name: g.students?.classes?.name || '',
            subjects: [],
            average: 0,
            grade: '',
            division: '',
          })
        }
        
        const student = studentMap.get(studentId)!
        const score = Number(g.score)
        const grade = examType === 'uace' ? getUACEGrade(score) : getUCEGrade(score)
        
        student.subjects.push({
          name: g.subjects?.name || '',
          code: g.subjects?.code || '',
          score,
          grade
        })
      })

      const processedResults: StudentResult[] = []
      
      studentMap.forEach((student) => {
        if (student.subjects.length > 0) {
          const avg = student.subjects.reduce((s, sub) => s + sub.score, 0) / student.subjects.length
          student.average = Math.round(avg)
          
          if (examType === 'uace') {
            const principalSubjects = student.subjects.slice(0, 3).map(s => s.grade)
            const subsidiarySubjects = student.subjects.slice(3).map(s => s.grade)
            const { points, division } = getUACEPoints(principalSubjects, subsidiarySubjects)
            student.points = points
            student.division = division
            student.grade = getUACEGrade(avg)
          } else {
            const gradeValues = student.subjects.map(s => s.grade)
            student.division = getUCEDivision(gradeValues)
            student.grade = examType === 'uce' ? getUCEGrade(avg) : getGradeForLevel(avg, 'primary')
          }
          
          processedResults.push(student)
        }
      })

      processedResults.sort((a, b) => b.average - a.average)
      setResults(processedResults)
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }, [school?.id, currentTerm, academicYear, selectedClass, examType])

  useEffect(() => {
    fetchResults()
  }, [fetchResults])

  const stats = useMemo(() => {
    if (results.length === 0) return null
    
    const divisionCounts: Record<string, number> = {}
    results.forEach(r => {
      divisionCounts[r.division] = (divisionCounts[r.division] || 0) + 1
    })

    const avgScore = results.reduce((s, r) => s + r.average, 0) / results.length
    const passRate = Math.round((results.filter(r => r.average >= 50).length / results.length) * 100)

    return {
      total: results.length,
      avgScore: Math.round(avgScore),
      passRate,
      divisions: divisionCounts,
      topScore: results[0]?.average || 0,
      lowestScore: results[results.length - 1]?.average || 0
    }
  }, [results])

  const getDivisionColor = (division: string) => {
    if (division === 'Division I') return 'bg-[#e8f5e9] text-[#006e1c]'
    if (division === 'Division II') return 'bg-[#e3f2fd] text-[#002045]'
    if (division === 'Division III') return 'bg-[#fff3e0] text-[#b86e00]'
    if (division === 'Division IV') return 'bg-[#fef3c7] text-[#d97706]'
    return 'bg-[#fef2f2] text-[#ba1a1a]'
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">UNEB Analysis</h1>
        <p className="text-[#5c6670] mt-1">
          {examType === 'uce' ? 'UCE (O-Level) Division Analysis' : 
           examType === 'uace' ? 'UACE (A-Level) Points Analysis' : 
           'PLE (Primary) Performance Analysis'}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <select 
            value={examType} 
            onChange={(e) => setExamType(e.target.value as 'ple' | 'uce' | 'uace')}
            className="input"
          >
            <option value="uce">O-Level (UCE)</option>
            <option value="uace">A-Level (UACE)</option>
            <option value="ple">Primary (PLE)</option>
          </select>
          <select 
            value={selectedClass} 
            onChange={(e) => setSelectedClass(e.target.value)}
            className="input"
          >
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map((i) => (
            <div key={i} className="h-16 bg-[#e8eaed] rounded-2xl"></div>
          ))}
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
              <div className="text-2xl font-bold text-[#002045]">{stats.total}</div>
              <div className="text-sm text-[#5c6670] mt-1">Candidates</div>
            </div>
            <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
              <div className="text-2xl font-bold text-[#002045]">{stats.avgScore}%</div>
              <div className="text-sm text-[#5c6670] mt-1">School Average</div>
            </div>
            <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
              <div className="text-2xl font-bold text-[#006e1c]">{stats.passRate}%</div>
              <div className="text-sm text-[#5c6670] mt-1">Pass Rate</div>
            </div>
            <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
              <div className="text-2xl font-bold text-[#002045]">{stats.topScore}%</div>
              <div className="text-sm text-[#5c6670] mt-1">Highest Score</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 mb-6">
            <h2 className="font-semibold text-[#191c1d] mb-4">Division Breakdown</h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {Object.entries(stats.divisions).sort().map(([div, count]) => (
                <div key={div} className={`p-4 rounded-xl ${getDivisionColor(div)}`}>
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-sm font-medium">{div}</div>
                  <div className="text-xs">{Math.round((count / stats.total) * 100)}%</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#e8eaed] overflow-hidden">
            <div className="p-6">
              <h2 className="font-semibold text-[#191c1d] mb-4">Student Results</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#f8fafb]">
                    <tr>
                      <th className="text-left p-3 text-sm font-semibold text-[#191c1d]">#</th>
                      <th className="text-left p-3 text-sm font-semibold text-[#191c1d]">Name</th>
                      <th className="text-left p-3 text-sm font-semibold text-[#191c1d]">Student No.</th>
                      <th className="text-left p-3 text-sm font-semibold text-[#191c1d]">Subjects</th>
                      <th className="text-left p-3 text-sm font-semibold text-[#191c1d]">Average</th>
                      <th className="text-left p-3 text-sm font-semibold text-[#191c1d]">Grade</th>
                      <th className="text-left p-3 text-sm font-semibold text-[#191c1d]">{examType === 'uace' ? 'Points' : 'Division'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((student, i) => (
                      <tr key={student.id} className="border-t border-[#e8eaed]">
                        <td className="p-3 text-[#5c6670]">{i + 1}</td>
                        <td className="p-3 font-medium text-[#191c1d]">{student.name}</td>
                        <td className="p-3 text-[#5c6670]">{student.student_number}</td>
                        <td className="p-3 text-[#191c1d]">{student.subjects.length}</td>
                        <td className="p-3 font-semibold text-[#191c1d]">{student.average}%</td>
                        <td className="p-3">
                          <span className={`font-bold ${
                            student.grade.startsWith('D') || student.grade === 'A' ? 'text-[#006e1c]' :
                            student.grade.startsWith('C') || student.grade === 'B' ? 'text-[#002045]' :
                            student.grade.startsWith('P') || student.grade === 'C' ? 'text-[#b86e00]' :
                            'text-[#ba1a1a]'
                          }`}>
                            {student.grade}
                          </span>
                        </td>
                        <td className="p-3">
                          {examType === 'uace' ? (
                            <span className="font-bold text-[#006e1c]">{student.points} pts</span>
                          ) : (
                            <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getDivisionColor(student.division)}`}>
                              {student.division}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-12 text-center">
          <MaterialIcon icon="school" className="text-4xl text-[#c4c6cf] mb-4" />
          <div className="text-[#5c6670]">No exam results found. Enter exam scores first.</div>
        </div>
      )}
    </div>
  )
}

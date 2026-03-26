'use client'
import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useStudents, useClasses } from '@/lib/hooks'
import { getUCEGrade, getUCEDivision, getUACEGrade, getUACEPoints, getGradeForLevel } from '@/lib/grading'
import { supabase } from '@/lib/supabase'

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

  useEffect(() => {
    fetchResults()
  }, [selectedClass, examType, school?.id, currentTerm, academicYear])

  const fetchResults = async () => {
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
  }

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
    if (division === 'Division I') return 'bg-green-100 text-green-700 border-green-200'
    if (division === 'Division II') return 'bg-blue-100 text-blue-700 border-blue-200'
    if (division === 'Division III') return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    if (division === 'Division IV') return 'bg-orange-100 text-orange-700 border-orange-200'
    return 'bg-red-100 text-red-700 border-red-200'
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">UNEB Analysis</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {examType === 'uce' ? 'UCE (O-Level) Division Analysis' : 
           examType === 'uace' ? 'UACE (A-Level) Points Analysis' : 
           'PLE (Primary) Performance Analysis'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <select 
          value={examType} 
          onChange={(e) => setExamType(e.target.value as any)}
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

      {loading ? (
        <div className="animate-pulse space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-200 rounded"></div>)}
        </div>
      ) : stats ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="stat-card">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Candidates</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.avgScore}%</div>
              <div className="stat-label">School Average</div>
            </div>
            <div className="stat-card">
              <div className="stat-value text-green-600">{stats.passRate}%</div>
              <div className="stat-label">Pass Rate</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.topScore}%</div>
              <div className="stat-label">Highest Score</div>
            </div>
          </div>

          {/* Division Breakdown */}
          <div className="card mb-6">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Division Breakdown</h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {Object.entries(stats.divisions).sort().map(([div, count]) => (
                <div key={div} className={`p-4 rounded-lg border ${getDivisionColor(div)}`}>
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-sm font-medium">{div}</div>
                  <div className="text-xs">{Math.round((count / stats.total) * 100)}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* Results Table */}
          <div className="card">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Student Results</h2>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Student No.</th>
                    <th>Subjects</th>
                    <th>Average</th>
                    <th>Grade</th>
                    <th>{examType === 'uace' ? 'Points' : 'Division'}</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((student, i) => (
                    <tr key={student.id}>
                      <td>{i + 1}</td>
                      <td className="font-medium">{student.name}</td>
                      <td className="text-gray-500">{student.student_number}</td>
                      <td>{student.subjects.length}</td>
                      <td className="font-semibold">{student.average}%</td>
                      <td>
                        <span className={`font-bold ${
                          student.grade.startsWith('D') || student.grade === 'A' ? 'text-green-600' :
                          student.grade.startsWith('C') || student.grade === 'B' ? 'text-blue-600' :
                          student.grade.startsWith('P') || student.grade === 'C' ? 'text-yellow-600' :
                          'text-red-500'
                        }`}>
                          {student.grade}
                        </span>
                      </td>
                      <td>
                        {examType === 'uace' ? (
                          <span className="font-bold text-green-600">{student.points} pts</span>
                        ) : (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getDivisionColor(student.division)}`}>
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
        </>
      ) : (
        <div className="card text-center py-12">
          <div className="text-gray-500">No exam results found. Enter exam scores first.</div>
        </div>
      )}
    </div>
  )
}

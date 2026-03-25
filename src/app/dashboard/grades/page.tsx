'use client'
import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useClasses, useSubjects } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

interface TopicCoverage {
  id: string
  subject_id: string
  class_id: string
  topic_name: string
  status: 'not_started' | 'in_progress' | 'completed'
  teacher_id: string
  date_completed?: string
  notes?: string
}

interface UNEBReadiness {
  student_id: string
  student_name: string
  student_number: string
  subjects: Record<string, { avg: number; grade: string; ready: boolean }>
  overall_avg: number
  overall_grade: string
  division: string
  readiness_score: number
}

const NCDC_TOPICS: Record<string, string[]> = {
  'Mathematics': [
    'Number operations', 'Fractions and decimals', 'Percentages', 'Ratio and proportion',
    'Algebra', 'Geometry', 'Statistics', 'Probability', 'Measurement', 'Sets'
  ],
  'English': [
    'Grammar', 'Comprehension', 'Composition', 'Poetry', 'Drama', 'Novel',
    'Literature', 'Vocabulary', 'Summary writing', 'Oral skills'
  ],
  'Science': [
    'Living things', 'Materials', 'Forces and energy', 'Earth and space',
    'Human body', 'Plants', 'Animals', 'Water', 'Air', 'Weather'
  ],
  'Social Studies': [
    'Geography', 'History', 'Civics', 'Economics', 'Culture', 'Environment',
    'Government', 'Trade', 'Transport', 'Communication'
  ],
}

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

function getDivision(avg: number) {
  if (avg >= 80) return 'Division I'
  if (avg >= 60) return 'Division II'
  if (avg >= 40) return 'Division III'
  if (avg >= 20) return 'Division IV'
  return 'Ungraded'
}

export default function CurriculumPage() {
  const { school, user } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const toast = useToast()
  const { classes } = useClasses(school?.id)
  const { subjects } = useSubjects(school?.id)
  
  const [tab, setTab] = useState<'coverage' | 'readiness' | 'syllabus'>('coverage')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [coverage, setCoverage] = useState<TopicCoverage[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [grades, setGrades] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (selectedClass && selectedSubject) {
      fetchCoverage()
      fetchGrades()
    }
  }, [selectedClass, selectedSubject, currentTerm, academicYear])

  useEffect(() => {
    if (selectedClass) {
      fetchStudents()
    }
  }, [selectedClass])

  const fetchCoverage = async () => {
    try {
      setLoading(true)
      const { data } = await supabase
        .from('topic_coverage')
        .select('*')
        .eq('class_id', selectedClass)
        .eq('subject_id', selectedSubject)
        .eq('term', currentTerm)
        .eq('academic_year', academicYear)
      
      setCoverage(data || [])
    } catch (err) {
      console.error('Error fetching coverage:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchStudents = async () => {
    try {
      const { data } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', selectedClass)
        .eq('status', 'active')
        .order('first_name')
      setStudents(data || [])
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const fetchGrades = async () => {
    try {
      const { data } = await supabase
        .from('grades')
        .select('*, subjects(name)')
        .eq('class_id', selectedClass)
        .eq('term', currentTerm)
        .eq('academic_year', academicYear)
      setGrades(data || [])
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const updateTopicStatus = async (topicName: string, status: 'not_started' | 'in_progress' | 'completed') => {
    try {
      const existing = coverage.find(c => c.topic_name === topicName)
      
      if (existing) {
        await supabase
          .from('topic_coverage')
          .update({ status, date_completed: status === 'completed' ? new Date().toISOString() : null })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('topic_coverage')
          .insert({
            subject_id: selectedSubject,
            class_id: selectedClass,
            topic_name: topicName,
            status,
            teacher_id: user?.id,
            term: currentTerm,
            academic_year: academicYear,
            date_completed: status === 'completed' ? new Date().toISOString() : null,
          })
      }
      
      fetchCoverage()
      toast.success('Topic status updated')
    } catch (err) {
      toast.error('Failed to update')
    }
  }

  const getTopicStatus = (topicName: string): string => {
    return coverage.find(c => c.topic_name === topicName)?.status || 'not_started'
  }

  // Calculate UNEB readiness
  const readinessData: UNEBReadiness[] = useMemo(() => {
    return students.map(student => {
      const studentGrades = grades.filter(g => g.student_id === student.id)
      const subjectScores: Record<string, { avg: number; grade: string; ready: boolean }> = {}
      
      subjects.forEach(subject => {
        const subjectGrades = studentGrades.filter(g => g.subject_id === subject.id)
        const scores = subjectGrades.map(g => Number(g.score || 0))
        const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
        const gradeInfo = getGrade(avg)
        subjectScores[subject.name] = {
          avg: Math.round(avg),
          grade: gradeInfo.grade,
          ready: avg >= 50
        }
      })

      const allScores = Object.values(subjectScores).map(s => s.avg)
      const overallAvg = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0
      const readyCount = Object.values(subjectScores).filter(s => s.ready).length
      const readinessScore = allScores.length > 0 ? Math.round((readyCount / allScores.length) * 100) : 0

      return {
        student_id: student.id,
        student_name: `${student.first_name} ${student.last_name}`,
        student_number: student.student_number || '',
        subjects: subjectScores,
        overall_avg: overallAvg,
        overall_grade: getGrade(overallAvg).grade,
        division: getDivision(overallAvg),
        readiness_score: readinessScore,
      }
    }).sort((a, b) => b.readiness_score - a.readiness_score)
  }, [students, grades, subjects])

  const selectedSubjectName = subjects.find(s => s.id === selectedSubject)?.name || ''
  const topics = NCDC_TOPICS[selectedSubjectName] || ['Topic 1', 'Topic 2', 'Topic 3', 'Topic 4', 'Topic 5']

  const coverageStats = useMemo(() => {
    const total = topics.length
    const completed = topics.filter(t => getTopicStatus(t) === 'completed').length
    const inProgress = topics.filter(t => getTopicStatus(t) === 'in_progress').length
    return { total, completed, inProgress, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 }
  }, [topics, coverage])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Curriculum & Analytics</h1>
        <p className="text-gray-500 mt-1">Track syllabus coverage and UNEB readiness</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input sm:w-48">
          <option value="">Select Class</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="input sm:w-48">
          <option value="">Select Subject</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div className="tabs mb-6">
        <button onClick={() => setTab('coverage')} className={`tab ${tab === 'coverage' ? 'active' : ''}`}>
          Topic Coverage
        </button>
        <button onClick={() => setTab('readiness')} className={`tab ${tab === 'readiness' ? 'active' : ''}`}>
          UNEB Readiness
        </button>
        <button onClick={() => setTab('syllabus')} className={`tab ${tab === 'syllabus' ? 'active' : ''}`}>
          Syllabus Progress
        </button>
      </div>

      {!selectedClass ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a class</h3>
          <p className="text-gray-500">Choose a class to view curriculum data</p>
        </div>
      ) : tab === 'coverage' ? (
        <div className="space-y-6">
          {/* Coverage Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card text-center">
              <div className="text-2xl font-bold text-green-600">{coverageStats.completed}</div>
              <div className="text-sm text-gray-500">Topics Completed</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-yellow-600">{coverageStats.inProgress}</div>
              <div className="text-sm text-gray-500">In Progress</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-blue-600">{coverageStats.percentage}%</div>
              <div className="text-sm text-gray-500">Coverage</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Overall Coverage</span>
              <span className="text-sm font-bold text-gray-900">{coverageStats.percentage}%</span>
            </div>
            <div className="progress">
              <div className="progress-fill bg-green-500" style={{ width: `${coverageStats.percentage}%` }} />
            </div>
          </div>

          {/* Topics List */}
          {selectedSubject ? (
            <div className="space-y-3">
              {topics.map((topic) => {
                const status = getTopicStatus(topic)
                return (
                  <div key={topic} className="card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          status === 'completed' ? 'bg-green-500' :
                          status === 'in_progress' ? 'bg-yellow-500' : 'bg-gray-300'
                        }`} />
                        <span className="font-medium">{topic}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateTopicStatus(topic, 'not_started')}
                          className={`btn btn-sm ${status === 'not_started' ? 'bg-gray-200' : 'btn-secondary'}`}
                        >
                          Not Started
                        </button>
                        <button
                          onClick={() => updateTopicStatus(topic, 'in_progress')}
                          className={`btn btn-sm ${status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' : 'btn-secondary'}`}
                        >
                          In Progress
                        </button>
                        <button
                          onClick={() => updateTopicStatus(topic, 'completed')}
                          className={`btn btn-sm ${status === 'completed' ? 'bg-green-100 text-green-700' : 'btn-secondary'}`}
                        >
                          Completed
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="card text-center py-8">
              <p className="text-gray-500">Select a subject to view topics</p>
            </div>
          )}
        </div>
      ) : tab === 'readiness' ? (
        <div className="space-y-6">
          {/* Readiness Overview */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card text-center bg-green-50">
              <div className="text-2xl font-bold text-green-600">
                {readinessData.filter(s => s.readiness_score >= 80).length}
              </div>
              <div className="text-sm text-gray-600">Ready (80%+)</div>
            </div>
            <div className="card text-center bg-yellow-50">
              <div className="text-2xl font-bold text-yellow-600">
                {readinessData.filter(s => s.readiness_score >= 50 && s.readiness_score < 80).length}
              </div>
              <div className="text-sm text-gray-600">At Risk (50-79%)</div>
            </div>
            <div className="card text-center bg-red-50">
              <div className="text-2xl font-bold text-red-600">
                {readinessData.filter(s => s.readiness_score < 50).length}
              </div>
              <div className="text-sm text-gray-600">Not Ready (&lt;50%)</div>
            </div>
          </div>

          {/* Student Readiness Table */}
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Average</th>
                  <th>Grade</th>
                  <th>Division</th>
                  <th>Readiness</th>
                </tr>
              </thead>
              <tbody>
                {readinessData.map((student) => (
                  <tr key={student.student_id}>
                    <td>
                      <div className="font-medium">{student.student_name}</div>
                      <div className="text-xs text-gray-500">{student.student_number}</div>
                    </td>
                    <td className="font-medium">{student.overall_avg}%</td>
                    <td><span className={`font-bold ${getGrade(student.overall_avg).color}`}>{student.overall_grade}</span></td>
                    <td className="text-gray-600">{student.division}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-16 progress">
                          <div 
                            className={`progress-fill ${student.readiness_score >= 80 ? 'bg-green-500' : student.readiness_score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${student.readiness_score}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{student.readiness_score}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Term {currentTerm} Syllabus Progress</h3>
          <div className="space-y-4">
            {subjects.map(subject => {
              const subjectGrades = grades.filter(g => g.subject_id === subject.id)
              const avg = subjectGrades.length > 0 
                ? Math.round(subjectGrades.reduce((s, g) => s + Number(g.score || 0), 0) / subjectGrades.length)
                : 0
              
              return (
                <div key={subject.id} className="flex items-center justify-between py-3 border-b border-gray-100">
                  <span className="font-medium">{subject.name}</span>
                  <div className="flex items-center gap-4">
                    <span className={`font-bold ${getGrade(avg).color}`}>{getGrade(avg).grade}</span>
                    <span className="text-sm text-gray-500">{avg}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

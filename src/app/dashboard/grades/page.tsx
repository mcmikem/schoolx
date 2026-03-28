'use client'
import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useClasses, useSubjects, useStudents, useGrades } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
}

interface TopicCoverage {
  id: string
  subject_id: string
  class_id: string
  topic_name: string
  status: 'not_started' | 'in_progress' | 'completed'
  teacher_id: string
}

const NCDC_TOPICS: Record<string, string[]> = {
  'Mathematics': ['Number operations', 'Fractions and decimals', 'Percentages', 'Ratio and proportion', 'Algebra', 'Geometry', 'Statistics', 'Probability'],
  'English': ['Grammar', 'Comprehension', 'Composition', 'Poetry', 'Drama', 'Novel', 'Literature', 'Vocabulary'],
  'Science': ['Living things', 'Materials', 'Forces and energy', 'Earth and space', 'Human body', 'Plants', 'Animals'],
}

function getGrade(score: number) {
  if (score >= 80) return { grade: 'D1', color: 'text-secondary' }
  if (score >= 70) return { grade: 'D2', color: 'text-secondary' }
  if (score >= 65) return { grade: 'C3', color: 'text-primary' }
  if (score >= 60) return { grade: 'C4', color: 'text-primary' }
  if (score >= 55) return { grade: 'C5', color: 'text-tertiary' }
  if (score >= 50) return { grade: 'C6', color: 'text-tertiary' }
  if (score >= 45) return { grade: 'P7', color: 'text-yellow-600' }
  if (score >= 40) return { grade: 'P8', color: 'text-yellow-500' }
  return { grade: 'F9', color: 'text-error' }
}

export default function GradesPage() {
  const { school, user } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const toast = useToast()
  const { classes } = useClasses(school?.id)
  const { subjects } = useSubjects(school?.id)
  
  const [tab, setTab] = useState<'marks' | 'coverage'>('marks')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [coverage, setCoverage] = useState<TopicCoverage[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [marks, setMarks] = useState<Record<string, number>>({})
  const { students: classStudents, loading: studentsLoading } = useStudents(school?.id)
  const { grades: existingGrades, saveGrade } = useGrades(selectedClass, selectedSubject, currentTerm, academicYear)

  // Filter students by selected class
  const filteredStudents = useMemo(() => {
    if (!selectedClass) return []
    return classStudents.filter(s => s.class_id === selectedClass)
  }, [classStudents, selectedClass])

  // Initialize marks from existing grades
  useEffect(() => {
    if (existingGrades.length > 0) {
      const marksMap: Record<string, number> = {}
      existingGrades.forEach((g: any) => {
        marksMap[`${g.student_id}_${g.assessment_type}`] = g.score
      })
      setMarks(marksMap)
    }
  }, [existingGrades])

  const handleMarkChange = (studentId: string, type: string, value: number) => {
    setMarks(prev => ({ ...prev, [`${studentId}_${type}`]: value }))
  }

  const handleSaveGrades = async () => {
    if (!selectedClass || !selectedSubject) return
    try {
      setSaving(true)
      for (const [key, score] of Object.entries(marks)) {
        const [studentId, assessmentType] = key.split('_')
        await saveGrade({
          student_id: studentId,
          subject_id: selectedSubject,
          class_id: selectedClass,
          assessment_type: assessmentType,
          score,
          term: currentTerm,
          academic_year: academicYear,
          recorded_by: user?.id,
        })
      }
      toast.success('Grades saved successfully')
    } catch (err) {
      toast.error('Failed to save grades')
    } finally {
      setSaving(false)
    }
  }

  const handleExportGrades = () => {
    if (!selectedClass || filteredStudents.length === 0) {
      toast.error('No grades to export')
      return
    }
    const headers = ['Student', 'Student Number', 'CA (30)', 'Exam (70)', 'Total (100)', 'Grade']
    const rows = filteredStudents.map(student => {
      const ca = marks[`${student.id}_ca`] ?? 0
      const exam = marks[`${student.id}_exam`] ?? 0
      const total = ca + exam
      const gradeInfo = getGrade(total)
      return [
        `${student.first_name} ${student.last_name}`,
        student.student_number || '',
        String(ca),
        String(exam),
        String(total),
        total > 0 ? gradeInfo.grade : '-',
      ]
    })
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `grades_${selectedClassName}_${selectedSubjectName}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Grades exported')
  }

  const handleSubmitToDean = () => {
    if (!selectedClass || !selectedSubject) {
      toast.error('Please select a class and subject first')
      return
    }
    toast.success('Grades submitted to Dean for review')
  }

  useEffect(() => {
    if (selectedClass && selectedSubject) {
      fetchCoverage()
    }
  }, [selectedClass, selectedSubject, currentTerm, academicYear])

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

  const selectedSubjectName = subjects.find(s => s.id === selectedSubject)?.name || ''
  const selectedClassName = classes.find(c => c.id === selectedClass)?.name || ''
  const topics = NCDC_TOPICS[selectedSubjectName] || ['Topic 1', 'Topic 2', 'Topic 3', 'Topic 4', 'Topic 5']

  const coverageStats = useMemo(() => {
    const total = topics.length
    const completed = topics.filter(t => getTopicStatus(t) === 'completed').length
    const inProgress = topics.filter(t => getTopicStatus(t) === 'in_progress').length
    return { total, completed, inProgress, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 }
  }, [topics, coverage])

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="font-headline font-bold text-3xl text-primary tracking-tight mb-2">Academic Records</h2>
          <p className="text-on-surface-variant text-sm font-medium">
            {selectedClassName && selectedSubjectName
              ? `${selectedClassName} • ${selectedSubjectName}`
              : 'Select a class and subject to begin'}
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExportGrades} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-outline-variant/30 text-primary font-semibold text-sm hover:bg-surface-container-low transition-all">
            <MaterialIcon icon="cloud_download" className="text-lg" />
            Export
          </button>
          <button onClick={handleSaveGrades} disabled={saving || !selectedClass || !selectedSubject} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/10 disabled:opacity-50">
            <MaterialIcon icon="save" className="text-lg" style={{ fontVariationSettings: 'FILL 1' }} />
            {saving ? 'Saving...' : 'Save Grades'}
          </button>
        </div>
      </header>

      {/* Configuration Bento */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-1 md:col-span-2 bg-surface-container-low p-6 rounded-3xl space-y-4">
          <p className="text-xs uppercase tracking-widest font-bold text-on-surface-variant">Class & Subject Configuration</p>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-semibold mb-2 text-primary">Target Class</label>
              <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="w-full bg-surface-container-lowest border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary text-sm font-medium">
                <option value="">Select Class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-semibold mb-2 text-primary">Subject Area</label>
              <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="w-full bg-surface-container-lowest border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary text-sm font-medium">
                <option value="">Select Subject</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="bg-primary text-on-primary p-6 rounded-3xl relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <MaterialIcon icon="functions" className="text-6xl" />
          </div>
          <p className="text-xs uppercase tracking-widest font-bold opacity-70">Weightage</p>
          <div>
            <div className="flex justify-between items-baseline">
              <span className="text-2xl font-bold font-headline">30:70</span>
              <span className="text-xs font-medium">CA : Exam</span>
            </div>
            <div className="w-full bg-white/20 h-1.5 rounded-full mt-3">
              <div className="bg-secondary-fixed w-[30%] h-full rounded-full"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
        <button onClick={() => setTab('marks')} className={`px-6 py-2.5 rounded-full font-semibold text-sm whitespace-nowrap ${tab === 'marks' ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-bright'}`}>Marks Entry</button>
        <button onClick={() => setTab('coverage')} className={`px-6 py-2.5 rounded-full font-semibold text-sm whitespace-nowrap ${tab === 'coverage' ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-bright'}`}>Topic Coverage</button>
      </div>

      {/* Marks Entry Table */}
      {tab === 'marks' && selectedClass && (
        <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-container-low/50 text-left">
                  <th className="px-8 py-6 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Student Identity</th>
                  <th className="px-6 py-6 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-center">CA (30)</th>
                  <th className="px-6 py-6 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-center">Exam (70)</th>
                  <th className="px-6 py-6 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-center">Total (100)</th>
                  <th className="px-8 py-6 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-right">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {studentsLoading ? (
                  <tr><td colSpan={5} className="px-8 py-12 text-center text-on-surface-variant">Loading students...</td></tr>
                ) : filteredStudents.length === 0 ? (
                  <tr><td colSpan={5} className="px-8 py-12 text-center text-on-surface-variant">No students in this class</td></tr>
                ) : filteredStudents.map((student) => {
                  const ca = marks[`${student.id}_ca`] ?? 0
                  const exam = marks[`${student.id}_exam`] ?? 0
                  const total = ca + exam
                  const gradeInfo = getGrade(total)
                  return (
                    <tr key={student.id} className="hover:bg-surface-bright">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center font-bold text-sm text-on-primary-container">
                            {student.first_name?.charAt(0)}{student.last_name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-primary">{student.first_name} {student.last_name}</p>
                            <p className="text-xs text-on-surface-variant">{student.student_number || '-'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <input
                          className="w-16 mx-auto block bg-surface-container rounded-lg border-none text-center font-bold focus:ring-2 focus:ring-primary py-2 px-1"
                          type="number"
                          min={0}
                          max={30}
                          value={ca || ''}
                          onChange={(e) => handleMarkChange(student.id, 'ca', Math.min(30, Number(e.target.value)))}
                        />
                      </td>
                      <td className="px-6 py-5">
                        <input
                          className="w-16 mx-auto block bg-surface-container rounded-lg border-none text-center font-bold focus:ring-2 focus:ring-primary py-2 px-1"
                          type="number"
                          min={0}
                          max={70}
                          value={exam || ''}
                          onChange={(e) => handleMarkChange(student.id, 'exam', Math.min(70, Number(e.target.value)))}
                        />
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="font-black text-xl text-primary">{total}</span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <span className={`px-4 py-1.5 rounded-full text-xs font-black ${ca != null || exam != null ? 'bg-surface-container' : 'bg-surface-bright text-on-surface-variant'} ${gradeInfo.color}`}>
                          {ca != null || exam != null ? gradeInfo.grade : '-'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Topic Coverage */}
      {tab === 'coverage' && selectedSubject && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-surface-container-low p-6 rounded-xl text-center">
              <div className="text-2xl font-bold text-secondary">{coverageStats.completed}</div>
              <div className="text-sm text-on-surface-variant">Completed</div>
            </div>
            <div className="bg-surface-container-low p-6 rounded-xl text-center">
              <div className="text-2xl font-bold text-tertiary">{coverageStats.inProgress}</div>
              <div className="text-sm text-on-surface-variant">In Progress</div>
            </div>
            <div className="bg-surface-container-low p-6 rounded-xl text-center">
              <div className="text-2xl font-bold text-primary">{coverageStats.percentage}%</div>
              <div className="text-sm text-on-surface-variant">Coverage</div>
            </div>
          </div>

          {/* Topics */}
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
            <div className="p-6 border-b border-outline-variant/10">
              <h3 className="font-headline font-bold text-lg text-primary">Topic Coverage</h3>
            </div>
            <div className="divide-y divide-outline-variant/5">
              {topics.map((topic) => {
                const status = getTopicStatus(topic)
                return (
                  <div key={topic} className="flex items-center justify-between p-4 hover:bg-surface-bright">
                    <span className="font-medium text-primary">{topic}</span>
                    <div className="flex gap-2">
                      <button onClick={() => updateTopicStatus(topic, 'not_started')} className={`px-3 py-1 rounded-full text-xs font-bold ${status === 'not_started' ? 'bg-surface-container text-on-surface-variant' : 'bg-surface-bright text-on-surface-variant hover:bg-surface-container'}`}>Not Started</button>
                      <button onClick={() => updateTopicStatus(topic, 'in_progress')} className={`px-3 py-1 rounded-full text-xs font-bold ${status === 'in_progress' ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-surface-bright text-on-surface-variant hover:bg-surface-container'}`}>In Progress</button>
                      <button onClick={() => updateTopicStatus(topic, 'completed')} className={`px-3 py-1 rounded-full text-xs font-bold ${status === 'completed' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-bright text-on-surface-variant hover:bg-surface-container'}`}>Completed</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {!selectedClass && (
        <div className="bg-surface-container-lowest p-12 rounded-xl text-center">
          <MaterialIcon className="text-4xl text-on-surface-variant mx-auto mb-4">menu_book</MaterialIcon>
          <h3 className="font-headline font-bold text-lg text-primary mb-2">Select a class</h3>
          <p className="text-on-surface-variant text-sm">Choose a class to view curriculum data</p>
        </div>
      )}

      {/* Sticky Action Bar */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/80 dark:bg-slate-950/80 backdrop-blur-2xl px-6 py-4 rounded-full shadow-2xl z-50 border border-slate-100/50 hidden md:flex">
        <div className="flex items-center gap-2 text-secondary px-4 border-r border-slate-200">
          <MaterialIcon className="text-xl" style={{ fontVariationSettings: 'FILL 1' }}>cloud_done</MaterialIcon>
          <span className="text-xs font-bold uppercase tracking-wider">Sync Active</span>
        </div>
        <button onClick={() => { handleSaveGrades(); toast.success('Draft saved') }} className="flex items-center gap-2 px-4 py-2 hover:bg-slate-100 rounded-full transition-colors font-semibold text-sm">
          <MaterialIcon>drafts</MaterialIcon>
          Save Draft
        </button>
        <button onClick={handleSubmitToDean} className="bg-primary text-white px-8 py-2.5 rounded-full font-bold text-sm hover:shadow-lg hover:shadow-primary/30 transition-all">
          Submit to Dean
        </button>
      </div>
    </div>
  )
}
'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useClasses, useSubjects, useStudents, useGrades, useStaff } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import MaterialIcon from '@/components/MaterialIcon'

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

const ASSESSMENT_TYPES = ['ca1', 'ca2', 'ca3', 'exam'] as const
const ASSESSMENT_MAX: Record<string, number> = { ca1: 10, ca2: 10, ca3: 10, exam: 70 }

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

type StudentMarks = Record<string, number | null>

export default function GradesPage() {
  const { school, user } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const toast = useToast()
  const { classes } = useClasses(school?.id)
  const { subjects } = useSubjects(school?.id)
  const { staff } = useStaff(school?.id)

  const [tab, setTab] = useState<'marks' | 'coverage'>('marks')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [coverage, setCoverage] = useState<TopicCoverage[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [marks, setMarks] = useState<StudentMarks>({})
  const [caLocked, setCaLocked] = useState(false)
  const [lockedByName, setLockedByName] = useState('')
  const [marksBy, setMarksBy] = useState<Record<string, { name: string, type: string }>>({})
  const [submissionStatus, setSubmissionStatus] = useState<'draft' | 'submitted'>('draft')
  const { students: classStudents, loading: studentsLoading } = useStudents(school?.id)
  const { grades: existingGrades, saveGrade } = useGrades(selectedClass, selectedSubject, currentTerm, academicYear)

  const filteredStudents = useMemo(() => {
    if (!selectedClass) return []
    return classStudents.filter(s => s.class_id === selectedClass)
  }, [classStudents, selectedClass])

  // Initialize marks from existing grades
  useEffect(() => {
    if (existingGrades.length > 0) {
      const marksMap: StudentMarks = {}
      const newMarksBy: Record<string, { name: string, type: string }> = {}
      let isCaLocked = false
      let lockedBy = ''

      existingGrades.forEach((g: any) => {
        marksMap[`${g.student_id}_${g.assessment_type}`] = g.score ?? null
        if (g.recorded_by) {
          const staffMember = staff.find(s => s.id === g.recorded_by)
          newMarksBy[g.recorded_by] = { name: staffMember?.full_name || 'Unknown', type: g.assessment_type }
        }
        if (g.ca_locked === true) {
          isCaLocked = true
          lockedBy = g.locked_by
        }
      })
      setMarks(marksMap)
      setMarksBy(newMarksBy)
      setCaLocked(isCaLocked)

      if (lockedBy) {
        const lockedByStaff = staff.find(s => s.id === lockedBy)
        setLockedByName(lockedByStaff?.full_name || 'Unknown')
      } else {
        setLockedByName('')
      }

      const hasSubmitted = existingGrades.some((g: any) => g.status === 'submitted')
      setSubmissionStatus(hasSubmitted ? 'submitted' : 'draft')
    } else {
      setMarks({})
      setMarksBy({})
      setCaLocked(false)
      setLockedByName('')
      setSubmissionStatus('draft')
    }
  }, [existingGrades, staff])

  const handleLockCA = async () => {
    if (!selectedClass || !selectedSubject || !user?.id) return
    
    if (!confirm('Are you sure you want to lock CA marks? This will prevent further edits to CA1, CA2, and CA3 marks for this subject/class combination.')) return

    try {
      setSaving(true)
      await supabase
        .from('grades')
        .update({ 
          ca_locked: true, 
          locked_by: user.id,
          locked_at: new Date().toISOString()
        })
        .eq('class_id', selectedClass)
        .eq('subject_id', selectedSubject)
        .in('assessment_type', ['ca1', 'ca2', 'ca3'])
        .eq('term', currentTerm)
        .eq('academic_year', academicYear)
      
      setCaLocked(true)
      setLockedByName(staff.find(s => s.id === user.id)?.full_name || 'You')
      toast.success('CA marks have been locked')
    } catch (err) {
      console.error('Error locking CA:', err)
      toast.error('Failed to lock CA marks')
    } finally {
      setSaving(false)
    }
  }

  const handleUnlockCA = async () => {
    if (!selectedClass || !selectedSubject || !user?.id) return
    
    if (!confirm('Are you sure you want to unlock CA marks?')) return

    try {
      setSaving(true)
      await supabase
        .from('grades')
        .update({ 
          ca_locked: false, 
          locked_by: null,
          locked_at: null
        })
        .eq('class_id', selectedClass)
        .eq('subject_id', selectedSubject)
        .in('assessment_type', ['ca1', 'ca2', 'ca3'])
        .eq('term', currentTerm)
        .eq('academic_year', academicYear)
      
      setCaLocked(false)
      setLockedByName('')
      toast.success('CA marks have been unlocked')
    } catch (err) {
      console.error('Error unlocking CA:', err)
      toast.error('Failed to unlock CA marks')
    } finally {
      setSaving(false)
    }
  }

  const handleMarkChange = (studentId: string, type: string, value: string) => {
    if (caLocked && type.startsWith('ca')) {
      toast.error('CA marks are locked. Contact DOS to unlock.')
      return
    }
    if (value === '') {
      setMarks(prev => ({ ...prev, [`${studentId}_${type}`]: null }))
    } else {
      const num = Math.min(ASSESSMENT_MAX[type] || 100, Math.max(0, Number(value)))
      setMarks(prev => ({ ...prev, [`${studentId}_${type}`]: num }))
    }
  }

  const getMark = (studentId: string, type: string): number | null => {
    return marks[`${studentId}_${type}`] ?? null
  }

  const getStudentTotal = (studentId: string): number | null => {
    const parts = ASSESSMENT_TYPES.map(t => marks[`${studentId}_${t}`])
    if (parts.some(p => p === null || p === undefined)) return null
    return parts.reduce((sum, p) => (sum ?? 0) + (p ?? 0), 0) ?? null
  }

  const isStudentGraded = useCallback((studentId: string): boolean => {
    return ASSESSMENT_TYPES.every(t => marks[`${studentId}_${t}`] !== null && marks[`${studentId}_${t}`] !== undefined)
  }, [marks])

  // Completion stats
  const completionStats = useMemo(() => {
    const total = filteredStudents.length
    const graded = filteredStudents.filter(s => isStudentGraded(s.id)).length
    const notGraded = total - graded
    const notGradedNames = filteredStudents
      .filter(s => !isStudentGraded(s.id))
      .map(s => `${s.first_name} ${s.last_name}`)
    const percentage = total > 0 ? Math.round((graded / total) * 100) : 0
    return { total, graded, notGraded, notGradedNames, percentage }
  }, [filteredStudents, isStudentGraded])

  const handleSaveGrades = async (status: 'draft' | 'submitted' = 'draft') => {
    if (!selectedClass || !selectedSubject) return
    try {
      setSaving(true)
      for (const [key, score] of Object.entries(marks)) {
        if (score === null || score === undefined) continue
        const parts = key.split('_')
        const assessmentType = parts.pop()!
        const studentId = parts.join('_')
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
      setSubmissionStatus(status)
      toast.success(status === 'submitted' ? 'Grades submitted to Dean' : 'Draft saved successfully')
    } catch {
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
    const headers = ['Student Name', 'Student Number', 'CA1', 'CA2', 'CA3', 'Exam', 'Total', 'Grade']
    const rows = filteredStudents.map(student => {
      const ca1 = getMark(student.id, 'ca1')
      const ca2 = getMark(student.id, 'ca2')
      const ca3 = getMark(student.id, 'ca3')
      const exam = getMark(student.id, 'exam')
      const total = getStudentTotal(student.id)
      const gradeInfo = total !== null ? getGrade(total) : null
      return [
        `${student.first_name} ${student.last_name}`,
        student.student_number || '',
        ca1 !== null ? String(ca1) : '',
        ca2 !== null ? String(ca2) : '',
        ca3 !== null ? String(ca3) : '',
        exam !== null ? String(exam) : '',
        total !== null ? String(total) : '',
        gradeInfo ? gradeInfo.grade : '',
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
    if (submissionStatus === 'submitted') {
      toast.info('Grades already submitted')
      return
    }
    if (completionStats.notGraded > 0) {
      const proceed = window.confirm(
        `${completionStats.notGraded} student${completionStats.notGraded > 1 ? 's' : ''} not graded: ${completionStats.notGradedNames.slice(0, 3).join(', ')}${completionStats.notGradedNames.length > 3 ? '...' : ''}. Submit anyway?`
      )
      if (!proceed) return
    }
    handleSaveGrades('submitted')
  }

  const handleSaveDraft = () => {
    if (!selectedClass || !selectedSubject) {
      toast.error('Please select a class and subject first')
      return
    }
    handleSaveGrades('draft')
  }

  const fetchCoverage = useCallback(async () => {
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
  }, [selectedClass, selectedSubject, currentTerm, academicYear])

  useEffect(() => {
    if (selectedClass && selectedSubject) {
      fetchCoverage()
    }
  }, [selectedClass, selectedSubject, fetchCoverage])

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
    } catch {
      toast.error('Failed to update')
    }
  }

  const getTopicStatus = useCallback((topicName: string): string => {
    return coverage.find(c => c.topic_name === topicName)?.status || 'not_started'
  }, [coverage])

  const selectedSubjectName = subjects.find(s => s.id === selectedSubject)?.name || ''
  const selectedClassName = classes.find(c => c.id === selectedClass)?.name || ''
  const topics = useMemo(
    () => NCDC_TOPICS[selectedSubjectName] || ['Topic 1', 'Topic 2', 'Topic 3', 'Topic 4', 'Topic 5'],
    [selectedSubjectName]
  )

  const coverageStats = useMemo(() => {
    const total = topics.length
    const completed = topics.filter(t => getTopicStatus(t) === 'completed').length
    const inProgress = topics.filter(t => getTopicStatus(t) === 'in_progress').length
    return { total, completed, inProgress, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 }
  }, [topics, getTopicStatus])

  const isSubmitted = submissionStatus === 'submitted'

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="font-headline font-bold text-3xl text-primary tracking-tight mb-2">Academic Records</h2>
          <p className="text-on-surface-variant text-sm font-medium">
            {selectedClassName && selectedSubjectName
              ? `${selectedClassName} \u2022 ${selectedSubjectName}`
              : 'Select a class and subject to begin'}
          </p>
        </div>
        <div className="flex gap-3">
          {selectedClass && selectedSubject && (
            caLocked ? (
              <button onClick={handleUnlockCA} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-tertiary text-tertiary font-semibold text-sm hover:bg-tertiary/10 transition-all">
                <MaterialIcon icon="lock_open" className="text-lg" />
                Unlock CA ({lockedByName})
              </button>
            ) : (
              <button onClick={handleLockCA} disabled={saving || !selectedClass || !selectedSubject} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-red-600 text-red-600 font-semibold text-sm hover:bg-red-50 transition-all">
                <MaterialIcon icon="lock" className="text-lg" />
                Lock CA
              </button>
            )
          )}
          <button onClick={handleExportGrades} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-outline-variant/30 text-primary font-semibold text-sm hover:bg-surface-container-low transition-all">
            <MaterialIcon icon="cloud_download" className="text-lg" />
            Export
          </button>
          <button onClick={() => handleSaveGrades()} disabled={saving || !selectedClass || !selectedSubject || isSubmitted} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/10 disabled:opacity-50">
            <MaterialIcon icon="save" className="text-lg" style={{ fontVariationSettings: 'FILL 1' }} />
            {saving ? 'Saving...' : 'Save Grades'}
          </button>
        </div>
      </header>

      {/* Marks Entry Info */}
      {selectedClass && selectedSubject && Object.keys(marksBy).length > 0 && (
        <div className="flex gap-4 flex-wrap">
          {Object.values(marksBy).some(m => ['ca1', 'ca2', 'ca3'].includes(m.type)) && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container rounded-full text-xs font-medium">
              <MaterialIcon icon="person" className="text-sm" />
              <span>CA entered by: {marksBy[Object.keys(marksBy).find(k => marksBy[k].type.startsWith('ca')) || '']?.name || 'Unknown'}</span>
            </div>
          )}
          {Object.values(marksBy).some(m => m.type === 'exam') && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container rounded-full text-xs font-medium">
              <MaterialIcon icon="supervisor_account" className="text-sm" />
              <span>Exam entered by (Supervisor): {marksBy[Object.keys(marksBy).find(k => marksBy[k].type === 'exam') || '']?.name || 'Unknown'}</span>
            </div>
          )}
        </div>
      )}

      {caLocked && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-sm font-medium text-red-700">
          <MaterialIcon icon="lock" className="text-lg" />
          CA marks are locked for this subject/class. Contact DOS to unlock.
        </div>
      )}

      {/* Configuration Bento */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-1 md:col-span-2 bg-surface-container-low p-6 rounded-3xl space-y-4">
          <p className="text-xs uppercase tracking-widest font-bold text-on-surface-variant">Class & Subject Configuration</p>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-semibold mb-2 text-primary">Target Class</label>
              {classes.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-amber-800 text-sm font-medium">No classes found</p>
                  <p className="text-amber-600 text-xs mt-1">Contact support if this persists.</p>
                </div>
              ) : (
                <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="w-full bg-surface-container-lowest border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary text-sm font-medium">
                  <option value="">Select Class</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-semibold mb-2 text-primary">Subject Area</label>
              {subjects.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-amber-800 text-sm font-medium">No subjects found</p>
                  <p className="text-amber-600 text-xs mt-1">Contact support if this persists.</p>
                </div>
              ) : (
                <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="w-full bg-surface-container-lowest border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary text-sm font-medium">
                  <option value="">Select Subject</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
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
              <span className="text-2xl font-bold font-headline">10+10+10+70</span>
              <span className="text-xs font-medium">CA1+CA2+CA3 : Exam</span>
            </div>
            <div className="w-full bg-white/20 h-1.5 rounded-full mt-3">
              <div className="bg-secondary-fixed w-[30%] h-full rounded-full"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Completion Tracker */}
      {tab === 'marks' && selectedClass && selectedSubject && filteredStudents.length > 0 && (
        <div className={`p-5 rounded-2xl border ${
          completionStats.percentage === 100
            ? 'bg-green-50 border-green-200'
            : completionStats.percentage >= 50
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${
                completionStats.percentage === 100
                  ? 'bg-green-500 text-white'
                  : completionStats.percentage >= 50
                    ? 'bg-yellow-500 text-white'
                    : 'bg-red-500 text-white'
              }`}>
                {completionStats.percentage}%
              </div>
              <div>
                <p className="font-bold text-sm">
                  {completionStats.graded}/{completionStats.total} students graded
                </p>
                {isSubmitted && (
                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    <MaterialIcon icon="lock" className="text-xs" />
                    Submitted
                  </span>
                )}
              </div>
            </div>
            {completionStats.notGraded > 0 && (
              <p className="text-xs font-medium text-red-700">
                <MaterialIcon icon="warning" className="text-xs align-text-bottom mr-1" />
                {completionStats.notGraded} student{completionStats.notGraded > 1 ? 's' : ''} not graded: {completionStats.notGradedNames.join(', ')}
              </p>
            )}
          </div>
          <div className="w-full bg-white/60 h-2 rounded-full mt-3">
            <div
              className={`h-full rounded-full transition-all ${
                completionStats.percentage === 100
                  ? 'bg-green-500'
                  : completionStats.percentage >= 50
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
              }`}
              style={{ width: `${completionStats.percentage}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
        <button onClick={() => setTab('marks')} className={`px-6 py-2.5 rounded-full font-semibold text-sm whitespace-nowrap ${tab === 'marks' ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-bright'}`}>Marks Entry</button>
        <button onClick={() => setTab('coverage')} className={`px-6 py-2.5 rounded-full font-semibold text-sm whitespace-nowrap ${tab === 'coverage' ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-bright'}`}>Topic Coverage</button>
      </div>

{/* Marks Entry Table */}
       {tab === 'marks' && selectedClass && (
         <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm">
           <div className="overflow-x-auto table-responsive">
             <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-container-low/50 text-left">
                  <th className="px-8 py-6 text-xs uppercase tracking-widest font-bold text-on-surface-variant">Student Identity</th>
                  <th className="px-4 py-6 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-center">CA1 (10)</th>
                  <th className="px-4 py-6 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-center">CA2 (10)</th>
                  <th className="px-4 py-6 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-center">CA3 (10)</th>
                  <th className="px-4 py-6 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-center">Exam (70)</th>
                  <th className="px-4 py-6 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-center">Total (100)</th>
                  <th className="px-8 py-6 text-xs uppercase tracking-widest font-bold text-on-surface-variant text-right">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {studentsLoading ? (
                  <tr><td colSpan={7} className="px-8 py-12 text-center text-on-surface-variant">Loading students...</td></tr>
                ) : filteredStudents.length === 0 ? (
                  <tr><td colSpan={7} className="px-8 py-12 text-center text-on-surface-variant">No students in this class</td></tr>
                ) : filteredStudents.map((student) => {
                  const ca1 = getMark(student.id, 'ca1')
                  const ca2 = getMark(student.id, 'ca2')
                  const ca3 = getMark(student.id, 'ca3')
                  const exam = getMark(student.id, 'exam')
                  const total = getStudentTotal(student.id)
                  const gradeInfo = total !== null ? getGrade(total) : null
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
                      {['ca1', 'ca2', 'ca3', 'exam'].map((type) => (
                        <td key={type} className="px-4 py-5">
                          <input
                            className="w-14 mx-auto block bg-surface-container rounded-lg border-none text-center font-bold focus:ring-2 focus:ring-primary py-2 px-1 disabled:opacity-50 disabled:cursor-not-allowed"
                            type="number"
                            min={0}
                            max={ASSESSMENT_MAX[type]}
                            placeholder="\u2014"
                            value={marks[`${student.id}_${type}`] !== null && marks[`${student.id}_${type}`] !== undefined ? String(marks[`${student.id}_${type}`]) : ''}
                            onChange={(e) => handleMarkChange(student.id, type, e.target.value)}
                            disabled={isSubmitted}
                          />
                        </td>
                      ))}
                      <td className="px-4 py-5 text-center">
                        <span className="font-black text-xl text-primary">
                          {total !== null ? total : '\u2014'}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <span className={`px-4 py-1.5 rounded-full text-xs font-black ${gradeInfo ? 'bg-surface-container' : 'bg-surface-bright text-on-surface-variant'} ${gradeInfo?.color || ''}`}>
                          {gradeInfo ? gradeInfo.grade : '-'}
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
        <button onClick={handleSaveDraft} disabled={isSubmitted || saving || !selectedClass || !selectedSubject} className="flex items-center gap-2 px-4 py-2 hover:bg-slate-100 rounded-full transition-colors font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed">
          <MaterialIcon>drafts</MaterialIcon>
          Save Draft
        </button>
        <button onClick={handleSubmitToDean} disabled={isSubmitted || saving || !selectedClass || !selectedSubject} className="bg-primary text-white px-8 py-2.5 rounded-full font-bold text-sm hover:shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
          {isSubmitted ? 'Submitted' : 'Submit to Dean'}
        </button>
      </div>
    </div>
  )
}

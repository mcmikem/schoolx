'use client'
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useStudents, useClasses, useSubjects } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { generateAutoComment, getGradeLabel } from '@/lib/automation'
import { supabase } from '@/lib/supabase'
import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/index'
import { Tabs, TabPanel } from '@/components/ui/Tabs'

export default function CommentsPage() {
  const { school, user, isDemo } = useAuth()
  const { students } = useStudents(school?.id)
  const { classes } = useClasses(school?.id)
  const { subjects } = useSubjects(school?.id, false)
  const toast = useToast()

  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [grades, setGrades] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [comments, setComments] = useState<Record<string, string>>({})
  const [tab, setTab] = useState<'generate' | 'review'>('generate')
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)

  const filteredStudents = useMemo(() =>
    students.filter(s => s.class_id === selectedClass),
    [students, selectedClass]
  )

  const loadGrades = useCallback(async () => {
    if (!selectedClass || !selectedSubject || !school?.id) return
    setLoading(true)
    setComments({})
    setSavedCount(0)
    try {
      if (isDemo) {
        const mockGrades = filteredStudents.map(s => ({
          student_id: s.id,
          subject_id: selectedSubject,
          assessment_type: 'exam',
          score: Math.floor(Math.random() * 60) + 30,
          max_score: 100,
        }))
        setGrades(mockGrades)
      } else {
        const { data } = await supabase
          .from('grades')
          .select('student_id, assessment_type, score, max_score')
          .eq('class_id', selectedClass)
          .eq('subject_id', selectedSubject)
        setGrades(data || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [selectedClass, selectedSubject, school?.id, isDemo, filteredStudents])

  useEffect(() => { loadGrades() }, [loadGrades])

  const studentScore = useCallback((studentId: string) => {
    const studentGrades = grades.filter(g => g.student_id === studentId)
    if (studentGrades.length === 0) return null
    const avg = studentGrades.reduce((sum, g) => sum + (g.score || 0), 0) / studentGrades.length
    return Math.round(avg)
  }, [grades])

  const generateAllComments = () => {
    const subject = subjects.find(s => s.id === selectedSubject)?.name || 'this subject'
    const newComments: Record<string, string> = {}
    filteredStudents.forEach(s => {
      const score = studentScore(s.id)
      if (score !== null) {
        newComments[s.id] = generateAutoComment(score, subject, `${s.first_name} ${s.last_name}`)
      }
    })
    setComments(newComments)
    toast.success(`Generated ${Object.keys(newComments).length} comments`)
    setTab('review')
  }

  const regenerateComment = (studentId: string) => {
    const student = students.find(s => s.id === studentId)
    if (!student) return
    const score = studentScore(studentId)
    if (score === null) return
    const subject = subjects.find(s => s.id === selectedSubject)?.name || 'this subject'
    setComments(prev => ({
      ...prev,
      [studentId]: generateAutoComment(score, subject, `${student.first_name} ${student.last_name}`)
    }))
  }

  const saveAllComments = async () => {
    if (!school?.id) return
    setSaving(true)
    let saved = 0
    try {
      for (const [studentId, comment] of Object.entries(comments)) {
        if (isDemo) {
          saved++
          continue
        }
        const { error } = await supabase.from('student_comments').upsert({
          school_id: school.id,
          student_id: studentId,
          subject_id: selectedSubject,
          comment,
          created_by: user?.id,
        }, { onConflict: 'student_id,subject_id' })
        if (!error) saved++
      }
      setSavedCount(saved)
      toast.success(`${saved} comments saved`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const perfColors: Record<string, string> = {
    excellent: 'bg-green-100 text-green-700',
    veryGood: 'bg-blue-100 text-blue-700',
    good: 'bg-indigo-100 text-indigo-700',
    average: 'bg-yellow-100 text-yellow-700',
    poor: 'bg-orange-100 text-orange-700',
    fail: 'bg-red-100 text-red-700',
  }

  const perfLabel = (score: number) => {
    if (score >= 80) return 'excellent'
    if (score >= 70) return 'veryGood'
    if (score >= 60) return 'good'
    if (score >= 50) return 'average'
    if (score >= 40) return 'poor'
    return 'fail'
  }

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Auto Comment Generator"
        subtitle="Generate report card comments from student scores in bulk"
      />

      {/* Config */}
      <Card className="mb-6">
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Class</label>
              <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input">
                <option value="">Select class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Subject</label>
              <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="input">
                <option value="">Select subject</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={generateAllComments} disabled={!selectedClass || !selectedSubject} variant="primary" className="w-full">
                <MaterialIcon icon="auto_awesome" />
                Generate All Comments
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {loading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="card"><div className="skeleton h-16 rounded-xl" /></div>)}</div>
      ) : filteredStudents.length === 0 ? (
        <div className="empty-state">
          <MaterialIcon icon="comment" className="text-4xl text-gray-400" />
          <h3 className="text-lg font-semibold mt-2">Select a class and subject</h3>
          <p className="text-sm text-gray-500">Comments will be generated based on student scores</p>
        </div>
      ) : (
        <div>
          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
            <button onClick={() => setTab('generate')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'generate' ? 'bg-white shadow-sm' : 'text-gray-500'}`}>
              Students ({filteredStudents.length})
            </button>
            <button onClick={() => setTab('review')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'review' ? 'bg-white shadow-sm' : 'text-gray-500'}`}>
              Generated ({Object.keys(comments).length})
            </button>
          </div>

          {tab === 'generate' && (
            <div className="space-y-2">
              {filteredStudents.map((student) => {
                const score = studentScore(student.id)
                return (
                  <Card key={student.id} className="overflow-hidden">
                    <CardBody>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-600 shrink-0">
                            {student.first_name?.[0]}{student.last_name?.[0]}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 truncate">{student.first_name} {student.last_name}</div>
                            <div className="text-sm text-gray-500">
                              {score !== null ? (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${perfColors[perfLabel(score)]}`}>
                                  {score}% — {getGradeLabel(score)}
                                </span>
                              ) : 'No scores recorded'}
                            </div>
                          </div>
                        </div>
                        {comments[student.id] && (
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-gray-500 max-w-[200px] truncate italic">"{comments[student.id]}"</span>
                            <button onClick={() => regenerateComment(student.id)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Regenerate">
                              <MaterialIcon icon="refresh" style={{ fontSize: 16 }} />
                            </button>
                          </div>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                )
              })}
            </div>
          )}

          {tab === 'review' && Object.keys(comments).length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm text-gray-500">
                  {savedCount > 0 && <span className="text-green-600 font-medium">{savedCount} saved</span>}
                </div>
                <Button onClick={saveAllComments} disabled={saving} variant="primary">
                  <MaterialIcon icon="save" />
                  {saving ? 'Saving...' : `Save ${Object.keys(comments).length} Comments`}
                </Button>
              </div>
              <div className="space-y-2">
                {Object.entries(comments).map(([studentId, comment]) => {
                  const student = students.find(s => s.id === studentId)
                  const score = studentScore(studentId)
                  return (
                    <Card key={studentId}>
                      <CardBody>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-gray-900">{student?.first_name} {student?.last_name}</span>
                              {score !== null && (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${perfColors[perfLabel(score)]}`}>
                                  {score}%
                                </span>
                              )}
                            </div>
                            <textarea
                              value={comment}
                              onChange={(e) => setComments(prev => ({ ...prev, [studentId]: e.target.value }))}
                              className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-700 resize-none"
                              rows={2}
                            />
                          </div>
                          <button onClick={() => regenerateComment(studentId)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg shrink-0" title="Regenerate">
                            <MaterialIcon icon="refresh" />
                          </button>
                        </div>
                      </CardBody>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {tab === 'review' && Object.keys(comments).length === 0 && (
            <div className="empty-state">
              <MaterialIcon icon="rate_review" className="text-4xl text-gray-400" />
              <h3 className="text-lg font-semibold mt-2">No comments generated yet</h3>
              <p className="text-sm text-gray-500">Click "Generate All Comments" to create comments for all students</p>
            </div>
          )}
        </div>
      )}
    </div>
    </PageErrorBoundary>
  )
}

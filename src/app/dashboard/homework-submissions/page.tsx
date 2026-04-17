'use client'
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/index'

interface HomeworkSubmission {
  id: string
  homework_id: string
  student_id: string
  submitted_at?: string
  marks?: number
  feedback?: string
  status: 'pending' | 'submitted' | 'graded'
  students?: { first_name: string; last_name: string; classes: { name: string }[] }
}

export default function HomeworkSubmissionsPage() {
  const { school } = useAuth()
  const toast = useToast()
  
  const [homeworks, setHomeworks] = useState<any[]>([])
  const [selectedHomework, setSelectedHomework] = useState<any>(null)
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [classFilter, setClassFilter] = useState('')
  const [classes, setClasses] = useState<any[]>([])

  const fetchClasses = useCallback(async () => {
    const { data } = await supabase.from('classes').select('*').eq('school_id', school?.id).order('name')
    setClasses(data || [])
  }, [school?.id])

  const fetchHomeworks = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('homework')
      .select('*, subjects(name), classes(name), users(full_name)')
      .eq('school_id', school?.id)
      .order('due_date', { ascending: false })

    if (classFilter) {
      query = query.eq('class_id', classFilter)
    }

    const { data } = await query
    setHomeworks(data || [])
    setLoading(false)
  }, [school?.id, classFilter])

  const fetchSubmissions = useCallback(async () => {
    if (!selectedHomework) return
    
    const { data: submissionsData } = await supabase
      .from('homework_submissions')
      .select('*, students(first_name, last_name, classes(name))')
      .eq('homework_id', selectedHomework.id)

    const { data: allStudents } = await supabase
      .from('students')
      .select('id, first_name, last_name, classes(name)')
      .eq('school_id', school?.id)
      .eq('class_id', selectedHomework.class_id)

    const submittedIds = new Set(submissionsData?.map(s => s.student_id) || [])
    const fullList = (allStudents || []).map(student => ({
      id: submittedIds.has(student.id) ? submissionsData?.find(s => s.student_id === student.id)?.id : null,
      student_id: student.id,
      homework_id: selectedHomework.id,
      status: submittedIds.has(student.id) ? 'submitted' : 'pending',
      submitted_at: submissionsData?.find(s => s.student_id === student.id)?.submitted_at,
      marks: submissionsData?.find(s => s.student_id === student.id)?.marks,
      students: student
    }))

    setSubmissions(fullList as HomeworkSubmission[])
  }, [selectedHomework, school?.id])

  useEffect(() => {
    if (school?.id) {
      fetchClasses()
      fetchHomeworks()
    }
  }, [school?.id, fetchClasses, fetchHomeworks])

  useEffect(() => {
    if (selectedHomework) {
      fetchSubmissions()
    }
  }, [selectedHomework, fetchSubmissions])

  const markSubmission = async (submission: any, marks: number, feedback: string) => {
    if (!submission.id) {
      await supabase.from('homework_submissions').insert({
        homework_id: selectedHomework.id,
        student_id: submission.student_id,
        submitted_at: new Date().toISOString(),
        marks,
        feedback,
        status: 'graded'
      })
    } else {
      await supabase.from('homework_submissions').update({ marks, feedback, status: 'graded' }).eq('id', submission.id)
    }
    toast.success('Submission graded')
    fetchSubmissions()
  }

  const pendingCount = submissions.filter(s => s.status === 'pending').length
  const submittedCount = submissions.filter(s => s.status === 'submitted').length
  const gradedCount = submissions.filter(s => s.status === 'graded').length

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Homework & Submissions"
        subtitle="Track homework and student submissions"
      />

      <Card className="p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Filter by Class</label>
            {classes.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">No classes available</div>
            ) : (
              <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm">
                <option value="">All Classes</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">&nbsp;</label>
            <Button onClick={fetchHomeworks}>
              Filter
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <div className="p-4 border-b border-[var(--border)]">
              <h3 className="font-semibold text-[var(--t1)]">Homework List</h3>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {homeworks.length === 0 && !loading ? (
                <div className="p-4 text-center text-[var(--t3)]">No homework found</div>
              ) : (
                homeworks.map(hw => (
                  <div 
                    key={hw.id}
                    onClick={() => setSelectedHomework(hw)}
                    className={`p-4 border-b border-[var(--border)] cursor-pointer transition-colors ${
                      selectedHomework?.id === hw.id ? 'bg-[var(--primary)]/10' : 'hover:bg-[var(--surface-container)]'
                    }`}
                  >
                    <div className="font-semibold text-sm text-[var(--t1)]">{hw.subjects?.name}</div>
                    <div className="text-xs text-[var(--t3)]">{hw.classes?.name} - Due {new Date(hw.due_date).toLocaleDateString()}</div>
                    <div className="text-xs mt-1 text-[var(--primary)]">{hw.marks} marks</div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {selectedHomework ? (
            <Card>
              <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-[var(--t1)]">{selectedHomework.subjects?.name} - Submissions</h3>
                  <p className="text-sm text-[var(--t3)]">{selectedHomework.classes?.name}</p>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-red-600">{pendingCount} Pending</span>
                  <span className="text-blue-600">{submittedCount} Submitted</span>
                  <span className="text-green-600">{gradedCount} Graded</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[var(--surface-container)]">
                      <th className="p-4 text-left text-sm font-semibold text-[var(--t1)]">Student</th>
                      <th className="p-4 text-left text-sm font-semibold text-[var(--t1)]">Status</th>
                      <th className="p-4 text-left text-sm font-semibold text-[var(--t1)]">Submitted</th>
                      <th className="p-4 text-left text-sm font-semibold text-[var(--t1)]">Marks</th>
                      <th className="p-4 text-left text-sm font-semibold text-[var(--t1)]">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map(sub => (
                      <tr key={sub.student_id} className="border-b border-[var(--border)]">
                        <td className="p-4 text-[var(--t1)]">{sub.students?.first_name} {sub.students?.last_name}</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            sub.status === 'graded' ? 'bg-green-100 text-green-800' :
                            sub.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {sub.status}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-[var(--t3)]">{sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : '-'}</td>
                        <td className="p-4 text-sm">
                          {sub.marks != null ? `${sub.marks}/${selectedHomework.total_marks}` : '-'}
                        </td>
                        <td className="p-4">
                          <GradingModal 
                            submission={sub} 
                            maxMarks={selectedHomework.total_marks}
                            onSave={(marks, feedback) => markSubmission(sub, marks, feedback)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <Card className="p-12 text-center">
              <MaterialIcon className="text-5xl text-[var(--t3)] opacity-50 mx-auto">assignment</MaterialIcon>
              <p className="mt-2 text-[var(--t3)]">Select homework to view submissions</p>
            </Card>
          )}
        </div>
      </div>
    </div>
    </PageErrorBoundary>
  )
}

function GradingModal({ submission, maxMarks, onSave }: { submission: any; maxMarks: number; onSave: (marks: number, feedback: string) => void }) {
  const [open, setOpen] = useState(false)
  const [marks, setMarks] = useState(submission.marks || 0)
  const [feedback, setFeedback] = useState(submission.feedback || '')

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Grade
      </Button>
      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-[var(--t1)] mb-4">Grade Submission</h3>
            <p className="text-sm text-[var(--t3)] mb-4">
              {submission.students?.first_name} {submission.students?.last_name}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Marks (out of {maxMarks})</label>
                <input 
                  type="number" 
                  min="0" 
                  max={maxMarks}
                  value={marks}
                  onChange={(e) => setMarks(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Feedback</label>
                <textarea 
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  rows={3}
                  placeholder="Give feedback to student..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => { onSave(marks, feedback); setOpen(false) }}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

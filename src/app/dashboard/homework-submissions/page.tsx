'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import MaterialIcon from '@/components/MaterialIcon'

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

    // Build full list with submission status
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
      // Create submission record
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
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Homework & Submissions</h1>
        <p className="text-[#5c6670] mt-1">Track homework and student submissions</p>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Filter by Class</label>
              {classes.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">No classes available</div>
              ) : (
                <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="input">
                  <option value="">All Classes</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">&nbsp;</label>
              <button onClick={fetchHomeworks} className="btn btn-primary">
                Filter
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Homework List */}
        <div className="lg:col-span-1">
          <div className="card">
            <div className="card-header">
              <div className="card-title">Homework List</div>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {homeworks.length === 0 && !loading ? (
                <div className="p-4 text-center text-[#5c6670]">No homework found</div>
              ) : (
                homeworks.map(hw => (
                  <div 
                    key={hw.id}
                    onClick={() => setSelectedHomework(hw)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: selectedHomework?.id === hw.id ? 'var(--navy-soft)' : 'transparent'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{hw.subjects?.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--t3)' }}>{hw.classes?.name} - Due {new Date(hw.due_date).toLocaleDateString()}</div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>
                      <span style={{ color: 'var(--navy)' }}>{hw.marks} marks</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Submissions */}
        <div className="lg:col-span-2">
          {selectedHomework ? (
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">{selectedHomework.subjects?.name} - Submissions</div>
                  <div className="card-sub">{selectedHomework.classes?.name}</div>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-red-600">{pendingCount} Pending</span>
                  <span className="text-blue-600">{submittedCount} Submitted</span>
                  <span className="text-green-600">{gradedCount} Graded</span>
                </div>
              </div>
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Status</th>
                      <th>Submitted</th>
                      <th>Marks</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map(sub => (
                      <tr key={sub.student_id}>
                        <td>{sub.students?.first_name} {sub.students?.last_name}</td>
                        <td>
                          <span className={`badge ${
                            sub.status === 'graded' ? 'bg-green-100 text-green-800' :
                            sub.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {sub.status}
                          </span>
                        </td>
                        <td>{sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : '-'}</td>
                        <td>
                          {sub.marks != null ? `${sub.marks}/${selectedHomework.total_marks}` : '-'}
                        </td>
                        <td>
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
            </div>
          ) : (
            <div className="card">
              <div className="card-body text-center py-12 text-[#5c6670]">
                <MaterialIcon icon="assignment" style={{ fontSize: 48, opacity: 0.5 }} />
                <p className="mt-2">Select homework to view submissions</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function GradingModal({ submission, maxMarks, onSave }: { submission: any; maxMarks: number; onSave: (marks: number, feedback: string) => void }) {
  const [open, setOpen] = useState(false)
  const [marks, setMarks] = useState(submission.marks || 0)
  const [feedback, setFeedback] = useState(submission.feedback || '')

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-sm btn-primary">
        Grade
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Grade Submission</h3>
            <p className="text-sm text-[#5c6670] mb-4">
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
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Feedback</label>
                <textarea 
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="input"
                  rows={3}
                  placeholder="Give feedback to student..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setOpen(false)} className="btn flex-1 bg-gray-100">Cancel</button>
              <button onClick={() => { onSave(marks, feedback); setOpen(false) }} className="btn btn-primary flex-1">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

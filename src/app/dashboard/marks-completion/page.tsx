'use client'
import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useClasses, useSubjects, useStaff } from '@/lib/hooks'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
}

interface ClassCompletion {
  class_id: string
  class_name: string
  total_subjects: number
  subjects_with_marks: number
  completion_pct: number
  missing_subjects: string[]
  assigned_teacher_ids: string[]
}

interface TeacherStatus {
  teacher_id: string
  teacher_name: string
  subjects_assigned: number
  subjects_submitted: number
  pending_classes: string[]
  all_done: boolean
}

export default function MarksCompletionPage() {
  const { school } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const { classes = [], loading: classesLoading } = useClasses(school?.id)
  const { subjects = [] } = useSubjects(school?.id)
  const { staff = [] } = useStaff(school?.id)
  const toast = useToast()

  const [classCompletions, setClassCompletions] = useState<ClassCompletion[]>([])
  const [teacherStatuses, setTeacherStatuses] = useState<TeacherStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [chasing, setChasing] = useState<string | null>(null)

  useEffect(() => {
    if (!school?.id || classes.length === 0) return
    fetchCompletionData()
  }, [school?.id, classes.length, subjects.length, academicYear, currentTerm])

  const fetchCompletionData = async () => {
    setLoading(true)
    try {
      // Fetch all grades for this term
      const { data: gradesData } = await supabase
        .from('grades')
        .select('class_id, subject_id, recorded_by')
        .eq('term', currentTerm || 1)
        .eq('academic_year', academicYear || '2026')

      // Fetch allocations (which teacher teaches which subject in which class)
      const { data: allocationsData } = await supabase
        .from('allocations')
        .select('teacher_id, subject_id, class_id')

      // Build grades set: class_id + subject_id combos that have marks
      const gradesSet = new Set<string>()
      const gradesByClass: Record<string, Set<string>> = {}

      gradesData?.forEach(g => {
        const key = `${g.class_id}_${g.subject_id}`
        gradesSet.add(key)
        if (!gradesByClass[g.class_id]) gradesByClass[g.class_id] = new Set()
        gradesByClass[g.class_id].add(g.subject_id)
      })

      // Build allocation records per class
      const allocByClass: Record<string, { subject_id: string; teacher_id: string }[]> = {}
      allocationsData?.forEach(a => {
        if (!allocByClass[a.class_id]) allocByClass[a.class_id] = []
        allocByClass[a.class_id].push({ subject_id: a.subject_id, teacher_id: a.teacher_id })
      })

      // Class completions
      const completions: ClassCompletion[] = classes.map((cls: any) => {
        const classAllocs = allocByClass[cls.id] || []
        const totalSubjects = Math.max(classAllocs.length, 1)
        const graded = gradesByClass[cls.id] || new Set()
        const subjectsWithMarks = classAllocs.filter(a => graded.has(a.subject_id)).length

        const missing: string[] = []
        const teacherIds: string[] = []
        classAllocs.forEach(a => {
          if (!graded.has(a.subject_id)) {
            const subjName = subjects.find((s: any) => s.id === a.subject_id)?.name || a.subject_id
            missing.push(subjName)
          }
          if (!teacherIds.includes(a.teacher_id)) teacherIds.push(a.teacher_id)
        })

        // If no allocations, use subjects list
        const effectiveTotal = classAllocs.length > 0 ? classAllocs.length : subjects.length
        const effectiveWithMarks = classAllocs.length > 0 ? subjectsWithMarks : graded.size

        return {
          class_id: cls.id,
          class_name: cls.name,
          total_subjects: effectiveTotal,
          subjects_with_marks: effectiveWithMarks,
          completion_pct: effectiveTotal > 0 ? Math.round((effectiveWithMarks / effectiveTotal) * 100) : 0,
          missing_subjects: missing,
          assigned_teacher_ids: teacherIds,
        }
      })

      completions.sort((a, b) => b.completion_pct - a.completion_pct)
      setClassCompletions(completions)

      // Teacher statuses
      const teacherMap: Record<string, TeacherStatus> = {}

      staff.filter((s: any) => s.role === 'teacher').forEach((t: any) => {
        teacherMap[t.id] = {
          teacher_id: t.id,
          teacher_name: t.full_name,
          subjects_assigned: 0,
          subjects_submitted: 0,
          pending_classes: [],
          all_done: true,
        }
      })

      allocationsData?.forEach(a => {
        const t = teacherMap[a.teacher_id]
        if (!t) return
        t.subjects_assigned++
        const key = `${a.class_id}_${a.subject_id}`
        if (gradesSet.has(key)) {
          t.subjects_submitted++
        } else {
          t.all_done = false
          const cls = classes.find((c: any) => c.id === a.class_id)
          const subj = subjects.find((s: any) => s.id === a.subject_id)
          if (cls && subj) {
            t.pending_classes.push(`${cls.name} / ${subj.name}`)
          }
        }
      })

      const teacherArr = Object.values(teacherMap)
        .filter(t => t.subjects_assigned > 0)
        .sort((a, b) => {
          if (a.all_done && !b.all_done) return 1
          if (!a.all_done && b.all_done) return -1
          return a.teacher_name.localeCompare(b.teacher_name)
        })

      setTeacherStatuses(teacherArr)
    } catch (err) {
      console.error('Error fetching completion data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleChase = async (teacherId: string, teacherName: string) => {
    setChasing(teacherId)
    try {
      const teacher = teacherStatuses.find(t => t.teacher_id === teacherId)
      if (!teacher) return

      const pendingList = teacher.pending_classes.join(', ')

      // Send SMS reminder
      await supabase.from('messages').insert({
        school_id: school!.id,
        recipient_type: 'staff',
        recipient_id: teacherId,
        message: `Dear ${teacherName}, this is a reminder to submit marks for: ${pendingList}. Please complete this as soon as possible. — ${school?.name}`,
        status: 'pending',
        created_by: 'system',
      })

      toast.success(`SMS reminder sent to ${teacherName}`)
    } catch (err) {
      toast.error('Failed to send reminder')
    } finally {
      setChasing(null)
    }
  }

  const overallCompletion = classCompletions.length > 0
    ? Math.round(classCompletions.reduce((s, c) => s + c.completion_pct, 0) / classCompletions.length)
    : 0

  const fullyComplete = classCompletions.filter(c => c.completion_pct === 100).length
  const incomplete = classCompletions.filter(c => c.completion_pct < 100).length

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Marks Completion Tracker</h1>
        <p className="text-[#5c6670] mt-1">{academicYear} Term {currentTerm} — Track marks submission progress</p>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="card-body text-center">
            <div className="text-3xl font-bold text-[#002045]">{overallCompletion}%</div>
            <div className="text-sm text-[#5c6670]">Overall Completion</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <div className="text-3xl font-bold text-green-600">{fullyComplete}</div>
            <div className="text-sm text-[#5c6670]">Classes Complete</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <div className="text-3xl font-bold text-amber-600">{incomplete}</div>
            <div className="text-sm text-[#5c6670]">Classes Incomplete</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <div className="text-3xl font-bold text-blue-600">{teacherStatuses.filter(t => t.all_done).length}/{teacherStatuses.length}</div>
            <div className="text-sm text-[#5c6670]">Teachers Done</div>
          </div>
        </div>
      </div>

      {/* Class Completion */}
      <div className="card mb-6">
        <div className="card-header">
          <div className="card-title">Completion by Class</div>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Subjects with Marks</th>
                <th>Progress</th>
                <th>Missing Subjects</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading || classesLoading ? (
                <tr><td colSpan={5} className="text-center py-8 text-[#5c6670]">Loading...</td></tr>
              ) : classCompletions.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-[#5c6670]">No classes found</td></tr>
              ) : (
                classCompletions.map(cls => {
                  const color = cls.completion_pct === 100 ? 'bg-green-500' : cls.completion_pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
                  return (
                    <tr key={cls.class_id}>
                      <td className="font-medium">{cls.class_name}</td>
                      <td>{cls.subjects_with_marks} / {cls.total_subjects}</td>
                      <td style={{ minWidth: 160 }}>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${color}`} style={{ width: `${cls.completion_pct}%` }} />
                          </div>
                          <span className="text-xs font-bold w-10 text-right">{cls.completion_pct}%</span>
                        </div>
                      </td>
                      <td>
                        {cls.missing_subjects.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {cls.missing_subjects.map((s, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 bg-red-50 text-red-700 rounded-full">{s}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-green-600 font-medium">All submitted</span>
                        )}
                      </td>
                      <td>
                        {cls.completion_pct === 100 ? (
                          <span className="badge bg-green-100 text-green-800">Complete</span>
                        ) : (
                          <span className="badge bg-amber-100 text-amber-800">Pending</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Teacher Submission Status */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Teacher Marks Submission</div>
          <div className="card-sub">Chase teachers who haven't submitted marks</div>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Submitted</th>
                <th>Pending Classes</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {teacherStatuses.length === 0 && !loading ? (
                <tr><td colSpan={5} className="text-center py-8 text-[#5c6670]">No teachers with allocations</td></tr>
              ) : (
                teacherStatuses.map(teacher => (
                  <tr key={teacher.teacher_id}>
                    <td className="font-medium">{teacher.teacher_name}</td>
                    <td>{teacher.subjects_submitted} / {teacher.subjects_assigned}</td>
                    <td>
                      {teacher.pending_classes.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {teacher.pending_classes.slice(0, 3).map((p, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 bg-red-50 text-red-700 rounded-full">{p}</span>
                          ))}
                          {teacher.pending_classes.length > 3 && (
                            <span className="text-xs text-[#5c6670]">+{teacher.pending_classes.length - 3} more</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-green-600">—</span>
                      )}
                    </td>
                    <td>
                      {teacher.all_done ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                          <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                          Complete
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                          Incomplete
                        </span>
                      )}
                    </td>
                    <td>
                      {!teacher.all_done && (
                        <button
                          onClick={() => handleChase(teacher.teacher_id, teacher.teacher_name)}
                          disabled={chasing === teacher.teacher_id}
                          className="btn-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 flex items-center gap-1"
                        >
                          <MaterialIcon icon="sms" style={{ fontSize: '14px' }} />
                          {chasing === teacher.teacher_id ? 'Sending...' : 'Chase'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

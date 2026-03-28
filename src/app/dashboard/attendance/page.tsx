'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useClasses } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

export default function AttendancePage() {
  const { school, user } = useAuth()
  const toast = useToast()
  const { classes, loading: classesLoading } = useClasses(school?.id)
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const [date, setDate] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })
  const [students, setStudents] = useState<Array<{id: string, first_name: string, last_name: string, student_number: string}>>([])
  const [attendance, setAttendance] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function fetchStudents() {
      if (!selectedClass || !school?.id) return

      try {
        setLoading(true)

        const { data: studentsData, error: studentsError } = await supabase
          .from('students')
          .select('*')
          .eq('school_id', school.id)
          .eq('class_id', selectedClass)
          .eq('status', 'active')
          .order('first_name')

        if (studentsError) throw studentsError
        setStudents(studentsData || [])

        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('*')
          .eq('class_id', selectedClass)
          .eq('date', date)

        const attendanceMap: Record<string, string> = {}
        attendanceData?.forEach((record: {student_id: string, status: string}) => {
          attendanceMap[record.student_id] = record.status
        })
        setAttendance(attendanceMap)
      } catch (err) {
        console.error('Error fetching students:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStudents()
  }, [selectedClass, date, school?.id])

  const markAttendance = (studentId: string, status: string) => {
    setAttendance(prev => ({ ...prev, [studentId]: status }))
  }

  const markAll = (status: string) => {
    const newAttendance: Record<string, string> = {}
    students.forEach(s => {
      newAttendance[s.id] = status
    })
    setAttendance(newAttendance)
  }

  const saveAttendance = async () => {
    if (!selectedClass || !user?.id) return

    try {
      setSaving(true)
      const records = Object.entries(attendance).map(([studentId, status]) => ({
        student_id: studentId,
        class_id: selectedClass,
        date,
        status,
        recorded_by: user.id,
      }))

      const { error } = await supabase
        .from('attendance')
        .upsert(records, { onConflict: 'student_id,date' })

      if (error) throw error
      toast.success('Attendance saved')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save'
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const presentCount = Object.values(attendance).filter(s => s === 'present').length
  const absentCount = Object.values(attendance).filter(s => s === 'absent').length
  const lateCount = Object.values(attendance).filter(s => s === 'late').length

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="font-headline font-bold text-3xl text-primary tracking-tight mb-2">Attendance</h2>
          <p className="text-on-surface-variant text-sm font-medium">Mark daily student attendance</p>
        </div>
      </header>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 block">Select Class</label>
            <select
              value={selectedClass || ''}
              onChange={(e) => setSelectedClass(e.target.value || null)}
              className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Select a class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:w-48">
            <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 block">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </div>

      {!selectedClass ? (
        <div className="bg-surface-container-lowest p-12 rounded-xl text-center border border-outline-variant/10">
          <div className="w-16 h-16 bg-surface-container-low rounded-full flex items-center justify-center mx-auto mb-4">
            <MaterialIcon icon="fact_check" className="text-3xl text-on-surface-variant" />
          </div>
          <h3 className="font-headline font-bold text-lg text-primary mb-2">Select a class</h3>
          <p className="text-on-surface-variant text-sm">Choose a class to mark attendance</p>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-surface-container rounded-full" />
                <div className="flex-1">
                  <div className="w-32 h-4 bg-surface-container rounded mb-2" />
                  <div className="w-20 h-3 bg-surface-container rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : students.length === 0 ? (
        <div className="bg-surface-container-lowest p-12 rounded-xl text-center border border-outline-variant/10">
          <div className="w-16 h-16 bg-surface-container-low rounded-full flex items-center justify-center mx-auto mb-4">
            <MaterialIcon icon="group" className="text-3xl text-on-surface-variant" />
          </div>
          <h3 className="font-headline font-bold text-lg text-primary mb-2">No students in this class</h3>
          <p className="text-on-surface-variant text-sm">Add students to this class first</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4 text-center">
              <div className="text-3xl font-bold text-secondary">{presentCount}</div>
              <div className="text-sm text-on-surface-variant mt-1">Present</div>
            </div>
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4 text-center">
              <div className="text-3xl font-bold text-error">{absentCount}</div>
              <div className="text-sm text-on-surface-variant mt-1">Absent</div>
            </div>
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4 text-center">
              <div className="text-3xl font-bold text-tertiary">{lateCount}</div>
              <div className="text-sm text-on-surface-variant mt-1">Late</div>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => markAll('present')} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-outline-variant/30 text-primary font-semibold text-sm hover:bg-surface-container-low transition-all">
              <MaterialIcon icon="check_circle" className="text-lg" />
              Mark All Present
            </button>
            <button onClick={() => markAll('absent')} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-outline-variant/30 text-primary font-semibold text-sm hover:bg-surface-container-low transition-all">
              <MaterialIcon icon="cancel" className="text-lg" />
              Mark All Absent
            </button>
          </div>

          <div className="space-y-3">
            {students.map((student) => (
              <div key={student.id} className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-container rounded-full flex items-center justify-center">
                      <span className="text-on-primary-container font-bold text-sm">
                        {student.first_name?.charAt(0)}{student.last_name?.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <div className="font-bold text-primary">{student.first_name} {student.last_name}</div>
                      <div className="text-xs text-on-surface-variant">{student.student_number}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {[
                      { status: 'present', label: 'Present', activeClass: 'bg-secondary-container text-on-secondary-container border-secondary', active: attendance[student.id] === 'present' },
                      { status: 'absent', label: 'Absent', activeClass: 'bg-error-container text-on-error-container border-error', active: attendance[student.id] === 'absent' },
                      { status: 'late', label: 'Late', activeClass: 'bg-tertiary-fixed text-on-tertiary-fixed border-tertiary', active: attendance[student.id] === 'late' },
                    ].map((option) => (
                      <button
                        key={option.status}
                        onClick={() => markAttendance(student.id, option.status)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                          option.active
                            ? option.activeClass
                            : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/30 hover:border-outline-variant'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={saveAttendance} disabled={saving || Object.keys(attendance).length === 0} className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/10 disabled:opacity-50">
            <MaterialIcon icon="save" className="text-lg" />
            {saving ? 'Saving...' : 'Save Attendance'}
          </button>
        </>
      )}
    </div>
  )
}
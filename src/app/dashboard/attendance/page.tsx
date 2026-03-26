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
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Attendance</h1>
        <p className="text-[#5c6670] mt-1">Mark daily student attendance</p>
      </div>

      <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium text-[#5c6670] mb-2 block">Select Class</label>
            <select
              value={selectedClass || ''}
              onChange={(e) => setSelectedClass(e.target.value || null)}
              className="input"
            >
              <option value="">Select a class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:w-48">
            <label className="text-sm font-medium text-[#5c6670] mb-2 block">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input"
            />
          </div>
        </div>
      </div>

      {!selectedClass ? (
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-12 text-center">
          <div className="w-16 h-16 bg-[#f8fafb] rounded-full flex items-center justify-center mx-auto mb-4">
            <MaterialIcon icon="fact_check" className="text-3xl text-[#5c6670]" />
          </div>
          <h3 className="text-lg font-semibold text-[#191c1d] mb-2">Select a class</h3>
          <p className="text-[#5c6670]">Choose a class to mark attendance</p>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#e8eaed] p-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#f0f4f8] rounded-full" />
                <div className="flex-1">
                  <div className="w-32 h-4 bg-[#e8eaed] rounded mb-2" />
                  <div className="w-20 h-3 bg-[#e8eaed] rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-12 text-center">
          <div className="w-16 h-16 bg-[#f8fafb] rounded-full flex items-center justify-center mx-auto mb-4">
            <MaterialIcon icon="group" className="text-3xl text-[#5c6670]" />
          </div>
          <h3 className="text-lg font-semibold text-[#191c1d] mb-2">No students in this class</h3>
          <p className="text-[#5c6670]">Add students to this class first</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
              <div className="text-3xl font-bold text-[#006e1c]">{presentCount}</div>
              <div className="text-sm text-[#5c6670] mt-1">Present</div>
            </div>
            <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
              <div className="text-3xl font-bold text-[#ba1a1a]">{absentCount}</div>
              <div className="text-sm text-[#5c6670] mt-1">Absent</div>
            </div>
            <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
              <div className="text-3xl font-bold text-[#b86e00]">{lateCount}</div>
              <div className="text-sm text-[#5c6670] mt-1">Late</div>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <button onClick={() => markAll('present')} className="btn btn-secondary text-sm py-2">
              <MaterialIcon icon="check_circle" className="text-lg" />
              Mark All Present
            </button>
            <button onClick={() => markAll('absent')} className="btn btn-secondary text-sm py-2">
              <MaterialIcon icon="cancel" className="text-lg" />
              Mark All Absent
            </button>
          </div>

          <div className="space-y-3 mb-6">
            {students.map((student) => (
              <div key={student.id} className="bg-white rounded-2xl border border-[#e8eaed] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#f0f4f8] rounded-full flex items-center justify-center">
                      <span className="text-[#002045] font-semibold text-sm">
                        {student.first_name?.charAt(0)}{student.last_name?.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-[#191c1d]">{student.first_name} {student.last_name}</div>
                      <div className="text-xs text-[#5c6670]">{student.student_number}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {[
                      { status: 'present', label: 'Present', color: 'bg-[#ecfdf5] text-[#006e1c] border-[#006e1c]', active: attendance[student.id] === 'present' },
                      { status: 'absent', label: 'Absent', color: 'bg-[#fef2f2] text-[#ba1a1a] border-[#ba1a1a]', active: attendance[student.id] === 'absent' },
                      { status: 'late', label: 'Late', color: 'bg-[#fff7ed] text-[#b86e00] border-[#b86e00]', active: attendance[student.id] === 'late' },
                    ].map((option) => (
                      <button
                        key={option.status}
                        onClick={() => markAttendance(student.id, option.status)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                          option.active
                            ? option.color
                            : 'bg-white text-[#5c6670] border-[#e8eaed] hover:border-[#c4c6cf]'
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

          <button onClick={saveAttendance} disabled={saving || Object.keys(attendance).length === 0} className="btn btn-primary w-full">
            <MaterialIcon icon="save" className="text-lg" />
            {saving ? 'Saving...' : 'Save Attendance'}
          </button>
        </>
      )}
    </div>
  )
}
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useClasses } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

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
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
        <p className="text-gray-500 mt-1">Mark daily student attendance</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <select
          value={selectedClass || ''}
          onChange={(e) => setSelectedClass(e.target.value || null)}
          className="input sm:w-64"
        >
          <option value="">Select a class</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input sm:w-48"
        />
      </div>

      {!selectedClass ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a class</h3>
          <p className="text-gray-500">Choose a class to mark attendance</p>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card">
              <div className="flex items-center gap-4">
                <div className="skeleton w-10 h-10 rounded-full" />
                <div className="flex-1">
                  <div className="skeleton w-32 h-4 mb-2" />
                  <div className="skeleton w-20 h-3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : students.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No students in this class</h3>
          <p className="text-gray-500">Add students to this class first</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="card text-center">
              <div className="text-2xl font-bold text-green-600">{presentCount}</div>
              <div className="text-sm text-gray-500">Present</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-red-600">{absentCount}</div>
              <div className="text-sm text-gray-500">Absent</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-yellow-600">{lateCount}</div>
              <div className="text-sm text-gray-500">Late</div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 mb-4">
            <button onClick={() => markAll('present')} className="btn btn-sm btn-secondary">
              Mark All Present
            </button>
            <button onClick={() => markAll('absent')} className="btn btn-sm btn-secondary">
              Mark All Absent
            </button>
          </div>

          {/* Students List */}
          <div className="space-y-3 mb-6">
            {students.map((student) => (
              <div key={student.id} className="card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-sm">
                        {student.first_name?.charAt(0)}{student.last_name?.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium">{student.first_name} {student.last_name}</div>
                      <div className="text-xs text-gray-500">{student.student_number}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {[
                      { status: 'present', label: 'Present', color: 'bg-green-100 text-green-700 border-green-200' },
                      { status: 'absent', label: 'Absent', color: 'bg-red-100 text-red-700 border-red-200' },
                      { status: 'late', label: 'Late', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
                    ].map((option) => (
                      <button
                        key={option.status}
                        onClick={() => markAttendance(student.id, option.status)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          attendance[student.id] === option.status
                            ? option.color
                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
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

          {/* Save Button */}
          <button onClick={saveAttendance} disabled={saving || Object.keys(attendance).length === 0} className="btn btn-primary w-full">
            {saving ? 'Saving...' : 'Save Attendance'}
          </button>
        </>
      )}
    </div>
  )
}

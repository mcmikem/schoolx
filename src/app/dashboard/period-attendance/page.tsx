'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useClasses } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

const PERIODS = ['Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5', 'Period 6', 'Period 7', 'Period 8']

export default function PeriodAttendancePage() {
  const { school, user } = useAuth()
  const toast = useToast()
  const { classes } = useClasses(school?.id)
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState('Period 1')
  const [date, setDate] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })
  const [students, setStudents] = useState<Array<{id: string, first_name: string, last_name: string, student_number: string}>>([])
  const [attendance, setAttendance] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (selectedClass) {
      fetchStudents()
    }
  }, [selectedClass, date, selectedPeriod])

  const fetchStudents = async () => {
    if (!selectedClass || !school?.id) return
    try {
      setLoading(true)
      const { data } = await supabase
        .from('students')
        .select('*')
        .eq('school_id', school.id)
        .eq('class_id', selectedClass)
        .eq('status', 'active')
        .order('first_name')
      setStudents(data || [])

      // Fetch period attendance
      const { data: attData } = await supabase
        .from('period_attendance')
        .select('*')
        .eq('class_id', selectedClass)
        .eq('date', date)
        .eq('period', selectedPeriod)

      const attMap: Record<string, string> = {}
      attData?.forEach(a => { attMap[a.student_id] = a.status })
      setAttendance(attMap)
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const markAttendance = (studentId: string, status: string) => {
    setAttendance(prev => ({ ...prev, [studentId]: status }))
  }

  const saveAttendance = async () => {
    if (!selectedClass || !user?.id) return
    try {
      setSaving(true)
      const records = Object.entries(attendance).map(([studentId, status]) => ({
        school_id: school?.id,
        student_id: studentId,
        class_id: selectedClass,
        date,
        period: selectedPeriod,
        status,
        recorded_by: user.id,
      }))

      const { error } = await supabase
        .from('period_attendance')
        .upsert(records, { onConflict: 'student_id,date,period' })

      if (error) throw error
      toast.success('Period attendance saved')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Period Attendance</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Mark attendance for each period</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <select value={selectedClass || ''} onChange={(e) => setSelectedClass(e.target.value || null)} className="input sm:w-48">
          <option value="">Select class</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} className="input sm:w-40">
          {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input sm:w-48" />
      </div>

      {!selectedClass ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Select a class</h3>
          <p className="text-gray-500 dark:text-gray-400">Choose a class to mark period attendance</p>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card"><div className="skeleton w-full h-12" /></div>
          ))}
        </div>
      ) : students.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No students</h3>
          <p className="text-gray-500 dark:text-gray-400">Add students to this class first</p>
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-6">
            {students.map((student) => (
              <div key={student.id} className="card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 dark:text-blue-300 font-semibold text-sm">
                        {student.first_name?.charAt(0)}{student.last_name?.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{student.first_name} {student.last_name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{student.student_number}</div>
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
                            : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-300'
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
            {saving ? 'Saving...' : 'Save Period Attendance'}
          </button>
        </>
      )}
    </div>
  )
}

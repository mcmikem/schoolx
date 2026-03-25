'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

interface StaffMember {
  id: string
  full_name: string
  role: string
}

interface AttendanceRecord {
  id: string
  user_id: string
  date: string
  status: string
  time_in: string | null
  time_out: string | null
}

export default function StaffAttendancePage() {
  const { school, user } = useAuth()
  const toast = useToast()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [attendance, setAttendance] = useState<Record<string, string>>({})
  const [date, setDate] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchStaffAndAttendance()
  }, [school?.id, date])

  const fetchStaffAndAttendance = async () => {
    if (!school?.id) return
    try {
      setLoading(true)

      // Fetch staff
      const { data: staffData } = await supabase
        .from('users')
        .select('id, full_name, role')
        .eq('school_id', school.id)
        .eq('is_active', true)
        .neq('role', 'student')
        .neq('role', 'parent')

      setStaff(staffData || [])

      // Fetch attendance for this date
      const { data: attendanceData } = await supabase
        .from('staff_attendance')
        .select('*')
        .eq('school_id', school.id)
        .eq('date', date)

      const attendanceMap: Record<string, string> = {}
      attendanceData?.forEach(a => {
        attendanceMap[a.user_id] = a.status
      })
      setAttendance(attendanceMap)
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const markAttendance = (userId: string, status: string) => {
    setAttendance(prev => ({ ...prev, [userId]: status }))
  }

  const markAll = (status: string) => {
    const newAttendance: Record<string, string> = {}
    staff.forEach(s => {
      newAttendance[s.id] = status
    })
    setAttendance(newAttendance)
  }

  const saveAttendance = async () => {
    if (!school?.id || !user?.id) return

    try {
      setSaving(true)
      const records = Object.entries(attendance).map(([userId, status]) => ({
        school_id: school.id,
        user_id: userId,
        date,
        status,
        time_in: status === 'present' || status === 'late' ? new Date().toISOString() : null,
        time_out: null,
        recorded_by: user.id,
      }))

      const { error } = await supabase
        .from('staff_attendance')
        .upsert(records, { onConflict: 'user_id,date' })

      if (error) throw error
      toast.success('Staff attendance saved')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Staff Attendance</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Track daily staff attendance</p>
      </div>

      {/* Date Filter */}
      <div className="mb-6">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input sm:w-48"
        />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card text-center">
          <div className="text-2xl font-bold text-green-600">{presentCount}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Present</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-red-600">{absentCount}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Absent</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-yellow-600">{lateCount}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Late</div>
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

      {/* Staff List */}
      {loading ? (
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
      ) : staff.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No staff members</h3>
          <p className="text-gray-500 dark:text-gray-400">Add staff members first</p>
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-6">
            {staff.map((member) => (
              <div key={member.id} className="card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 dark:text-blue-300 font-semibold text-sm">
                        {member.full_name?.charAt(0) || 'U'}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{member.full_name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{member.role}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {[
                      { status: 'present', label: 'Present', color: 'bg-green-100 text-green-700 border-green-200' },
                      { status: 'absent', label: 'Absent', color: 'bg-red-100 text-red-700 border-red-200' },
                      { status: 'late', label: 'Late', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
                      { status: 'leave', label: 'Leave', color: 'bg-blue-100 text-blue-700 border-blue-200' },
                    ].map((option) => (
                      <button
                        key={option.status}
                        onClick={() => markAttendance(member.id, option.status)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          attendance[member.id] === option.status
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

          {/* Save Button */}
          <button onClick={saveAttendance} disabled={saving || Object.keys(attendance).length === 0} className="btn btn-primary w-full">
            {saving ? 'Saving...' : 'Save Attendance'}
          </button>
        </>
      )}
    </div>
  )
}

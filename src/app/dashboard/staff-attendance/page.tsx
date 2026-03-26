'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

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

      const { data: staffData } = await supabase
        .from('users')
        .select('id, full_name, role')
        .eq('school_id', school.id)
        .eq('is_active', true)
        .neq('role', 'student')
        .neq('role', 'parent')

      setStaff(staffData || [])

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
        <h1 className="text-2xl font-bold text-[#002045]">Staff Attendance</h1>
        <p className="text-[#5c6670] mt-1">Track daily staff attendance</p>
      </div>

      <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 mb-6">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input sm:w-48"
        />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
          <div className="text-2xl font-bold text-[#006e1c]">{presentCount}</div>
          <div className="text-sm text-[#5c6670] mt-1">Present</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
          <div className="text-2xl font-bold text-[#ba1a1a]">{absentCount}</div>
          <div className="text-sm text-[#5c6670] mt-1">Absent</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
          <div className="text-2xl font-bold text-[#b86e00]">{lateCount}</div>
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

      {loading ? (
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
      ) : staff.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-12 text-center">
          <div className="w-16 h-16 bg-[#f8fafb] rounded-full flex items-center justify-center mx-auto mb-4">
            <MaterialIcon icon="groups" className="text-3xl text-[#5c6670]" />
          </div>
          <h3 className="text-lg font-semibold text-[#191c1d] mb-2">No staff members</h3>
          <p className="text-[#5c6670]">Add staff members first</p>
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-6">
            {staff.map((member) => (
              <div key={member.id} className="bg-white rounded-2xl border border-[#e8eaed] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#f0f4f8] rounded-full flex items-center justify-center">
                      <span className="text-[#002045] font-semibold text-sm">
                        {member.full_name?.charAt(0) || 'U'}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-[#191c1d]">{member.full_name}</div>
                      <div className="text-xs text-[#5c6670] capitalize">{member.role}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {[
                      { status: 'present', label: 'Present', color: 'bg-[#ecfdf5] text-[#006e1c] border-[#006e1c]', active: attendance[member.id] === 'present' },
                      { status: 'absent', label: 'Absent', color: 'bg-[#fef2f2] text-[#ba1a1a] border-[#ba1a1a]', active: attendance[member.id] === 'absent' },
                      { status: 'late', label: 'Late', color: 'bg-[#fff7ed] text-[#b86e00] border-[#b86e00]', active: attendance[member.id] === 'late' },
                      { status: 'leave', label: 'Leave', color: 'bg-[#e3f2fd] text-[#002045] border-[#002045]', active: attendance[member.id] === 'leave' },
                    ].map((option) => (
                      <button
                        key={option.status}
                        onClick={() => markAttendance(member.id, option.status)}
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
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useStaff } from '@/lib/hooks'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
}

interface ActivityEntry {
  staff_id: string
  full_name: string
  role: string
  last_active: string | null
  marked_attendance: boolean
  entered_grades: boolean
  other_actions: string[]
}

export default function StaffActivityPage() {
  const { school } = useAuth()
  const { staff = [], loading: staffLoading } = useStaff(school?.id)
  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [date] = useState(() => new Date().toISOString().split('T')[0])

  useEffect(() => {
    if (!school?.id || staff.length === 0) return
    fetchActivity()
  }, [school?.id, staff.length, date])

  const fetchActivity = async () => {
    setLoading(true)
    try {
      // Fetch staff attendance for today
      const { data: staffAttData } = await supabase
        .from('staff_attendance')
        .select('user_id, status, time_in')
        .eq('school_id', school!.id)
        .eq('date', date)

      const attendanceMap: Record<string, { status: string; time_in: string | null }> = {}
      staffAttData?.forEach(a => {
        attendanceMap[a.user_id] = { status: a.status, time_in: a.time_in }
      })

      // Fetch who marked student attendance today
      const { data: attData } = await supabase
        .from('attendance')
        .select('recorded_by')
        .eq('date', date)
        .not('recorded_by', 'is', null)

      const attendanceMarkers = new Set(attData?.map(a => a.recorded_by) || [])

      // Fetch who entered grades today
      const { data: gradesData } = await supabase
        .from('grades')
        .select('recorded_by')
        .gte('created_at', `${date}T00:00:00`)
        .not('recorded_by', 'is', null)

      const gradeEntriers = new Set(gradesData?.map(g => g.recorded_by) || [])

      // Fetch who sent messages today
      const { data: msgData } = await supabase
        .from('messages')
        .select('created_by')
        .gte('created_at', `${date}T00:00:00`)
        .not('created_by', 'is', null)

      const messengers = new Set(msgData?.map(m => m.created_by) || [])

      // Build activity entries
      const entries: ActivityEntry[] = staff.map((s: any) => {
        const actions: string[] = []
        if (attendanceMarkers.has(s.id)) actions.push('Marked attendance')
        if (gradeEntriers.has(s.id)) actions.push('Entered grades')
        if (messengers.has(s.id)) actions.push('Sent message')

        return {
          staff_id: s.id,
          full_name: s.full_name,
          role: s.role,
          last_active: attendanceMap[s.id]?.time_in || null,
          marked_attendance: attendanceMarkers.has(s.id),
          entered_grades: gradeEntriers.has(s.id),
          other_actions: actions,
        }
      })

      // Sort: active first
      entries.sort((a, b) => {
        const aActive = a.other_actions.length > 0
        const bActive = b.other_actions.length > 0
        if (aActive && !bActive) return -1
        if (!aActive && bActive) return 1
        return a.full_name.localeCompare(b.full_name)
      })

      setActivities(entries)
    } catch (err) {
      console.error('Error fetching staff activity:', err)
    } finally {
      setLoading(false)
    }
  }

  const activeToday = activities.filter(a => a.other_actions.length > 0).length
  const markedAtt = activities.filter(a => a.marked_attendance).length
  const enteredGrades = activities.filter(a => a.entered_grades).length

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Staff Activity Log</h1>
        <p className="text-[#5c6670] mt-1">Today&apos;s activity — {new Date(date).toLocaleDateString('en-UG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="card-body text-center">
            <div className="text-2xl font-bold text-[#002045]">{staff.length}</div>
            <div className="text-sm text-[#5c6670]">Total Staff</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <div className="text-2xl font-bold text-green-600">{activeToday}</div>
            <div className="text-sm text-[#5c6670]">Active Today</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <div className="text-2xl font-bold text-blue-600">{markedAtt}</div>
            <div className="text-sm text-[#5c6670]">Marked Attendance</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <div className="text-2xl font-bold text-amber-600">{enteredGrades}</div>
            <div className="text-sm text-[#5c6670]">Entered Grades</div>
          </div>
        </div>
      </div>

      {/* Activity Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Staff Activity</div>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Staff Name</th>
                <th>Role</th>
                <th>Last Active</th>
                <th>Actions Taken</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading || staffLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mx-auto"></div>
                  </td>
                </tr>
              ) : activities.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-[#5c6670]">No staff members found</td></tr>
              ) : (
                activities.map(entry => {
                  const isActive = entry.other_actions.length > 0
                  return (
                    <tr key={entry.staff_id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#f0f4f8] flex items-center justify-center text-sm font-semibold text-[#002045]">
                            {entry.full_name?.charAt(0) || '?'}
                          </div>
                          <span className="font-medium">{entry.full_name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="capitalize text-sm text-[#5c6670]">{entry.role.replace(/_/g, ' ')}</span>
                      </td>
                      <td>
                        {entry.last_active
                          ? new Date(entry.last_active).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' })
                          : '-'
                        }
                      </td>
                      <td>
                        {entry.other_actions.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {entry.other_actions.map((action, i) => (
                              <span
                                key={i}
                                className={`text-xs px-2 py-0.5 rounded-full ${
                                  action === 'Marked attendance' ? 'bg-green-50 text-green-700' :
                                  action === 'Entered grades' ? 'bg-blue-50 text-blue-700' :
                                  'bg-amber-50 text-amber-700'
                                }`}
                              >
                                {action}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-[#5c6670]">No activity today</span>
                        )}
                      </td>
                      <td>
                        {isActive ? (
                          <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                            <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                            Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-medium text-[#5c6670]">
                            <span className="w-2 h-2 rounded-full bg-gray-300 inline-block"></span>
                            Idle
                          </span>
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
    </div>
  )
}

'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useStudents, useClasses } from '@/lib/hooks'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
}

interface AtRiskStudent {
  id: string
  first_name: string
  last_name: string
  gender: string
  student_number: string
  class_id: string
  class_name: string
  parent_name: string
  parent_phone: string
  consecutive_absent: number
  last_attendance_date: string | null
  risk_level: 'at_risk' | 'likely_dropout'
}

export default function DropoutTrackingPage() {
  const { school, user } = useAuth()
  const toast = useToast()
  const { students, updateStudent } = useStudents(school?.id)
  const { classes } = useClasses(school?.id)

  const [atRiskStudents, setAtRiskStudents] = useState<AtRiskStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClass, setSelectedClass] = useState('all')
  const [showDropoutModal, setShowDropoutModal] = useState<string | null>(null)
  const [dropoutReason, setDropoutReason] = useState('')
  const [sendingSms, setSendingSms] = useState<string | null>(null)

  const fetchAtRiskStudents = useCallback(async () => {
    if (!school?.id) return
    setLoading(true)

    try {
      const today = new Date()
      const thirtyDaysAgo = new Date(today)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const todayStr = today.toISOString().split('T')[0]
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

      const { data: attendanceData, error } = await supabase
        .from('attendance')
        .select('student_id, date, status')
        .gte('date', thirtyDaysAgoStr)
        .lte('date', todayStr)
        .order('date', { ascending: false })

      if (error) throw error

      // Build attendance map per student
      const studentAtt: Record<string, { date: string; status: string }[]> = {}
      attendanceData?.forEach((record: any) => {
        if (!studentAtt[record.student_id]) studentAtt[record.student_id] = []
        studentAtt[record.student_id].push({ date: record.date, status: record.status })
      })

      // Get active students
      const activeStudents = students.filter(s => s.status === 'active')
      const atRiskList: AtRiskStudent[] = []

      for (const student of activeStudents) {
        const records = studentAtt[student.id]
        if (!records || records.length === 0) {
          // No attendance records at all in 30 days - likely dropout
          atRiskList.push({
            id: student.id,
            first_name: student.first_name,
            last_name: student.last_name,
            gender: student.gender,
            student_number: student.student_number || '',
            class_id: student.class_id,
            class_name: student.classes?.name || '-',
            parent_name: student.parent_name || '',
            parent_phone: student.parent_phone || '',
            consecutive_absent: 30,
            last_attendance_date: null,
            risk_level: 'likely_dropout',
          })
          continue
        }

        const sorted = records.sort((a, b) => b.date.localeCompare(a.date))
        let consecutiveAbsent = 0
        let lastAttendanceDate: string | null = null

        for (const rec of sorted) {
          if (rec.status === 'absent') {
            consecutiveAbsent++
          } else {
            lastAttendanceDate = rec.date
            break
          }
        }

        // Also check: if no recent non-absent record found, count all as absent
        if (!lastAttendanceDate && sorted.length > 0) {
          consecutiveAbsent = sorted.length
        }

        if (consecutiveAbsent >= 14) {
          atRiskList.push({
            id: student.id,
            first_name: student.first_name,
            last_name: student.last_name,
            gender: student.gender,
            student_number: student.student_number || '',
            class_id: student.class_id,
            class_name: student.classes?.name || '-',
            parent_name: student.parent_name || '',
            parent_phone: student.parent_phone || '',
            consecutive_absent: consecutiveAbsent,
            last_attendance_date: lastAttendanceDate,
            risk_level: consecutiveAbsent >= 30 ? 'likely_dropout' : 'at_risk',
          })
        }
      }

      setAtRiskStudents(atRiskList.sort((a, b) => b.consecutive_absent - a.consecutive_absent))
    } catch (err) {
      console.error('Error computing at-risk students:', err)
    } finally {
      setLoading(false)
    }
  }, [school?.id, students])

  useEffect(() => {
    fetchAtRiskStudents()
  }, [fetchAtRiskStudents])

  const handleContactParent = async (student: AtRiskStudent) => {
    if (!student.parent_phone) {
      toast.error('No parent phone number on file')
      return
    }

    setSendingSms(student.id)
    try {
      const message = `Dear ${student.parent_name || 'Parent/Guardian'}, your child ${student.first_name} ${student.last_name} has been absent from school for ${student.consecutive_absent} consecutive days. Please contact the school urgently.`

      await supabase.from('messages').insert({
        school_id: school?.id,
        recipient_type: 'individual',
        phone: student.parent_phone,
        message,
        status: 'pending',
        sent_by: user?.id,
      })

      toast.success(`SMS queued to ${student.parent_phone}`)
    } catch (err) {
      toast.error('Failed to send SMS')
    } finally {
      setSendingSms(null)
    }
  }

  const handleMarkDropout = async () => {
    if (!showDropoutModal || !dropoutReason) {
      toast.error('Please provide a reason')
      return
    }

    try {
      await updateStudent(showDropoutModal, {
        status: 'dropped',
        dropout_reason: dropoutReason,
        dropout_date: new Date().toISOString().split('T')[0],
      })

      toast.success('Student marked as dropout')
      setShowDropoutModal(null)
      setDropoutReason('')
      fetchAtRiskStudents()
    } catch (err) {
      toast.error('Failed to update student')
    }
  }

  const filtered = selectedClass === 'all'
    ? atRiskStudents
    : atRiskStudents.filter(s => s.class_id === selectedClass)

  const atRiskCount = atRiskStudents.filter(s => s.risk_level === 'at_risk').length
  const likelyDropoutCount = atRiskStudents.filter(s => s.risk_level === 'likely_dropout').length

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Dropout Tracking</h1>
        <p className="text-[#5c6670] mt-1">Monitor students with extended absences (14+ days = At Risk, 30+ days = Likely Dropout)</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(243,156,18,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcon style={{ fontSize: 18, color: '#f39c12' }}>warning</MaterialIcon>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--t3)' }}>At Risk</span>
          </div>
          <div style={{ fontFamily: 'Sora', fontSize: 28, fontWeight: 800, color: '#f39c12' }}>{atRiskCount}</div>
          <div style={{ fontSize: 11, color: 'var(--t3)' }}>14-29 days absent</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(231,76,60,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcon style={{ fontSize: 18, color: '#e74c3c' }}>error</MaterialIcon>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--t3)' }}>Likely Dropout</span>
          </div>
          <div style={{ fontFamily: 'Sora', fontSize: 28, fontWeight: 800, color: '#e74c3c' }}>{likelyDropoutCount}</div>
          <div style={{ fontSize: 11, color: 'var(--t3)' }}>30+ days absent</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--navy-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcon style={{ fontSize: 18, color: 'var(--navy)' }}>group</MaterialIcon>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--t3)' }}>Active</span>
          </div>
          <div style={{ fontFamily: 'Sora', fontSize: 28, fontWeight: 800, color: 'var(--navy)' }}>{students.filter(s => s.status === 'active').length}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(149,165,166,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcon style={{ fontSize: 18, color: '#7f8c8d' }}>person_off</MaterialIcon>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--t3)' }}>Dropouts</span>
          </div>
          <div style={{ fontFamily: 'Sora', fontSize: 28, fontWeight: 800, color: '#7f8c8d' }}>{students.filter(s => s.status === 'dropped').length}</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-4 mb-4 items-center">
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--surface)', color: 'var(--t1)', minWidth: 160, cursor: 'pointer' }}
        >
          <option value="all">All Classes</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button onClick={fetchAtRiskStudents} className="btn btn-ghost" style={{ fontSize: 12 }}>
          <MaterialIcon icon="refresh" style={{ fontSize: 16 }} />
          Refresh
        </button>
      </div>

      {/* At-Risk Students Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            {atRiskCount + likelyDropoutCount > 0
              ? `${filtered.length} student${filtered.length !== 1 ? 's' : ''} at risk of dropout`
              : 'No at-risk students found'}
          </div>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th>Days Absent</th>
                <th>Last Attendance</th>
                <th>Risk Level</th>
                <th>Parent Phone</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-[#5c6670]">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-[#5c6670]">No at-risk students found</td></tr>
              ) : (
                filtered.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: student.gender === 'M' ? 'var(--navy)' : 'var(--red)' }}>
                          {student.first_name?.charAt(0)}{student.last_name?.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{student.first_name} {student.last_name}</div>
                          <div className="text-xs text-[#5c6670]">{student.student_number || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="px-2.5 py-1 bg-gray-100 rounded-full text-xs font-semibold">{student.class_name}</span>
                    </td>
                    <td>
                      <span className="font-bold" style={{ color: student.consecutive_absent >= 30 ? '#e74c3c' : '#f39c12' }}>
                        {student.consecutive_absent} days
                      </span>
                    </td>
                    <td className="text-sm">
                      {student.last_attendance_date
                        ? new Date(student.last_attendance_date).toLocaleDateString()
                        : 'No record'}
                    </td>
                    <td>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        student.risk_level === 'likely_dropout'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {student.risk_level === 'likely_dropout' ? 'Likely Dropout' : 'At Risk'}
                      </span>
                    </td>
                    <td className="text-sm font-mono">{student.parent_phone || '-'}</td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleContactParent(student)}
                          disabled={sendingSms === student.id || !student.parent_phone}
                          className="px-2 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-40"
                          title="Send SMS to parent"
                        >
                          <MaterialIcon icon="sms" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 2 }} />
                          {sendingSms === student.id ? 'Sending...' : 'Contact'}
                        </button>
                        <button
                          onClick={() => setShowDropoutModal(student.id)}
                          className="px-2 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                          title="Mark as dropout"
                        >
                          <MaterialIcon icon="person_remove" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 2 }} />
                          Dropout
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mark Dropout Modal */}
      {showDropoutModal && (
        <div className="modal-overlay" onClick={() => setShowDropoutModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div style={{ fontFamily: 'Sora', fontSize: 16, fontWeight: 700 }}>Mark as Dropout</div>
              <button onClick={() => setShowDropoutModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <MaterialIcon style={{ fontSize: 18, color: 'var(--t3)' }}>close</MaterialIcon>
              </button>
            </div>
            <div style={{ padding: 20 }}>
              <p className="text-sm text-[#5c6670] mb-4">This will set the student status to &quot;dropped&quot;. Please provide a reason.</p>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Reason for Dropout</label>
                <select value={dropoutReason} onChange={(e) => setDropoutReason(e.target.value)} className="input" required>
                  <option value="">Select reason...</option>
                  <option value="Financial difficulties">Financial difficulties</option>
                  <option value="Family relocation">Family relocation</option>
                  <option value="Pregnancy">Pregnancy</option>
                  <option value="Early marriage">Early marriage</option>
                  <option value="Child labor">Child labor</option>
                  <option value="Illness/Disability">Illness/Disability</option>
                  <option value="Lost interest">Lost interest</option>
                  <option value="Death">Death</option>
                  <option value="Unknown">Unknown</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowDropoutModal(null)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
                <button onClick={handleMarkDropout} disabled={!dropoutReason} className="btn btn-primary" style={{ flex: 1, background: '#e74c3c' }}>Mark as Dropout</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

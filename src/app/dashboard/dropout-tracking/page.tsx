'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useStudents, useClasses } from '@/lib/hooks'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/index'

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

      const studentAtt: Record<string, { date: string; status: string }[]> = {}
      attendanceData?.forEach((record: any) => {
        if (!studentAtt[record.student_id]) studentAtt[record.student_id] = []
        studentAtt[record.student_id].push({ date: record.date, status: record.status })
      })

      const activeStudents = students.filter(s => s.status === 'active')
      const atRiskList: AtRiskStudent[] = []

      for (const student of activeStudents) {
        const records = studentAtt[student.id]
        if (!records || records.length === 0) {
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
      <PageHeader
        title="Dropout Tracking"
        subtitle="Monitor students with extended absences (14+ days = At Risk, 30+ days = Likely Dropout)"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <MaterialIcon className="text-amber-600">warning</MaterialIcon>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">At Risk</span>
          </div>
          <div className="text-3xl font-bold text-amber-600">{atRiskCount}</div>
          <div className="text-xs text-[var(--t3)]">14-29 days absent</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
              <MaterialIcon className="text-red-600">error</MaterialIcon>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">Likely Dropout</span>
          </div>
          <div className="text-3xl font-bold text-red-600">{likelyDropoutCount}</div>
          <div className="text-xs text-[var(--t3)]">30+ days absent</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <MaterialIcon className="text-blue-600">group</MaterialIcon>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">Active</span>
          </div>
          <div className="text-3xl font-bold text-blue-600">{students.filter(s => s.status === 'active').length}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
              <MaterialIcon className="text-gray-500">person_off</MaterialIcon>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">Dropouts</span>
          </div>
          <div className="text-3xl font-bold text-gray-600">{students.filter(s => s.status === 'dropped').length}</div>
        </Card>
      </div>

      <div className="flex gap-4 mb-4 items-center">
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm font-medium"
        >
          <option value="all">All Classes</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <Button variant="ghost" size="sm" onClick={fetchAtRiskStudents}>
          <MaterialIcon icon="refresh" className="text-base" />
          Refresh
        </Button>
      </div>

      <Card>
        <div className="p-4 border-b border-[var(--border)]">
          <h3 className="font-semibold text-[var(--on-surface)]">
            {atRiskCount + likelyDropoutCount > 0
              ? `${filtered.length} student${filtered.length !== 1 ? 's' : ''} at risk of dropout`
              : 'No at-risk students found'}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--surface-container)]">
                <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">Student</th>
                <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">Class</th>
                <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">Days Absent</th>
                <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">Last Attendance</th>
                <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">Risk Level</th>
                <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">Parent Phone</th>
                <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-[var(--t3)]">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-[var(--t3)]">No at-risk students found</td></tr>
              ) : (
                filtered.map((student) => (
                  <tr key={student.id} className="border-b border-[var(--border)]">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: student.gender === 'M' ? 'var(--navy)' : 'var(--red)' }}>
                          {student.first_name?.charAt(0)}{student.last_name?.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{student.first_name} {student.last_name}</div>
                          <div className="text-xs text-[var(--t3)]">{student.student_number || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 bg-gray-100 rounded-full text-xs font-semibold">{student.class_name}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-bold" style={{ color: student.consecutive_absent >= 30 ? '#e74c3c' : '#f39c12' }}>
                        {student.consecutive_absent} days
                      </span>
                    </td>
                    <td className="p-4 text-sm">
                      {student.last_attendance_date
                        ? new Date(student.last_attendance_date).toLocaleDateString()
                        : 'No record'}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        student.risk_level === 'likely_dropout'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {student.risk_level === 'likely_dropout' ? 'Likely Dropout' : 'At Risk'}
                      </span>
                    </td>
                    <td className="p-4 text-sm font-mono">{student.parent_phone || '-'}</td>
                    <td className="p-4">
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleContactParent(student)}
                          disabled={sendingSms === student.id || !student.parent_phone}
                          className="px-2 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-40"
                          title="Send SMS to parent"
                        >
                          <MaterialIcon icon="sms" className="text-sm mr-0.5" />
                          {sendingSms === student.id ? 'Sending...' : 'Contact'}
                        </button>
                        <button
                          onClick={() => setShowDropoutModal(student.id)}
                          className="px-2 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                          title="Mark as dropout"
                        >
                          <MaterialIcon icon="person_remove" className="text-sm mr-0.5" />
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
      </Card>

      {showDropoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDropoutModal(null)}>
          <div className="bg-[var(--surface)] rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--on-surface)]">Mark as Dropout</h2>
              <button onClick={() => setShowDropoutModal(null)} className="p-1 hover:bg-[var(--surface-container)] rounded-lg">
                <MaterialIcon className="text-xl text-[var(--t3)]">close</MaterialIcon>
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-[var(--t3)] mb-4">This will set the student status to &quot;dropped&quot;. Please provide a reason.</p>
              <div className="mb-5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">Reason for Dropout</label>
                <select value={dropoutReason} onChange={(e) => setDropoutReason(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]" required>
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
              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1" onClick={() => setShowDropoutModal(null)}>Cancel</Button>
                <Button variant="danger" className="flex-1" onClick={handleMarkDropout} disabled={!dropoutReason}>Mark as Dropout</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

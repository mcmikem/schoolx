'use client'
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/index'

type CheckType = 'morning' | 'night'
type AttendanceStatus = 'present' | 'absent' | 'sick'
type AbsenceReason = 'went_home' | 'in_hospital' | 'missing' | 'other'

const CHECK_TYPES: { value: CheckType; label: string; time: string }[] = [
  { value: 'morning', label: 'Morning Roll Call', time: '5:30 AM' },
  { value: 'night', label: 'Night Roll Call', time: '9:00 PM' },
]

const ABSENCE_REASONS: { value: AbsenceReason; label: string }[] = [
  { value: 'went_home', label: 'Went Home' },
  { value: 'in_hospital', label: 'In Hospital' },
  { value: 'missing', label: 'Missing' },
  { value: 'other', label: 'Other' },
]

interface StudentAttendance {
  student_id: string
  status: AttendanceStatus
  absence_reason?: AbsenceReason
  absence_notes?: string
  id?: string
}

export default function DormAttendancePage() {
  const { school, user } = useAuth()
  const toast = useToast()

  const [dorms, setDorms] = useState<any[]>([])
  const [selectedDorm, setSelectedDorm] = useState<any>(null)
  const [checkType, setCheckType] = useState<CheckType>('night')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [students, setStudents] = useState<any[]>([])
  const [attendance, setAttendance] = useState<Map<string, StudentAttendance>>(new Map())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingReason, setEditingReason] = useState<string | null>(null)

  const fetchDorms = useCallback(async () => {
    const { data } = await supabase
      .from('dorms')
      .select('*')
      .eq('school_id', school?.id)
    setDorms(data || [])
  }, [school?.id])

  const fetchStudentsAndAttendance = useCallback(async () => {
    if (!selectedDorm) return
    setLoading(true)

    const { data: dormStudents } = await supabase
      .from('dorm_students')
      .select('student_id, students(*)')
      .eq('dorm_id', selectedDorm.id)

    const studentList = dormStudents?.map((ds: any) => ds.students) || []
    setStudents(studentList)

    const { data: attendanceData } = await supabase
      .from('dorm_attendance')
      .select('*')
      .eq('dorm_id', selectedDorm.id)
      .eq('date', date)
      .eq('check_type', checkType)

    const attendanceMap = new Map<string, StudentAttendance>()
    attendanceData?.forEach((a: any) => {
      attendanceMap.set(a.student_id, {
        student_id: a.student_id,
        status: a.status,
        absence_reason: a.absence_reason,
        absence_notes: a.absence_notes,
        id: a.id,
      })
    })
    setAttendance(attendanceMap)
    setLoading(false)
  }, [selectedDorm, date, checkType])

  useEffect(() => {
    if (school?.id) fetchDorms()
  }, [fetchDorms, school?.id])

  useEffect(() => {
    if (selectedDorm && date && checkType) {
      fetchStudentsAndAttendance()
    }
  }, [selectedDorm, date, checkType, fetchStudentsAndAttendance])

  const updateStatus = (studentId: string, status: AttendanceStatus) => {
    const newAttendance = new Map(attendance)
    const existing = newAttendance.get(studentId)
    newAttendance.set(studentId, {
      student_id: studentId,
      status,
      absence_reason: status === 'absent' ? existing?.absence_reason || undefined : undefined,
      absence_notes: status === 'absent' ? existing?.absence_notes : undefined,
      id: existing?.id,
    })
    setAttendance(newAttendance)
    if (status === 'absent') setEditingReason(studentId)
  }

  const updateReason = (studentId: string, reason: AbsenceReason, notes?: string) => {
    const newAttendance = new Map(attendance)
    const existing = newAttendance.get(studentId)
    if (existing) {
      newAttendance.set(studentId, { ...existing, absence_reason: reason, absence_notes: notes })
      setAttendance(newAttendance)
    }
  }

  const markAllPresent = () => {
    const newAttendance = new Map<string, StudentAttendance>()
    students.forEach(s => {
      newAttendance.set(s.id, {
        student_id: s.id,
        status: 'present',
        id: attendance.get(s.id)?.id,
      })
    })
    setAttendance(newAttendance)
  }

  const saveAttendance = async () => {
    setSaving(true)
    try {
      const checkedAt = new Date().toISOString()

      // Separate records into updates (have an id) and inserts (new records)
      const toUpdate: { id: string; status: AttendanceStatus; absence_reason?: AbsenceReason; absence_notes?: string; checked_at: string }[] = []
      const toInsert: { dorm_id: string; date: string; student_id: string; check_type: CheckType; status: AttendanceStatus; absence_reason?: AbsenceReason; absence_notes?: string; checked_by?: string; checked_at: string }[] = []

      for (const [studentId, record] of Array.from(attendance.entries())) {
        if (record.id) {
          toUpdate.push({
            id: record.id,
            status: record.status,
            absence_reason: record.absence_reason,
            absence_notes: record.absence_notes,
            checked_at: checkedAt,
          })
        } else {
          toInsert.push({
            dorm_id: selectedDorm.id,
            date,
            student_id: studentId,
            check_type: checkType,
            status: record.status,
            absence_reason: record.absence_reason,
            absence_notes: record.absence_notes,
            checked_by: user?.id,
            checked_at: checkedAt,
          })
        }
      }

      // Batch upsert: single request for all new records
      if (toInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('dorm_attendance')
          .insert(toInsert)
        if (insertError) throw insertError
      }

      // Batch upsert: single request for all existing records
      if (toUpdate.length > 0) {
        const { error: upsertError } = await supabase
          .from('dorm_attendance')
          .upsert(toUpdate, { onConflict: 'id' })
        if (upsertError) throw upsertError
      }

      toast.success('Attendance saved successfully')
      fetchStudentsAndAttendance()
    } catch (err: any) {
      toast.error(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const presentCount = Array.from(attendance.values()).filter(a => a.status === 'present').length
  const absentCount = Array.from(attendance.values()).filter(a => a.status === 'absent').length
  const sickCount = Array.from(attendance.values()).filter(a => a.status === 'sick').length
  const totalMarked = Array.from(attendance.values()).length

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Dorm Attendance"
        subtitle="Morning (5:30 AM) and Night (9:00 PM) roll calls"
      />

      <Card className="p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Dorm</label>
            {dorms.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">No dorms</div>
            ) : (
              <select
                value={selectedDorm?.id || ''}
                onChange={(e) => setSelectedDorm(dorms.find(d => d.id === e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm"
              >
                <option value="">Select dorm...</option>
                {dorms.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Check Type</label>
            <select value={checkType} onChange={(e) => setCheckType(e.target.value as CheckType)} className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm">
              {CHECK_TYPES.map(ct => (
                <option key={ct.value} value={ct.value}>{ct.label} ({ct.time})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">&nbsp;</label>
            <Button variant="secondary" onClick={markAllPresent} disabled={!selectedDorm} className="w-full">
              <MaterialIcon icon="check_circle" className="text-base" />
              Mark All Present
            </Button>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">&nbsp;</label>
            <Button onClick={saveAttendance} disabled={saving || !selectedDorm} className="w-full">
              {saving ? 'Saving...' : 'Save Attendance'}
            </Button>
          </div>
        </div>
      </Card>

      {selectedDorm && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{presentCount}</div>
            <div className="text-sm text-[var(--t3)]">Present</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{absentCount}</div>
            <div className="text-sm text-[var(--t3)]">Absent</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{sickCount}</div>
            <div className="text-sm text-[var(--t3)]">Sick</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-[var(--primary)]">{totalMarked}/{students.length}</div>
            <div className="text-sm text-[var(--t3)]">Marked</div>
          </Card>
        </div>
      )}

      {selectedDorm && (
        <Card>
          <div className="p-4 border-b border-[var(--border)]">
            <h3 className="font-semibold text-[var(--t1)]">{selectedDorm.name} — Students ({students.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--surface-container)]">
                  <th className="p-4 text-left text-sm font-semibold text-[var(--t1)]">Student</th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--t1)]">Status</th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--t1)]">Absence Reason</th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--t1)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map(student => {
                  const record = attendance.get(student.id)
                  const status = record?.status || 'pending'

                  return (
                    <tr key={student.id} className="border-b border-[var(--border)]">
                      <td className="p-4 font-medium text-[var(--t1)]">{student.first_name} {student.last_name}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          status === 'present' ? 'bg-green-100 text-green-800' :
                          status === 'absent' ? 'bg-red-100 text-red-800' :
                          status === 'sick' ? 'bg-amber-100 text-amber-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {status}
                        </span>
                      </td>
                      <td className="p-4">
                        {status === 'absent' && editingReason === student.id ? (
                          <div className="flex flex-col gap-1">
                            <select
                              value={record?.absence_reason || ''}
                              onChange={(e) => updateReason(student.id, e.target.value as AbsenceReason)}
                              className="px-3 py-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs"
                            >
                              <option value="">Select reason...</option>
                              {ABSENCE_REASONS.map(r => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                              ))}
                            </select>
                            <input
                              type="text"
                              placeholder="Notes (optional)"
                              value={record?.absence_notes || ''}
                              onChange={(e) => updateReason(student.id, record?.absence_reason || 'other', e.target.value)}
                              className="px-3 py-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs"
                            />
                            <button onClick={() => setEditingReason(null)} className="text-xs text-blue-600">Done</button>
                          </div>
                        ) : status === 'absent' && record?.absence_reason ? (
                          <span className="text-sm text-red-600">
                            {ABSENCE_REASONS.find(r => r.value === record.absence_reason)?.label}
                            {record.absence_notes ? ` — ${record.absence_notes}` : ''}
                          </span>
                        ) : (
                          <span className="text-sm text-[var(--t3)]">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-1">
                          <button
                            onClick={() => updateStatus(student.id, 'present')}
                            className={`px-2 py-1 rounded text-xs font-bold ${status === 'present' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                          >P</button>
                          <button
                            onClick={() => updateStatus(student.id, 'absent')}
                            className={`px-2 py-1 rounded text-xs font-bold ${status === 'absent' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                          >A</button>
                          <button
                            onClick={() => updateStatus(student.id, 'sick')}
                            className={`px-2 py-1 rounded text-xs font-bold ${status === 'sick' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                          >S</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {students.length === 0 && !loading && (
                  <tr><td colSpan={4} className="text-center py-8 text-[var(--t3)]">No students assigned to this dorm</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!selectedDorm && (
        <Card className="p-12 text-center">
          <MaterialIcon className="text-5xl text-[var(--t3)] opacity-50 mx-auto">bed</MaterialIcon>
          <p className="mt-2 text-[var(--t3)]">Select a dorm to take attendance</p>
        </Card>
      )}
    </div>
    </PageErrorBoundary>
  )
}

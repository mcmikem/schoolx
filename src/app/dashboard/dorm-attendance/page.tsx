'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import MaterialIcon from '@/components/MaterialIcon'

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
      for (const [studentId, record] of Array.from(attendance.entries())) {
        if (record.id) {
          await supabase
            .from('dorm_attendance')
            .update({
              status: record.status,
              absence_reason: record.absence_reason,
              absence_notes: record.absence_notes,
              checked_at: new Date().toISOString(),
            })
            .eq('id', record.id)
        } else {
          await supabase
            .from('dorm_attendance')
            .insert({
              dorm_id: selectedDorm.id,
              date,
              student_id: studentId,
              check_type: checkType,
              status: record.status,
              absence_reason: record.absence_reason,
              absence_notes: record.absence_notes,
              checked_by: user?.id,
              checked_at: new Date().toISOString(),
            })
        }
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
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Dorm Attendance</h1>
        <p className="text-[#5c6670] mt-1">Morning (5:30 AM) and Night (9:00 PM) roll calls</p>
      </div>

      <div className="card mb-6">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Dorm</label>
              {dorms.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">No dorms</div>
              ) : (
                <select
                  value={selectedDorm?.id || ''}
                  onChange={(e) => setSelectedDorm(dorms.find(d => d.id === e.target.value))}
                  className="input"
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
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Check Type</label>
              <select value={checkType} onChange={(e) => setCheckType(e.target.value as CheckType)} className="input">
                {CHECK_TYPES.map(ct => (
                  <option key={ct.value} value={ct.value}>{ct.label} ({ct.time})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">&nbsp;</label>
              <button onClick={markAllPresent} disabled={!selectedDorm} className="btn bg-green-600 text-white w-full">
                <MaterialIcon icon="check_circle" style={{ fontSize: 18 }} />
                Mark All Present
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">&nbsp;</label>
              <button onClick={saveAttendance} disabled={saving || !selectedDorm} className="btn btn-primary w-full">
                {saving ? 'Saving...' : 'Save Attendance'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {selectedDorm && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card">
            <div className="card-body text-center">
              <div className="text-2xl font-bold text-green-600">{presentCount}</div>
              <div className="text-sm text-[#5c6670]">Present</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body text-center">
              <div className="text-2xl font-bold text-red-600">{absentCount}</div>
              <div className="text-sm text-[#5c6670]">Absent</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body text-center">
              <div className="text-2xl font-bold text-amber-600">{sickCount}</div>
              <div className="text-sm text-[#5c6670]">Sick</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body text-center">
              <div className="text-2xl font-bold text-[#002045]">{totalMarked}/{students.length}</div>
              <div className="text-sm text-[#5c6670]">Marked</div>
            </div>
          </div>
        </div>
      )}

      {selectedDorm && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">{selectedDorm.name} — Students ({students.length})</div>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Status</th>
                  <th>Absence Reason</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map(student => {
                  const record = attendance.get(student.id)
                  const status = record?.status || 'pending'

                  return (
                    <tr key={student.id}>
                      <td className="font-medium">{student.first_name} {student.last_name}</td>
                      <td>
                        <span className={`badge ${
                          status === 'present' ? 'bg-green-100 text-green-800' :
                          status === 'absent' ? 'bg-red-100 text-red-800' :
                          status === 'sick' ? 'bg-amber-100 text-amber-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {status}
                        </span>
                      </td>
                      <td>
                        {status === 'absent' && editingReason === student.id ? (
                          <div className="flex flex-col gap-1">
                            <select
                              value={record?.absence_reason || ''}
                              onChange={(e) => updateReason(student.id, e.target.value as AbsenceReason)}
                              className="input text-xs py-1"
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
                              className="input text-xs py-1"
                            />
                            <button onClick={() => setEditingReason(null)} className="text-xs text-blue-600">Done</button>
                          </div>
                        ) : status === 'absent' && record?.absence_reason ? (
                          <span className="text-sm text-red-600">
                            {ABSENCE_REASONS.find(r => r.value === record.absence_reason)?.label}
                            {record.absence_notes ? ` — ${record.absence_notes}` : ''}
                          </span>
                        ) : (
                          <span className="text-sm text-[#5c6670]">—</span>
                        )}
                      </td>
                      <td>
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
                  <tr><td colSpan={4} className="text-center py-8 text-[#5c6670]">No students assigned to this dorm</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!selectedDorm && (
        <div className="card">
          <div className="card-body text-center py-12 text-[#5c6670]">
            <MaterialIcon icon="bed" style={{ fontSize: 48, opacity: 0.5 }} />
            <p className="mt-2">Select a dorm to take attendance</p>
          </div>
        </div>
      )}
    </div>
  )
}

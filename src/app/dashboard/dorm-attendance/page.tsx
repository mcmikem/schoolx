'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

interface DormAttendance {
  id: string
  dorm_id: string
  date: string
  student_id: string
  status: 'present' | 'absent' | 'sick' | 'permission'
  notes?: string
  checked_at?: string
  students?: { first_name: string; last_name: string }
}

export default function DormAttendancePage() {
  const { school, user } = useAuth()
  const toast = useToast()
  
  const [dorms, setDorms] = useState<any[]>([])
  const [selectedDorm, setSelectedDorm] = useState<any>(null)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [students, setStudents] = useState<any[]>([])
  const [attendance, setAttendance] = useState<Map<string, DormAttendance>>(new Map())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (school?.id) fetchDorms()
  }, [school?.id])

  useEffect(() => {
    if (selectedDorm && date) {
      fetchStudentsAndAttendance()
    }
  }, [selectedDorm, date])

  const fetchDorms = async () => {
    const { data } = await supabase
      .from('dorms')
      .select('*')
      .eq('school_id', school?.id)
    setDorms(data || [])
  }

  const fetchStudentsAndAttendance = async () => {
    if (!selectedDorm) return
    setLoading(true)

    // Get students in this dorm
    const { data: dormStudents } = await supabase
      .from('dorm_students')
      .select('student_id, students(*)')
      .eq('dorm_id', selectedDorm.id)

    const studentList = dormStudents?.map(ds => ds.students) || []
    setStudents(studentList)

    // Get existing attendance for this dorm and date
    const { data: attendanceData } = await supabase
      .from('dorm_attendance')
      .select('*')
      .eq('dorm_id', selectedDorm.id)
      .eq('date', date)

    const attendanceMap = new Map<string, DormAttendance>()
    attendanceData?.forEach(a => attendanceMap.set(a.student_id, a))
    setAttendance(attendanceMap)

    setLoading(false)
  }

  const updateStatus = (studentId: string, status: 'present' | 'absent' | 'sick' | 'permission') => {
    const newAttendance = new Map(attendance)
    const existing = newAttendance.get(studentId)
    
    newAttendance.set(studentId, {
      id: existing?.id || '',
      dorm_id: selectedDorm.id,
      date,
      student_id: studentId,
      status,
      checked_at: new Date().toISOString()
    })
    setAttendance(newAttendance)
  }

  const saveAttendance = async () => {
    setSaving(true)
    try {
      for (const [studentId, record] of Array.from(attendance.entries())) {
        if (record.id) {
          // Update existing
          await supabase
            .from('dorm_attendance')
            .update({ status: record.status, checked_at: record.checked_at })
            .eq('id', record.id)
        } else {
          // Insert new
          await supabase
            .from('dorm_attendance')
            .insert({
              dorm_id: selectedDorm.id,
              date,
              student_id: studentId,
              status: record.status,
              checked_by: user?.id,
              checked_at: record.checked_at
            })
        }
      }
      toast.success('Attendance saved successfully')
    } catch (err: any) {
      toast.error(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const markAllPresent = () => {
    const newAttendance = new Map(attendance)
    students.forEach(s => {
      newAttendance.set(s.id, {
        id: attendance.get(s.id)?.id || '',
        dorm_id: selectedDorm.id,
        date,
        student_id: s.id,
        status: 'present',
        checked_at: new Date().toISOString()
      })
    })
    setAttendance(newAttendance)
  }

  const presentCount = Array.from(attendance.values()).filter(a => a.status === 'present').length
  const absentCount = Array.from(attendance.values()).filter(a => a.status === 'absent').length
  const sickCount = Array.from(attendance.values()).filter(a => a.status === 'sick').length
  const totalMarked = Array.from(attendance.values()).length

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Dorm Night Attendance</h1>
        <p className="text-[#5c6670] mt-1">Track students in dormitories at night</p>
      </div>

      {/* Controls */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Select Dorm</label>
              <select 
                value={selectedDorm?.id || ''} 
                onChange={(e) => setSelectedDorm(dorms.find(d => d.id === e.target.value))} 
                className="input"
              >
                <option value="">Select dorm...</option>
                {dorms.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.gender})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
                className="input"
              />
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

      {/* Stats */}
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

      {/* Student List */}
      {selectedDorm && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">{selectedDorm.name} - Students ({students.length})</div>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Status</th>
                  <th>Quick Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map(student => {
                  const record = attendance.get(student.id)
                  const status = record?.status || 'pending'
                  
                  return (
                    <tr key={student.id}>
                      <td>{student.first_name} {student.last_name}</td>
                      <td>
                        <span className={`badge ${
                          status === 'present' ? 'bg-green-100 text-green-800' :
                          status === 'absent' ? 'bg-red-100 text-red-800' :
                          status === 'sick' ? 'bg-amber-100 text-amber-800' :
                          status === 'permission' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {status}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button 
                            onClick={() => updateStatus(student.id, 'present')}
                            className={`btn-sm ${status === 'present' ? 'bg-green-600' : 'bg-gray-100'} text-white px-2 py-1 rounded`}
                            title="Present"
                          >
                            P
                          </button>
                          <button 
                            onClick={() => updateStatus(student.id, 'absent')}
                            className={`btn-sm ${status === 'absent' ? 'bg-red-600' : 'bg-gray-100'} text-white px-2 py-1 rounded`}
                            title="Absent"
                          >
                            A
                          </button>
                          <button 
                            onClick={() => updateStatus(student.id, 'sick')}
                            className={`btn-sm ${status === 'sick' ? 'bg-amber-600' : 'bg-gray-100'} text-white px-2 py-1 rounded`}
                            title="Sick"
                          >
                            S
                          </button>
                          <button 
                            onClick={() => updateStatus(student.id, 'permission')}
                            className={`btn-sm ${status === 'permission' ? 'bg-blue-600' : 'bg-gray-100'} text-white px-2 py-1 rounded`}
                            title="Permission"
                          >
                            Perm
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {students.length === 0 && !loading && (
                  <tr><td colSpan={3} className="text-center py-8 text-[#5c6670]">No students assigned to this dorm</td></tr>
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

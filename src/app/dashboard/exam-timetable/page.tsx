'use client'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useClasses, useSubjects, useStaff } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
}

interface ExamSlot {
  id: string
  date: string
  day: string
  start_time: string
  end_time: string
  subject_id: string
  class_id: string
  room: string
  supervisor_id: string
  title?: string
}

function getDayName(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { weekday: 'long' })
}

export default function ExamTimetablePage() {
  const { school, user } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const toast = useToast()
  
  const { classes } = useClasses(school?.id)
  const { subjects } = useSubjects(school?.id, false)
  const { staff } = useStaff(school?.id)
  
  const [examSlots, setExamSlots] = useState<ExamSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<string[]>([])
  
  const [newExam, setNewExam] = useState({
    exam_date: '',
    start_time: '09:00',
    end_time: '11:00',
    subject_id: '',
    class_id: '',
    room: '',
    supervisor_id: '',
  })

  const fetchExamTimetable = useCallback(async () => {
    if (!school?.id) return
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*, subjects(name), classes(name), users!events_supervisor_id_fkey(full_name)')
        .eq('school_id', school.id)
        .eq('event_type', 'exam')
        .order('start_date', { ascending: true })

      if (error) throw error

      const slots: ExamSlot[] = (data || []).map((event: any) => {
        const desc = event.description ? JSON.parse(event.description) : {}
        return {
          id: event.id,
          date: event.start_date,
          day: getDayName(event.start_date),
          start_time: desc.time?.split('-')[0] || '09:00',
          end_time: desc.time?.split('-')[1] || '11:00',
          subject_id: desc.subject_id || '',
          class_id: desc.class_id || '',
          room: desc.room || '',
          supervisor_id: desc.supervisor_id || '',
          title: event.title,
        }
      })
      setExamSlots(slots)
    } catch (err) {
      console.error('Error fetching exam timetable:', err)
    } finally {
      setLoading(false)
    }
  }, [school?.id])

  const detectConflicts = (exam: typeof newExam, excludeId?: string): string[] => {
    const conflicts: string[] = []
    const examDate = exam.exam_date
    const examStart = exam.start_time
    const examEnd = exam.end_time
    const examClassId = exam.class_id
    const examRoom = exam.room
    const examSupervisor = exam.supervisor_id

    const existingSlots = examSlots.filter(s => s.id !== excludeId)

    for (const slot of existingSlots) {
      if (slot.date !== examDate) continue
      
      const slotStart = slot.start_time
      const slotEnd = slot.end_time
      
      const overlaps = examStart < slotEnd && examEnd > slotStart
      if (!overlaps) continue

      if (slot.class_id === examClassId) {
        conflicts.push(`Class "${classes.find(c => c.id === examClassId)?.name}" already has an exam at this time`)
      }

      if (slot.room && examRoom && slot.room.toLowerCase() === examRoom.toLowerCase()) {
        conflicts.push(`Room "${examRoom}" is already booked for this time`)
      }

      if (slot.supervisor_id && examSupervisor && slot.supervisor_id === examSupervisor) {
        const sup = staff.find(s => s.id === examSupervisor)
        conflicts.push(`Teacher "${sup?.full_name || 'Unknown'}" is already supervising at this time`)
      }
    }

    return conflicts
  }

  const handleSaveExam = async () => {
    if (!school?.id || !user?.id) return
    
    if (!newExam.exam_date || !newExam.subject_id || !newExam.class_id || !newExam.room || !newExam.supervisor_id) {
      toast.error('Please fill all required fields')
      return
    }

    const detectedConflicts = detectConflicts(newExam, editingId || undefined)
    setConflicts(detectedConflicts)

    if (detectedConflicts.length > 0) {
      return
    }

    try {
      setSaving(true)

      const subject = subjects.find(s => s.id === newExam.subject_id)
      const classObj = classes.find(c => c.id === newExam.class_id)
      const sup = staff.find(s => s.id === newExam.supervisor_id)
      
      const title = `${classObj?.name} ${subject?.name} Exam`
      const description = JSON.stringify({
        time: `${newExam.start_time}-${newExam.end_time}`,
        room: newExam.room,
        subject_id: newExam.subject_id,
        class_id: newExam.class_id,
        supervisor_id: newExam.supervisor_id,
      })

      if (editingId) {
        await supabase
          .from('events')
          .update({
            title,
            start_date: newExam.exam_date,
            description,
          })
          .eq('id', editingId)
        toast.success('Exam timetable updated')
      } else {
        await supabase
          .from('events')
          .insert({
            school_id: school.id,
            title,
            description,
            event_type: 'exam',
            start_date: newExam.exam_date,
            created_by: user.id,
          })
        toast.success('Exam added to timetable')
      }

      setShowAddModal(false)
      setNewExam({
        exam_date: '',
        start_time: '09:00',
        end_time: '11:00',
        subject_id: '',
        class_id: '',
        room: '',
        supervisor_id: '',
      })
      setEditingId(null)
      setConflicts([])
      fetchExamTimetable()
    } catch (err) {
      toast.error('Failed to save exam')
    } finally {
      setSaving(false)
    }
  }

  const handleEditExam = (slot: ExamSlot) => {
    setNewExam({
      exam_date: slot.date,
      start_time: slot.start_time,
      end_time: slot.end_time,
      subject_id: slot.subject_id,
      class_id: slot.class_id,
      room: slot.room,
      supervisor_id: slot.supervisor_id,
    })
    setEditingId(slot.id)
    setShowAddModal(true)
  }

  const handleDeleteExam = async (id: string) => {
    if (!confirm('Are you sure you want to delete this exam?')) return
    
    try {
      await supabase.from('events').delete().eq('id', id)
      toast.success('Exam deleted')
      fetchExamTimetable()
    } catch (err) {
      toast.error('Failed to delete exam')
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const sortedSlots = useMemo(() => {
    return [...examSlots].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return a.start_time.localeCompare(b.start_time)
    })
  }, [examSlots])

  const groupByDate = useMemo(() => {
    const groups: Record<string, ExamSlot[]> = {}
    sortedSlots.forEach(slot => {
      if (!groups[slot.date]) groups[slot.date] = []
      groups[slot.date].push(slot)
    })
    return groups
  }, [sortedSlots])

  const checkConflictsWithCurrent = useCallback(() => {
    if (!newExam.exam_date) {
      setConflicts([])
      return
    }
    const detected = detectConflicts(newExam, editingId || undefined)
    setConflicts(detected)
  }, [newExam, editingId, examSlots, classes, staff])

  useEffect(() => {
    fetchExamTimetable()
  }, [fetchExamTimetable])

  useEffect(() => {
    if (showAddModal) {
      checkConflictsWithCurrent()
    }
  }, [checkConflictsWithCurrent, showAddModal])

  return (
    <div className="content">
      <div className="page-header">
        <div>
          <div className="ph-title">Exam Timetable</div>
          <div className="ph-sub">
            {academicYear} Term {currentTerm} • Build and manage exam schedule
          </div>
        </div>
        <div className="ph-actions">
          <button onClick={handlePrint} className="btn btn-secondary">
            <MaterialIcon icon="print" style={{ fontSize: '16px' }} />
            Print
          </button>
          <button onClick={() => { setEditingId(null); setNewExam({ exam_date: '', start_time: '09:00', end_time: '11:00', subject_id: '', class_id: '', room: '', supervisor_id: '' }); setShowAddModal(true) }} className="btn btn-primary">
            <MaterialIcon icon="add" style={{ fontSize: '16px' }} />
            Add Exam
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 40 }}>
          <div className="skeleton" style={{ height: 200 }}></div>
        </div>
      ) : examSlots.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <MaterialIcon style={{ fontSize: 48, color: 'var(--t3)', marginBottom: 12 }}>event_note</MaterialIcon>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--t1)' }}>No exam timetable created</div>
          <div style={{ fontSize: 13, color: 'var(--t3)', marginTop: 4 }}>Add exams to build the timetable</div>
        </div>
      ) : (
        Object.entries(groupByDate).map(([date, slots]) => (
          <div key={date} className="card" style={{ padding: 0, marginBottom: 20 }}>
            <div style={{ padding: '14px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700, color: 'var(--t1)' }}>
                {new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Time</th>
                  <th>Subject</th>
                  <th>Class</th>
                  <th>Room</th>
                  <th>Supervisor</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => {
                  const subject = subjects.find(s => s.id === slot.subject_id)
                  const classObj = classes.find(c => c.id === slot.class_id)
                  const sup = staff.find(s => s.id === slot.supervisor_id)
                  
                  return (
                    <tr key={slot.id}>
                      <td style={{ fontWeight: 600 }}>{slot.day}</td>
                      <td style={{ fontFamily: 'DM Mono', fontSize: 12 }}>{slot.start_time} - {slot.end_time}</td>
                      <td>{subject?.name || '-'}</td>
                      <td>{classObj?.name || '-'}</td>
                      <td>{slot.room}</td>
                      <td>{sup?.full_name || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => handleEditExam(slot)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                            <MaterialIcon style={{ fontSize: 16, color: 'var(--t3)' }}>edit</MaterialIcon>
                          </button>
                          <button onClick={() => handleDeleteExam(slot.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                            <MaterialIcon style={{ fontSize: 16, color: 'var(--red)' }}>delete</MaterialIcon>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => { setShowAddModal(false); setConflicts([]) }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ fontFamily: 'Sora', fontSize: 16, fontWeight: 700 }}>
                {editingId ? 'Edit Exam' : 'Add Exam to Timetable'}
              </div>
              <button onClick={() => { setShowAddModal(false); setConflicts([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <MaterialIcon style={{ fontSize: 18, color: 'var(--t3)' }}>close</MaterialIcon>
              </button>
            </div>
            <div className="modal-body" style={{ padding: 20 }}>
              {conflicts.length > 0 && (
                <div style={{ padding: 12, background: 'var(--red-soft)', borderRadius: 8, marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>
                    <MaterialIcon icon="warning" style={{ fontSize: 14, verticalAlign: 'middle' }} /> Conflicts detected
                  </div>
                  {conflicts.map((c, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--red)', marginBottom: 4 }}>• {c}</div>
                  ))}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Exam Date *</label>
                  <input type="date" value={newExam.exam_date} onChange={e => setNewExam({...newExam, exam_date: e.target.value})} className="input" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Room *</label>
                  <input type="text" value={newExam.room} onChange={e => setNewExam({...newExam, room: e.target.value})} placeholder="e.g., Hall A, Room 101" className="input" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Start Time *</label>
                  <input type="time" value={newExam.start_time} onChange={e => setNewExam({...newExam, start_time: e.target.value})} className="input" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>End Time *</label>
                  <input type="time" value={newExam.end_time} onChange={e => setNewExam({...newExam, end_time: e.target.value})} className="input" />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Subject *</label>
                <select value={newExam.subject_id} onChange={e => setNewExam({...newExam, subject_id: e.target.value})} className="input">
                  <option value="">Select subject</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Class *</label>
                <select value={newExam.class_id} onChange={e => setNewExam({...newExam, class_id: e.target.value})} className="input">
                  <option value="">Select class</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, display: 'block' }}>Supervisor (Teacher) *</label>
                <select value={newExam.supervisor_id} onChange={e => setNewExam({...newExam, supervisor_id: e.target.value})} className="input">
                  <option value="">Select teacher</option>
                  {staff.map(t => (
                    <option key={t.id} value={t.id}>{t.full_name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => { setShowAddModal(false); setConflicts([]) }} className="btn btn-ghost">Cancel</button>
              <button 
                onClick={handleSaveExam} 
                disabled={saving || conflicts.length > 0}
                className="btn btn-primary"
              >
                {saving ? 'Saving...' : conflicts.length > 0 ? 'Fix Conflicts First' : (editingId ? 'Update Exam' : 'Add Exam')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

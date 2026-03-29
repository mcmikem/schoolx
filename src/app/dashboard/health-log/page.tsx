'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

type IncidentType = 'Fever' | 'Headache' | 'Injury' | 'Stomach pain' | 'Allergic reaction' | 'Other'
type ActionType = 'Rested in sick bay' | 'Given paracetamol' | 'Sent to hospital' | 'Called parent'

const INCIDENT_TYPES: IncidentType[] = ['Fever', 'Headache', 'Injury', 'Stomach pain', 'Allergic reaction', 'Other']
const ACTION_TYPES: ActionType[] = ['Rested in sick bay', 'Given paracetamol', 'Sent to hospital', 'Called parent']

interface HealthIncident {
  id: string
  student_id: string
  incident_time: string
  incident_type: IncidentType
  action_taken: ActionType
  notes?: string
  created_at: string
  students?: { first_name: string; last_name: string }
}

export default function HealthLogPage() {
  const { school, user } = useAuth()
  const toast = useToast()
  const [incidents, setIncidents] = useState<HealthIncident[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    student_id: '',
    incident_type: '' as IncidentType | '',
    action_taken: '' as ActionType | '',
    notes: '',
  })

  const today = new Date().toISOString().split('T')[0]
  const todayIncidents = incidents.filter(i => i.incident_time?.startsWith(today))
  const sickBayToday = todayIncidents.filter(i => i.action_taken === 'Rested in sick bay').length

  const fetchIncidents = useCallback(async () => {
    if (!school?.id) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('health_incidents')
        .select('*, students(first_name, last_name)')
        .eq('school_id', school.id)
        .order('incident_time', { ascending: false })
      setIncidents(data || [])
    } catch {
      console.error('Error fetching incidents')
    } finally {
      setLoading(false)
    }
  }, [school?.id])

  const fetchStudents = useCallback(async () => {
    if (!school?.id) return
    const { data } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('school_id', school.id)
      .order('first_name')
    setStudents(data || [])
  }, [school?.id])

  useEffect(() => {
    if (school?.id) {
      fetchIncidents()
      fetchStudents()
    }
  }, [school?.id, fetchIncidents, fetchStudents])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school?.id || !formData.student_id || !formData.incident_type || !formData.action_taken) return

    setSubmitting(true)
    try {
      const { error } = await supabase.from('health_incidents').insert({
        school_id: school.id,
        student_id: formData.student_id,
        incident_time: new Date().toISOString(),
        incident_type: formData.incident_type,
        action_taken: formData.action_taken,
        notes: formData.notes,
        recorded_by: user?.id,
      })
      if (error) throw error
      toast.success('Incident logged successfully')
      setShowModal(false)
      setFormData({ student_id: '', incident_type: '', action_taken: '', notes: '' })
      fetchIncidents()
    } catch (err: any) {
      toast.error(err.message || 'Failed to log incident')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#002045]">Health Incident Log</h1>
          <p className="text-[#5c6670] mt-1">Track and manage student health incidents</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <MaterialIcon icon="add" className="text-lg" />
          Log Incident
        </button>
      </div>

      {sickBayToday > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
          <MaterialIcon icon="warning" className="text-amber-600 text-2xl" />
          <div>
            <div className="font-semibold text-amber-800">{sickBayToday} student{sickBayToday > 1 ? 's' : ''} in sick bay today</div>
            <div className="text-sm text-amber-700">Monitor their condition regularly</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card"><div className="card-body text-center">
          <div className="text-2xl font-bold text-red-600">{todayIncidents.length}</div>
          <div className="text-sm text-[#5c6670]">Today&apos;s Incidents</div>
        </div></div>
        <div className="card"><div className="card-body text-center">
          <div className="text-2xl font-bold text-amber-600">{sickBayToday}</div>
          <div className="text-sm text-[#5c6670]">In Sick Bay</div>
        </div></div>
        <div className="card"><div className="card-body text-center">
          <div className="text-2xl font-bold text-[#002045]">{incidents.length}</div>
          <div className="text-sm text-[#5c6670]">Total Incidents</div>
        </div></div>
      </div>

      {todayIncidents.length > 0 && (
        <div className="card mb-6">
          <div className="card-header"><div className="card-title">Today&apos;s Incidents</div></div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>Student</th><th>Time</th><th>Type</th><th>Action Taken</th><th>Notes</th></tr>
              </thead>
              <tbody>
                {todayIncidents.map(inc => (
                  <tr key={inc.id}>
                    <td className="font-medium">{inc.students?.first_name} {inc.students?.last_name}</td>
                    <td>{new Date(inc.incident_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td><span className="badge bg-red-100 text-red-800">{inc.incident_type}</span></td>
                    <td><span className="badge bg-blue-100 text-blue-800">{inc.action_taken}</span></td>
                    <td className="max-w-xs truncate">{inc.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header"><div className="card-title">All Incidents</div></div>
        {loading ? (
          <div className="card-body text-center py-8"><div className="skeleton h-4 w-32 mx-auto" /></div>
        ) : incidents.length === 0 ? (
          <div className="card-body text-center py-12 text-[#5c6670]">
            <MaterialIcon icon="health_and_safety" style={{ fontSize: 48, opacity: 0.5 }} />
            <p className="mt-2">No health incidents recorded</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>Student</th><th>Date & Time</th><th>Type</th><th>Action Taken</th><th>Notes</th></tr>
              </thead>
              <tbody>
                {incidents.map(inc => (
                  <tr key={inc.id}>
                    <td className="font-medium">{inc.students?.first_name} {inc.students?.last_name}</td>
                    <td>{new Date(inc.incident_time).toLocaleString()}</td>
                    <td><span className="badge bg-red-100 text-red-800">{inc.incident_type}</span></td>
                    <td><span className="badge bg-blue-100 text-blue-800">{inc.action_taken}</span></td>
                    <td className="max-w-xs truncate">{inc.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[#e8eaed]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#191c1d]">Log Incident</h2>
                <button onClick={() => setShowModal(false)} className="p-2 text-[#5c6670] hover:text-[#191c1d]">
                  <MaterialIcon icon="close" className="text-xl" />
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Student</label>
                <select value={formData.student_id} onChange={e => setFormData({...formData, student_id: e.target.value})} className="input" required>
                  <option value="">Select student</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Time</label>
                <input type="text" value={new Date().toLocaleString()} readOnly className="input bg-gray-50" />
              </div>
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Incident Type</label>
                <select value={formData.incident_type} onChange={e => setFormData({...formData, incident_type: e.target.value as IncidentType})} className="input" required>
                  <option value="">Select type</option>
                  {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Action Taken</label>
                <select value={formData.action_taken} onChange={e => setFormData({...formData, action_taken: e.target.value as ActionType})} className="input" required>
                  <option value="">Select action</option>
                  {ACTION_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Notes</label>
                <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="input" rows={3} placeholder="Additional notes..." />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary flex-1">
                  {submitting ? 'Saving...' : 'Log Incident'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

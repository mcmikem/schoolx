'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useStudents } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

interface DisciplineRecord {
  id: string
  student_id: string
  incident_type: string
  description: string
  action_taken: string
  follow_up_date: string | null
  resolved: boolean
  reported_by: string
  created_at: string
  students?: {
    first_name: string
    last_name: string
    student_number: string
  }
}

const incidentTypes = [
  'Late arrival',
  'Absence without permission',
  'Disrespectful behavior',
  'Fighting',
  'Bullying',
  'Cheating',
  'Damage to property',
  'Uniform violation',
  'Other'
]

const actions = [
  'Verbal warning',
  'Written warning',
  'Detention',
  'Parent meeting',
  'Suspension',
  'Community service',
  'Other'
]

export default function DisciplinePage() {
  const { school, user } = useAuth()
  const toast = useToast()
  const { students } = useStudents(school?.id)
  const [records, setRecords] = useState<DisciplineRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filterResolved, setFilterResolved] = useState('all')
  const [newRecord, setNewRecord] = useState({
    student_id: '',
    incident_type: '',
    description: '',
    action_taken: '',
    follow_up_date: '',
  })

  useEffect(() => {
    fetchRecords()
  }, [school?.id])

  const fetchRecords = async () => {
    if (!school?.id) return
    try {
      const { data, error } = await supabase
        .from('discipline')
        .select('*, students(first_name, last_name, student_number)')
        .eq('school_id', school.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setRecords(data || [])
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school?.id || !user?.id) return

    try {
      const { error } = await supabase.from('discipline').insert({
        school_id: school.id,
        student_id: newRecord.student_id,
        incident_type: newRecord.incident_type,
        description: newRecord.description,
        action_taken: newRecord.action_taken,
        follow_up_date: newRecord.follow_up_date || null,
        resolved: false,
        reported_by: user.id,
      })

      if (error) throw error

      toast.success('Incident recorded')
      setShowModal(false)
      setNewRecord({ student_id: '', incident_type: '', description: '', action_taken: '', follow_up_date: '' })
      fetchRecords()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to record incident')
    }
  }

  const toggleResolved = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('discipline')
        .update({ resolved: !currentStatus })
        .eq('id', id)

      if (error) throw error
      setRecords(records.map(r => r.id === id ? { ...r, resolved: !currentStatus } : r))
      toast.success(currentStatus ? 'Marked as unresolved' : 'Marked as resolved')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  const filteredRecords = records.filter(r => {
    if (filterResolved === 'all') return true
    if (filterResolved === 'resolved') return r.resolved
    if (filterResolved === 'pending') return !r.resolved
    return true
  })

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#002045]">Discipline</h1>
          <p className="text-[#5c6670] mt-1">Track student incidents and actions</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <MaterialIcon icon="add" className="text-lg" />
          Record Incident
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
          <div className="text-2xl font-bold text-[#002045]">{records.length}</div>
          <div className="text-sm text-[#5c6670] mt-1">Total Incidents</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
          <div className="text-2xl font-bold text-[#b86e00]">{records.filter(r => !r.resolved).length}</div>
          <div className="text-sm text-[#5c6670] mt-1">Pending</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
          <div className="text-2xl font-bold text-[#006e1c]">{records.filter(r => r.resolved).length}</div>
          <div className="text-sm text-[#5c6670] mt-1">Resolved</div>
        </div>
      </div>

      <div className="mb-6">
        <select value={filterResolved} onChange={(e) => setFilterResolved(e.target.value)} className="input sm:w-48">
          <option value="all">All Incidents</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#e8eaed] p-4">
              <div className="w-full h-4 bg-[#e8eaed] rounded mb-2" />
              <div className="w-3/4 h-3 bg-[#e8eaed] rounded" />
            </div>
          ))}
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-12 text-center">
          <div className="w-16 h-16 bg-[#f8fafb] rounded-full flex items-center justify-center mx-auto mb-4">
            <MaterialIcon icon="verified" className="text-3xl text-[#006e1c]" />
          </div>
          <h3 className="text-lg font-semibold text-[#191c1d] mb-2">No incidents recorded</h3>
          <p className="text-[#5c6670]">This is good news!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRecords.map((record) => (
            <div key={record.id} className="bg-white rounded-2xl border border-[#e8eaed] p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`px-3 py-1 rounded-lg text-xs font-medium ${record.resolved ? 'bg-[#e8f5e9] text-[#006e1c]' : 'bg-[#fff3e0] text-[#b86e00]'}`}>
                      {record.resolved ? 'Resolved' : 'Pending'}
                    </span>
                    <span className="px-3 py-1 rounded-lg text-xs font-medium bg-[#e3f2fd] text-[#002045]">
                      {record.incident_type}
                    </span>
                  </div>
                  <div className="font-medium text-[#191c1d]">
                    {record.students?.first_name} {record.students?.last_name}
                    <span className="text-[#5c6670] ml-2">({record.students?.student_number})</span>
                  </div>
                  <p className="text-sm text-[#5c6670] mt-2">{record.description}</p>
                  <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-[#5c6670]">
                    <span>Action: {record.action_taken}</span>
                    {record.follow_up_date && (
                      <span>Follow-up: {new Date(record.follow_up_date).toLocaleDateString()}</span>
                    )}
                    <span>Recorded: {new Date(record.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <button
                  onClick={() => toggleResolved(record.id, record.resolved)}
                  className={`btn btn-sm ${record.resolved ? 'btn-secondary' : 'btn-primary'}`}
                >
                  {record.resolved ? 'Reopen' : 'Resolve'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-[#e8eaed]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#191c1d]">Record Incident</h2>
                <button onClick={() => setShowModal(false)} className="p-2 text-[#5c6670] hover:text-[#191c1d]">
                  <MaterialIcon icon="close" className="text-xl" />
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Student</label>
                <select 
                  value={newRecord.student_id}
                  onChange={(e) => setNewRecord({...newRecord, student_id: e.target.value})}
                  className="input"
                  required
                >
                  <option value="">Select student</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Incident Type</label>
                <select 
                  value={newRecord.incident_type}
                  onChange={(e) => setNewRecord({...newRecord, incident_type: e.target.value})}
                  className="input"
                  required
                >
                  <option value="">Select type</option>
                  {incidentTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Description</label>
                <textarea
                  value={newRecord.description}
                  onChange={(e) => setNewRecord({...newRecord, description: e.target.value})}
                  className="input min-h-[80px]"
                  placeholder="Describe what happened..."
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Action Taken</label>
                <select 
                  value={newRecord.action_taken}
                  onChange={(e) => setNewRecord({...newRecord, action_taken: e.target.value})}
                  className="input"
                  required
                >
                  <option value="">Select action</option>
                  {actions.map((action) => (
                    <option key={action} value={action}>{action}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Follow-up Date (Optional)</label>
                <input
                  type="date"
                  value={newRecord.follow_up_date}
                  onChange={(e) => setNewRecord({...newRecord, follow_up_date: e.target.value})}
                  className="input"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn btn-primary flex-1">Record Incident</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
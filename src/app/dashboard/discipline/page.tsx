'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useStudents } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Discipline</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Track student incidents and actions</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Record Incident
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-value">{records.length}</div>
          <div className="stat-label">Total Incidents</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-yellow-600">{records.filter(r => !r.resolved).length}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-green-600">{records.filter(r => r.resolved).length}</div>
          <div className="stat-label">Resolved</div>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-6">
        <select value={filterResolved} onChange={(e) => setFilterResolved(e.target.value)} className="input sm:w-48">
          <option value="all">All Incidents</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {/* Records List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card">
              <div className="skeleton w-full h-4 mb-2" />
              <div className="skeleton w-3/4 h-3" />
            </div>
          ))}
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No incidents recorded</h3>
          <p className="text-gray-500 dark:text-gray-400">This is good news!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRecords.map((record) => (
            <div key={record.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`badge ${record.resolved ? 'badge-success' : 'badge-warning'}`}>
                      {record.resolved ? 'Resolved' : 'Pending'}
                    </span>
                    <span className="badge badge-info">{record.incident_type}</span>
                  </div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {record.students?.first_name} {record.students?.last_name}
                    <span className="text-gray-500 dark:text-gray-400 ml-2">({record.students?.student_number})</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{record.description}</p>
                  <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
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

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Record Incident</h2>
                <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Student</label>
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
                <label className="label">Incident Type</label>
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
                <label className="label">Description</label>
                <textarea
                  value={newRecord.description}
                  onChange={(e) => setNewRecord({...newRecord, description: e.target.value})}
                  className="input min-h-[80px]"
                  placeholder="Describe what happened..."
                  required
                />
              </div>

              <div>
                <label className="label">Action Taken</label>
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
                <label className="label">Follow-up Date (Optional)</label>
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

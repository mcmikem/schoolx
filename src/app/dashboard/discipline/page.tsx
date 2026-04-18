'use client'
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useStudents } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { SendSMSModal } from '@/components/SendSMSModal'
import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tabs, TabPanel } from '@/components/ui/Tabs'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/index'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/EmptyState'

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
  exam_id: string | null
  students?: {
    first_name: string
    last_name: string
    student_number: string
  }
  exams?: {
    title: string
  }
}

const incidentTypes = [
  'Late arrival',
  'Exam Malpractice',
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
  const [exams, setExams] = useState<any[]>([])
  const [smsTarget, setSmsTarget] = useState<{ id: string; first_name: string; last_name: string; parent_phone?: string } | null>(null)
  const [newRecord, setNewRecord] = useState({
    student_id: '',
    incident_type: '',
    description: '',
    action_taken: '',
    follow_up_date: '',
    exam_id: '',
  })

  const fetchRecords = useCallback(async () => {
    if (!school?.id) return
    try {
      const { data, error } = await supabase
        .from('discipline')
        .select('*, students(first_name, last_name, student_number), exams(title)')
        .eq('school_id', school.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setRecords(data || [])
    } catch (err) {
      console.error('Error:', err)
      toast.error('Failed to load discipline records')
    } finally {
      setLoading(false)
    }
  }, [school?.id, toast])

  const fetchExams = useCallback(async () => {
    if (!school?.id) return
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, start_date')
        .eq('school_id', school.id)
        .eq('event_type', 'exam')
        .order('start_date', { ascending: false })

      if (error) throw error
      setExams(data || [])
    } catch (err) {
      console.error('Error fetching exams:', err)
    }
  }, [school?.id])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  useEffect(() => {
    if (showModal) {
      fetchExams()
    }
  }, [showModal, fetchExams])

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
        exam_id: newRecord.exam_id || null,
      })

      if (error) throw error

      toast.success('Incident recorded')
      setShowModal(false)
      setNewRecord({ student_id: '', incident_type: '', description: '', action_taken: '', follow_up_date: '', exam_id: '' })
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

  const tabs = [
    { id: 'all', label: 'All', count: records.length },
    { id: 'pending', label: 'Pending', count: records.filter(r => !r.resolved).length },
    { id: 'resolved', label: 'Resolved', count: records.filter(r => r.resolved).length },
  ]

  const filteredRecords = records.filter(r => {
    if (filterResolved === 'all') return true
    if (filterResolved === 'resolved') return r.resolved
    if (filterResolved === 'pending') return !r.resolved
    return true
  })

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader 
        title="Discipline"
        subtitle="Track student incidents and actions"
        actions={
          <Button onClick={() => setShowModal(true)}>
            <MaterialIcon icon="add" className="text-lg" />
            Record Incident
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="text-center py-4">
          <CardBody>
            <div className="text-2xl font-bold text-[var(--t1)]">{records.length}</div>
            <div className="text-sm text-[var(--t3)] mt-1">Total Incidents</div>
          </CardBody>
        </Card>
        <Card className="text-center py-4">
          <CardBody>
            <div className="text-2xl font-bold text-[var(--amber)]">{records.filter(r => !r.resolved).length}</div>
            <div className="text-sm text-[var(--t3)] mt-1">Pending</div>
          </CardBody>
        </Card>
        <Card className="text-center py-4">
          <CardBody>
            <div className="text-2xl font-bold text-[var(--green)]">{records.filter(r => r.resolved).length}</div>
            <div className="text-sm text-[var(--t3)] mt-1">Resolved</div>
          </CardBody>
        </Card>
      </div>

      <Tabs 
        tabs={tabs} 
        activeTab={filterResolved} 
        onChange={setFilterResolved}
        className="mb-6"
      />

      <TabPanel activeTab={filterResolved} tabId="all">
        {renderContent()}
      </TabPanel>
      <TabPanel activeTab={filterResolved} tabId="pending">
        {renderContent()}
      </TabPanel>
      <TabPanel activeTab={filterResolved} tabId="resolved">
        {renderContent()}
      </TabPanel>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-[var(--surface)] rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-[var(--border)]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--t1)]">Record Incident</h2>
                <button onClick={() => setShowModal(false)} className="p-2 text-[var(--t3)] hover:text-[var(--t1)]">
                  <MaterialIcon icon="close" className="text-xl" />
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--t1)] mb-2 block">Student</label>
                {students.length === 0 ? (
                  <div className="bg-[var(--amber-soft)] border border-[var(--amber)] rounded-xl px-3 py-2 text-sm text-[var(--amber)]">No students available</div>
                ) : (
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
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-[var(--t1)] mb-2 block">Incident Type</label>
                <select 
                  value={newRecord.incident_type}
                  onChange={(e) => setNewRecord({...newRecord, incident_type: e.target.value, exam_id: e.target.value !== 'Exam Malpractice' ? '' : newRecord.exam_id})}
                  className="input"
                  required
                >
                  <option value="">Select type</option>
                  {incidentTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {newRecord.incident_type === 'Exam Malpractice' && (
                <div>
                  <label className="text-sm font-medium text-[var(--t1)] mb-2 block">Link to Exam (Optional)</label>
                  <select 
                    value={newRecord.exam_id}
                    onChange={(e) => setNewRecord({...newRecord, exam_id: e.target.value})}
                    className="input"
                  >
                    <option value="">Select exam</option>
                    {exams.map((exam) => (
                      <option key={exam.id} value={exam.id}>{exam.title} ({exam.start_date})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-[var(--t1)] mb-2 block">Description</label>
                <textarea
                  value={newRecord.description}
                  onChange={(e) => setNewRecord({...newRecord, description: e.target.value})}
                  className="input min-h-[80px]"
                  placeholder="Describe what happened..."
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[var(--t1)] mb-2 block">Action Taken</label>
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
                <label className="text-sm font-medium text-[var(--t1)] mb-2 block">Follow-up Date (Optional)</label>
                <input
                  type="date"
                  value={newRecord.follow_up_date}
                  onChange={(e) => setNewRecord({...newRecord, follow_up_date: e.target.value})}
                  className="input"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
                <Button type="submit" className="flex-1">Record Incident</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {smsTarget && (
        <SendSMSModal
          student={smsTarget}
          isOpen={!!smsTarget}
          onClose={() => setSmsTarget(null)}
        />
      )}
    </div>
    </PageErrorBoundary>
  )

  function renderContent() {
    if (loading) {
      return (
        <div className="space-y-3">
          <TableSkeleton rows={3} />
        </div>
      )
    }

    if (filteredRecords.length === 0) {
      return (
        <EmptyState
          icon="verified"
          title="No incidents recorded"
          description="This is good news!"
        />
      )
    }

    return (
      <div className="space-y-4">
        {filteredRecords.map((record) => (
          <Card key={record.id} className="p-6">
            <CardBody>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`px-3 py-1 rounded-lg text-xs font-medium ${record.resolved ? 'bg-[var(--green-soft)] text-[var(--green)]' : 'bg-[var(--amber-soft)] text-[var(--amber)]'}`}>
                      {record.resolved ? 'Resolved' : 'Pending'}
                    </span>
                    <span className="px-3 py-1 rounded-lg text-xs font-medium bg-[var(--navy-soft)] text-[var(--navy)]">
                      {record.incident_type}
                    </span>
                  </div>
                  <div className="font-medium text-[var(--t1)]">
                    {record.students?.first_name} {record.students?.last_name}
                    <span className="text-[var(--t3)] ml-2">({record.students?.student_number})</span>
                  </div>
                  <p className="text-sm text-[var(--t3)] mt-2">{record.description}</p>
                  <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-[var(--t3)]">
                    <span>Action: {record.action_taken}</span>
                    {record.follow_up_date && (
                      <span>Follow-up: {new Date(record.follow_up_date).toLocaleDateString()}</span>
                    )}
                    <span>Recorded: {new Date(record.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSmsTarget({
                      id: record.student_id,
                      first_name: record.students?.first_name || '',
                      last_name: record.students?.last_name || '',
                    })}
                    title="SMS Parent"
                  >
                    <MaterialIcon icon="sms" className="text-sm" />
                  </Button>
                  <Button
                    variant={record.resolved ? 'secondary' : 'primary'}
                    size="sm"
                    onClick={() => toggleResolved(record.id, record.resolved)}
                  >
                    {record.resolved ? 'Reopen' : 'Resolve'}
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    )
  }
}

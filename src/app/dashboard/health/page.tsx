'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button, Badge } from '@/components/ui/index'
import { Tabs, TabPanel } from '@/components/ui/Tabs'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/EmptyState'

interface Student {
  id: string
  first_name: string
  last_name: string
}

interface HealthRecord {
  id: string
  student_id: string
  record_type: string
  notes: string
  record_date: string
  treatment: string
  created_at: string
  students: Student
  users: { full_name: string }
}

const RECORD_TYPES = ['Check-up', 'Illness', 'Injury', 'Vaccination', 'Dental', 'Eye Exam', 'First Aid', 'Other']

export default function HealthPage() {
  const { school, user } = useAuth()
  const toast = useToast()
  const [records, setRecords] = useState<HealthRecord[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState<HealthRecord | null>(null)
  const [formData, setFormData] = useState({
    student_id: '',
    record_type: '',
    notes: '',
    record_date: new Date().toISOString().split('T')[0],
    treatment: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('all')

  const fetchRecords = useCallback(async () => {
    if (!school?.id) return
    try {
      const { data, error } = await supabase
        .from('health_records')
        .select('*, students(first_name, last_name), users(full_name)')
        .eq('school_id', school.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setRecords(data || [])
    } catch (err) {
      console.error('Error fetching health records:', err)
      toast.error('Failed to load health records')
    } finally {
      setLoading(false)
    }
  }, [school?.id, toast])

  const fetchStudents = useCallback(async () => {
    if (!school?.id) return
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name')
        .eq('school_id', school.id)
        .order('first_name')

      if (error) throw error
      setStudents(data || [])
    } catch (err) {
      console.error('Error fetching students:', err)
    }
  }, [school?.id])

  useEffect(() => {
    fetchRecords()
    if (school?.id) fetchStudents()
  }, [fetchRecords, fetchStudents, school?.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school?.id) return

    setSubmitting(true)
    try {
      const payload = {
        school_id: school.id,
        student_id: formData.student_id,
        record_type: formData.record_type,
        notes: formData.notes,
        record_date: formData.record_date,
        treatment: formData.treatment,
        recorded_by: user?.id
      }

      let error
      if (editingRecord) {
        ({ error } = await supabase
          .from('health_records')
          .update(payload)
          .eq('id', editingRecord.id))
      } else {
        ({ error } = await supabase
          .from('health_records')
          .insert(payload))
      }

      if (error) throw error

      toast.success(editingRecord ? 'Record updated' : 'Record added')
      closeModal()
      fetchRecords()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save record')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('health_records')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success('Record deleted')
      setDeleteId(null)
      fetchRecords()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete record')
    }
  }

  const openModal = (record?: HealthRecord) => {
    if (record) {
      setEditingRecord(record)
      setFormData({
        student_id: record.student_id,
        record_type: record.record_type,
        notes: record.notes || '',
        record_date: record.record_date || new Date().toISOString().split('T')[0],
        treatment: record.treatment || ''
      })
    } else {
      setEditingRecord(null)
      setFormData({
        student_id: '',
        record_type: '',
        notes: '',
        record_date: new Date().toISOString().split('T')[0],
        treatment: ''
      })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingRecord(null)
    setFormData({
      student_id: '',
      record_type: '',
      notes: '',
      record_date: new Date().toISOString().split('T')[0],
      treatment: ''
    })
  }

  const getBadgeVariant = (recordType: string): 'success' | 'warning' | 'error' | 'info' | 'default' => {
    if (recordType === 'Check-up') return 'info'
    if (recordType === 'Vaccination') return 'success'
    if (recordType === 'Illness' || recordType === 'Injury') return 'warning'
    return 'default'
  }

  const filteredRecords = activeTab === 'all' 
    ? records 
    : records.filter(r => r.record_type === activeTab)

  const tabs = [
    { id: 'all', label: 'All', count: records.length },
    { id: 'Check-up', label: 'Check-up', count: records.filter(r => r.record_type === 'Check-up').length },
    { id: 'Illness', label: 'Illness', count: records.filter(r => r.record_type === 'Illness').length },
    { id: 'Vaccination', label: 'Vaccination', count: records.filter(r => r.record_type === 'Vaccination').length }
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Health Records"
        subtitle="Track student health information"
        actions={
          <Button onClick={() => openModal()}>
            <MaterialIcon icon="add" />
            Add Record
          </Button>
        }
      />

      {loading ? (
        <Card>
          <CardBody>
            <TableSkeleton rows={5} />
          </CardBody>
        </Card>
      ) : records.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState 
              icon="medical_services"
              title="No health records"
              description="Add your first health record to get started"
              action={{ label: 'Add Record', onClick: () => openModal() }}
            />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <div className="p-4 border-b border-[var(--border)]">
            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
          </div>
          <CardBody>
            <TabPanel activeTab={activeTab} tabId="all">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-3 px-4 text-sm font-medium text-[var(--t2)]">Student</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[var(--t2)]">Type</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[var(--t2)]">Notes</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[var(--t2)]">Date</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[var(--t2)]">Treatment</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[var(--t2)]">Recorded By</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-[var(--t2)]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map(record => (
                      <tr key={record.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-container)]">
                        <td className="py-3 px-4 text-sm font-medium text-[var(--on-surface)]">{record.students?.first_name} {record.students?.last_name}</td>
                        <td className="py-3 px-4">
                          <Badge variant={getBadgeVariant(record.record_type)}>{record.record_type}</Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-[var(--t3)] max-w-xs truncate">{record.notes || '-'}</td>
                        <td className="py-3 px-4 text-sm text-[var(--t3)]">{record.record_date ? new Date(record.record_date).toLocaleDateString() : '-'}</td>
                        <td className="py-3 px-4 text-sm text-[var(--t3)] max-w-xs truncate">{record.treatment || '-'}</td>
                        <td className="py-3 px-4 text-sm text-[var(--t3)]">{record.users?.full_name || '-'}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => openModal(record)}>
                              <MaterialIcon icon="edit" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setDeleteId(record.id)} className="text-[var(--error)]">
                              <MaterialIcon icon="delete" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabPanel>
            {tabs.slice(1).map(tab => (
              <TabPanel key={tab.id} activeTab={activeTab} tabId={tab.id}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="text-left py-3 px-4 text-sm font-medium text-[var(--t2)]">Student</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-[var(--t2)]">Notes</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-[var(--t2)]">Date</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-[var(--t2)]">Treatment</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-[var(--t2)]">Recorded By</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-[var(--t2)]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.map(record => (
                        <tr key={record.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-container)]">
                          <td className="py-3 px-4 text-sm font-medium text-[var(--on-surface)]">{record.students?.first_name} {record.students?.last_name}</td>
                          <td className="py-3 px-4 text-sm text-[var(--t3)] max-w-xs truncate">{record.notes || '-'}</td>
                          <td className="py-3 px-4 text-sm text-[var(--t3)]">{record.record_date ? new Date(record.record_date).toLocaleDateString() : '-'}</td>
                          <td className="py-3 px-4 text-sm text-[var(--t3)] max-w-xs truncate">{record.treatment || '-'}</td>
                          <td className="py-3 px-4 text-sm text-[var(--t3)]">{record.users?.full_name || '-'}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex gap-2 justify-end">
                              <Button variant="ghost" size="sm" onClick={() => openModal(record)}>
                                <MaterialIcon icon="edit" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setDeleteId(record.id)} className="text-[var(--error)]">
                                <MaterialIcon icon="delete" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabPanel>
            ))}
          </CardBody>
        </Card>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={closeModal}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-[var(--border)]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--on-surface)]">
                  {editingRecord ? 'Edit Record' : 'Add Record'}
                </h2>
                <Button variant="ghost" size="sm" onClick={closeModal}>
                  <MaterialIcon icon="close" />
                </Button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">Student</label>
                {students.length === 0 ? (
                  <div className="bg-[var(--amber-soft)] text-[var(--amber)] border border-[var(--amber)]/30 rounded-xl px-3 py-2 text-sm font-medium">No students available</div>
                ) : (
                  <select
                    value={formData.student_id}
                    onChange={(e) => setFormData({...formData, student_id: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                    required
                  >
                    <option value="">Select student</option>
                    {students.map(student => (
                      <option key={student.id} value={student.id}>
                        {student.first_name} {student.last_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">Record Type</label>
                <select
                  value={formData.record_type}
                  onChange={(e) => setFormData({...formData, record_type: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  required
                >
                  <option value="">Select type</option>
                  {RECORD_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">Date</label>
                <input
                  type="date"
                  value={formData.record_date}
                  onChange={(e) => setFormData({...formData, record_date: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">Treatment</label>
                <input
                  type="text"
                  value={formData.treatment}
                  onChange={(e) => setFormData({...formData, treatment: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] placeholder-[var(--t4)]"
                  placeholder="Treatment given"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] placeholder-[var(--t4)]"
                  placeholder="Additional notes"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="secondary" className="flex-1" onClick={closeModal}>Cancel</Button>
                <Button type="submit" variant="primary" className="flex-1" disabled={submitting}>
                  {submitting ? 'Saving...' : editingRecord ? 'Update' : 'Add Record'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setDeleteId(null)}>
          <Card className="w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-12 h-12 bg-[var(--red-soft)] rounded-full flex items-center justify-center mx-auto mb-4">
                <MaterialIcon icon="delete" className="text-2xl text-[var(--red)]" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--on-surface)] mb-2">Delete Record?</h3>
              <p className="text-[var(--t3)]">This action cannot be undone.</p>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="secondary" className="flex-1" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button variant="danger" className="flex-1" onClick={() => handleDelete(deleteId)}>Delete</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import MaterialIcon from '@/components/MaterialIcon'

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

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#002045]">Health Records</h1>
          <p className="text-[#5c6670] mt-1">Track student health information</p>
        </div>
        <button onClick={() => openModal()} className="btn btn-primary">
          <MaterialIcon icon="add" className="text-lg" />
          Add Record
        </button>
      </div>

      {loading ? (
        <div className="tbl-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Type</th>
                <th>Details</th>
                <th>Date</th>
                <th>Treatment</th>
                <th>Recorded By</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i}>
                  <td><div className="skeleton h-4 w-32" /></td>
                  <td><div className="skeleton h-4 w-24" /></td>
                  <td><div className="skeleton h-4 w-40" /></td>
                  <td><div className="skeleton h-4 w-24" /></td>
                  <td><div className="skeleton h-4 w-32" /></td>
                  <td><div className="skeleton h-4 w-24" /></td>
                  <td><div className="skeleton h-8 w-20" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-12 text-center">
          <div className="w-16 h-16 bg-[#f8fafb] rounded-full flex items-center justify-center mx-auto mb-4">
            <MaterialIcon icon="medical_services" className="text-3xl text-[#5c6670]" />
          </div>
          <h3 className="text-lg font-semibold text-[#191c1d] mb-2">No health records</h3>
          <p className="text-[#5c6670]">Add your first health record to get started</p>
          <button onClick={() => openModal()} className="btn btn-primary mt-4">
            <MaterialIcon icon="add" className="text-lg" />
            Add Record
          </button>
        </div>
      ) : (
        <div className="tbl-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Type</th>
                <th>Notes</th>
                <th>Date</th>
                <th>Treatment</th>
                <th>Recorded By</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.map(record => (
                <tr key={record.id}>
                  <td className="font-medium">{record.students?.first_name} {record.students?.last_name}</td>
                  <td>
                    <span className={`badge ${record.record_type === 'Check-up' ? 'bg-blue-100 text-blue-800' : record.record_type === 'Vaccination' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {record.record_type}
                    </span>
                  </td>
                  <td className="max-w-xs truncate">{record.notes || '-'}</td>
                  <td>{record.record_date ? new Date(record.record_date).toLocaleDateString() : '-'}</td>
                  <td className="max-w-xs truncate">{record.treatment || '-'}</td>
                  <td>{record.users?.full_name || '-'}</td>
                  <td>
                    <div className="flex gap-2">
                      <button onClick={() => openModal(record)} className="btn btn-sm btn-ghost">
                        <MaterialIcon icon="edit" className="text-lg" />
                      </button>
                      <button onClick={() => setDeleteId(record.id)} className="btn btn-sm btn-ghost text-red-500">
                        <MaterialIcon icon="delete" className="text-lg" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-[#e8eaed]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#191c1d]">
                  {editingRecord ? 'Edit Record' : 'Add Record'}
                </h2>
                <button onClick={closeModal} className="p-2 text-[#5c6670] hover:text-[#191c1d]">
                  <MaterialIcon icon="close" className="text-xl" />
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Student</label>
                {students.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">No students available</div>
                ) : (
                  <select
                    value={formData.student_id}
                    onChange={(e) => setFormData({...formData, student_id: e.target.value})}
                    className="input"
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
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Record Type</label>
                <select
                  value={formData.record_type}
                  onChange={(e) => setFormData({...formData, record_type: e.target.value})}
                  className="input"
                  required
                >
                  <option value="">Select type</option>
                  {RECORD_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Date</label>
                <input
                  type="date"
                  value={formData.record_date}
                  onChange={(e) => setFormData({...formData, record_date: e.target.value})}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Treatment</label>
                <input
                  type="text"
                  value={formData.treatment}
                  onChange={(e) => setFormData({...formData, treatment: e.target.value})}
                  className="input"
                  placeholder="Treatment given"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="input"
                  placeholder="Additional notes"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary flex-1">
                  {submitting ? 'Saving...' : editingRecord ? 'Update' : 'Add Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MaterialIcon icon="delete" className="text-2xl text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-[#191c1d] mb-2">Delete Record?</h3>
              <p className="text-[#5c6670]">This action cannot be undone.</p>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDeleteId(null)} className="btn btn-secondary flex-1">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="btn btn-danger flex-1">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

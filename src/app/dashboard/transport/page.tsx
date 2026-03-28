'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

interface Student {
  id: string
  first_name: string
  last_name: string
}

interface TransportRoute {
  id: string
  route_name: string
  description: string
  vehicle: string
  driver: string
  fee: number
  pickup_time: string
  dropoff_time: string
  students: Student[]
  created_at: string
}

export default function TransportPage() {
  const { school, user } = useAuth()
  const toast = useToast()
  const [routes, setRoutes] = useState<TransportRoute[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingRoute, setEditingRoute] = useState<TransportRoute | null>(null)
  const [formData, setFormData] = useState({
    route_name: '',
    description: '',
    vehicle: '',
    driver: '',
    fee: '',
    pickup_time: '',
    dropoff_time: ''
  })
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    fetchRoutes()
    if (school?.id) fetchStudents()
  }, [school?.id])

  const fetchRoutes = async () => {
    if (!school?.id) return
    try {
      const { data, error } = await supabase
        .from('transport_routes')
        .select('*, students(id, first_name, last_name)')
        .eq('school_id', school.id)
        .order('route_name')

      if (error) throw error
      setRoutes(data || [])
    } catch (err) {
      console.error('Error fetching routes:', err)
      toast.error('Failed to load transport routes')
    } finally {
      setLoading(false)
    }
  }

  const fetchStudents = async () => {
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
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school?.id) return

    setSubmitting(true)
    try {
      const payload = {
        school_id: school.id,
        route_name: formData.route_name,
        description: formData.description,
        vehicle: formData.vehicle,
        driver: formData.driver,
        fee: parseInt(formData.fee) || 0,
        pickup_time: formData.pickup_time,
        dropoff_time: formData.dropoff_time
      }

      let error
      let routeId: string

      if (editingRoute) {
        ({ error } = await supabase
          .from('transport_routes')
          .update(payload)
          .eq('id', editingRoute.id))
        routeId = editingRoute.id
      } else {
        const { data, error: insertError } = await supabase
          .from('transport_routes')
          .insert(payload)
          .select()
          .single()
        error = insertError
        routeId = data?.id
      }

      if (error) throw error

      if (selectedStudents.length > 0 && routeId) {
        await supabase
          .from('route_students')
          .delete()
          .eq('route_id', routeId)

        const routeStudents = selectedStudents.map(studentId => ({
          route_id: routeId,
          student_id: studentId
        }))

        await supabase.from('route_students').insert(routeStudents)
      }

      toast.success(editingRoute ? 'Route updated' : 'Route added')
      closeModal()
      fetchRoutes()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save route')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await supabase.from('route_students').delete().eq('route_id', id)
      const { error } = await supabase
        .from('transport_routes')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success('Route deleted')
      setDeleteId(null)
      fetchRoutes()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete route')
    }
  }

  const openModal = (route?: TransportRoute) => {
    if (route) {
      setEditingRoute(route)
      setFormData({
        route_name: route.route_name,
        description: route.description || '',
        vehicle: route.vehicle || '',
        driver: route.driver || '',
        fee: route.fee?.toString() || '',
        pickup_time: route.pickup_time || '',
        dropoff_time: route.dropoff_time || ''
      })
      setSelectedStudents(route.students?.map(s => s.id) || [])
    } else {
      setEditingRoute(null)
      setFormData({ route_name: '', description: '', vehicle: '', driver: '', fee: '', pickup_time: '', dropoff_time: '' })
      setSelectedStudents([])
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingRoute(null)
    setFormData({ route_name: '', description: '', vehicle: '', driver: '', fee: '', pickup_time: '', dropoff_time: '' })
    setSelectedStudents([])
  }

  const toggleStudent = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#002045]">Transport</h1>
          <p className="text-[#5c6670] mt-1">Manage transport routes and students</p>
        </div>
        <button onClick={() => openModal()} className="btn btn-primary">
          <MaterialIcon icon="add" className="text-lg" />
          Add Route
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="card">
              <div className="card-header">
                <div className="skeleton h-5 w-32 mb-2" />
                <div className="skeleton h-4 w-24" />
              </div>
              <div className="card-body">
                <div className="skeleton h-4 w-full mb-2" />
                <div className="skeleton h-4 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : routes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-12 text-center">
          <div className="w-16 h-16 bg-[#f8fafb] rounded-full flex items-center justify-center mx-auto mb-4">
            <MaterialIcon icon="directions_bus" className="text-3xl text-[#5c6670]" />
          </div>
          <h3 className="text-lg font-semibold text-[#191c1d] mb-2">No transport routes</h3>
          <p className="text-[#5c6670]">Add your first route to get started</p>
          <button onClick={() => openModal()} className="btn btn-primary mt-4">
            <MaterialIcon icon="add" className="text-lg" />
            Add Route
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {routes.map(route => (
            <div key={route.id} className="card">
              <div className="card-header">
                <div className="flex items-start justify-between">
                  <div className="card-title">{route.route_name}</div>
                  <div className="flex gap-1">
                    <button onClick={() => openModal(route)} className="p-1 text-[#5c6670] hover:text-[#191c1d]">
                      <MaterialIcon icon="edit" className="text-lg" />
                    </button>
                    <button onClick={() => setDeleteId(route.id)} className="p-1 text-red-500 hover:text-red-700">
                      <MaterialIcon icon="delete" className="text-lg" />
                    </button>
                  </div>
                </div>
                <div className="card-sub">UGX {route.fee?.toLocaleString()}/term</div>
              </div>
              <div className="card-body">
                <p className="text-sm text-[#5c6670]">{route.description || 'No description'}</p>
                <div className="mt-2 text-xs text-[#5c6670]">
                  <div>Pickup: {route.pickup_time || '-'}</div>
                  <div>Drop: {route.dropoff_time || '-'}</div>
                </div>
                <div className="mt-2 text-xs text-[#5c6670]">
                  {route.vehicle && <div>Vehicle: {route.vehicle}</div>}
                  {route.driver && <div>Driver: {route.driver}</div>}
                </div>
                {route.students && route.students.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-[#e8eaed]">
                    <div className="text-xs text-[#5c6670]">{route.students.length} student(s)</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {route.students.slice(0, 3).map(s => (
                        <span key={s.id} className="text-xs bg-[#f8fafb] px-2 py-1 rounded">
                          {s.first_name}
                        </span>
                      ))}
                      {route.students.length > 3 && (
                        <span className="text-xs text-[#5c6670]">+{route.students.length - 3} more</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-[#e8eaed]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#191c1d]">
                  {editingRoute ? 'Edit Route' : 'Add Route'}
                </h2>
                <button onClick={closeModal} className="p-2 text-[#5c6670] hover:text-[#191c1d]">
                  <MaterialIcon icon="close" className="text-xl" />
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Route Name</label>
                <input
                  type="text"
                  value={formData.route_name}
                  onChange={(e) => setFormData({...formData, route_name: e.target.value})}
                  className="input"
                  placeholder="e.g. Route A - Northern"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="input"
                  placeholder="Route description"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Vehicle</label>
                  <input
                    type="text"
                    value={formData.vehicle}
                    onChange={(e) => setFormData({...formData, vehicle: e.target.value})}
                    className="input"
                    placeholder="e.g. BUS 001"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Driver</label>
                  <input
                    type="text"
                    value={formData.driver}
                    onChange={(e) => setFormData({...formData, driver: e.target.value})}
                    className="input"
                    placeholder="Driver name"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Term Fee (UGX)</label>
                <input
                  type="number"
                  value={formData.fee}
                  onChange={(e) => setFormData({...formData, fee: e.target.value})}
                  className="input"
                  placeholder="50000"
                  min="0"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Pickup Time</label>
                  <input
                    type="time"
                    value={formData.pickup_time}
                    onChange={(e) => setFormData({...formData, pickup_time: e.target.value})}
                    className="input"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Dropoff Time</label>
                  <input
                    type="time"
                    value={formData.dropoff_time}
                    onChange={(e) => setFormData({...formData, dropoff_time: e.target.value})}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Assign Students</label>
                <div className="max-h-40 overflow-y-auto border border-[#e8eaed] rounded-lg p-2 space-y-1">
                  {students.length === 0 ? (
                    <p className="text-sm text-[#5c6670] p-2">No students available</p>
                  ) : (
                    students.map(student => (
                      <label key={student.id} className="flex items-center gap-2 p-2 hover:bg-[#f8fafb] rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(student.id)}
                          onChange={() => toggleStudent(student.id)}
                          className="rounded border-[#c1c7cd]"
                        />
                        <span className="text-sm">{student.first_name} {student.last_name}</span>
                      </label>
                    ))
                  )}
                </div>
                {selectedStudents.length > 0 && (
                  <p className="text-xs text-[#5c6670] mt-1">{selectedStudents.length} student(s) selected</p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary flex-1">
                  {submitting ? 'Saving...' : editingRoute ? 'Update' : 'Add Route'}
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
              <h3 className="text-lg font-semibold text-[#191c1d] mb-2">Delete Route?</h3>
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
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

interface Visitor {
  id: string
  name: string
  purpose: string
  person_visited: string
  time_in: string
  time_out: string | null
  phone: string
  created_at: string
}

export default function VisitorsPage() {
  const { school, user } = useAuth()
  const toast = useToast()
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newVisitor, setNewVisitor] = useState({
    name: '',
    purpose: '',
    person_visited: '',
    phone: '',
  })

  useEffect(() => {
    fetchVisitors()
  }, [school?.id])

  const fetchVisitors = async () => {
    if (!school?.id) return
    try {
      const { data, error } = await supabase
        .from('visitors')
        .select('*')
        .eq('school_id', school.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setVisitors(data || [])
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school?.id) return

    try {
      const { error } = await supabase.from('visitors').insert({
        school_id: school.id,
        name: newVisitor.name,
        purpose: newVisitor.purpose,
        person_visited: newVisitor.person_visited,
        phone: newVisitor.phone || null,
        time_in: new Date().toISOString(),
        time_out: null,
      })

      if (error) throw error

      toast.success('Visitor checked in')
      setShowModal(false)
      setNewVisitor({ name: '', purpose: '', person_visited: '', phone: '' })
      fetchVisitors()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to check in visitor')
    }
  }

  const checkOut = async (id: string) => {
    try {
      const { error } = await supabase
        .from('visitors')
        .update({ time_out: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
      fetchVisitors()
      toast.success('Visitor checked out')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to check out')
    }
  }

  const todayVisitors = visitors.filter(v => {
    const visitDate = new Date(v.created_at).toDateString()
    const today = new Date().toDateString()
    return visitDate === today
  })

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Visitor Register</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Track school visitors</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Check In Visitor
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-value">{todayVisitors.length}</div>
          <div className="stat-label">Today's Visitors</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-green-600">{todayVisitors.filter(v => v.time_out).length}</div>
          <div className="stat-label">Checked Out</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-yellow-600">{todayVisitors.filter(v => !v.time_out).length}</div>
          <div className="stat-label">Still Inside</div>
        </div>
      </div>

      {/* Visitors List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card">
              <div className="skeleton w-full h-4 mb-2" />
              <div className="skeleton w-3/4 h-3" />
            </div>
          ))}
        </div>
      ) : visitors.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No visitors recorded</h3>
          <p className="text-gray-500 dark:text-gray-400">Check in your first visitor</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Purpose</th>
                <th>Person Visited</th>
                <th>Time In</th>
                <th>Time Out</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visitors.map((visitor) => (
                <tr key={visitor.id}>
                  <td className="font-medium text-gray-900 dark:text-white">{visitor.name}</td>
                  <td className="text-gray-600 dark:text-gray-400">{visitor.purpose}</td>
                  <td className="text-gray-600 dark:text-gray-400">{visitor.person_visited}</td>
                  <td>{new Date(visitor.time_in).toLocaleTimeString()}</td>
                  <td>{visitor.time_out ? new Date(visitor.time_out).toLocaleTimeString() : '-'}</td>
                  <td>
                    <span className={`badge ${visitor.time_out ? 'badge-success' : 'badge-warning'}`}>
                      {visitor.time_out ? 'Checked Out' : 'Inside'}
                    </span>
                  </td>
                  <td>
                    {!visitor.time_out && (
                      <button
                        onClick={() => checkOut(visitor.id)}
                        className="btn btn-sm btn-secondary"
                      >
                        Check Out
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Check In Visitor</h2>
                <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Visitor Name</label>
                <input
                  type="text"
                  value={newVisitor.name}
                  onChange={(e) => setNewVisitor({...newVisitor, name: e.target.value})}
                  className="input"
                  placeholder="Full name"
                  required
                />
              </div>

              <div>
                <label className="label">Phone Number</label>
                <input
                  type="tel"
                  value={newVisitor.phone}
                  onChange={(e) => setNewVisitor({...newVisitor, phone: e.target.value})}
                  className="input"
                  placeholder="0700000000"
                />
              </div>

              <div>
                <label className="label">Purpose of Visit</label>
                <select 
                  value={newVisitor.purpose}
                  onChange={(e) => setNewVisitor({...newVisitor, purpose: e.target.value})}
                  className="input"
                  required
                >
                  <option value="">Select purpose</option>
                  <option value="Parent Visit">Parent Visit</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Delivery">Delivery</option>
                  <option value="Inspection">Inspection</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="label">Person to Visit</label>
                <input
                  type="text"
                  value={newVisitor.person_visited}
                  onChange={(e) => setNewVisitor({...newVisitor, person_visited: e.target.value})}
                  className="input"
                  placeholder="e.g. Headteacher, Class Teacher"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn btn-primary flex-1">Check In</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

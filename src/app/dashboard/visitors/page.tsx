'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

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
          <h1 className="text-2xl font-bold text-[#002045]">Visitor Register</h1>
          <p className="text-[#5c6670] mt-1">Track school visitors</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <MaterialIcon icon="person_add" className="text-lg" />
          Check In Visitor
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
          <div className="text-2xl font-bold text-[#002045]">{todayVisitors.length}</div>
          <div className="text-sm text-[#5c6670] mt-1">Today's Visitors</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
          <div className="text-2xl font-bold text-[#006e1c]">{todayVisitors.filter(v => v.time_out).length}</div>
          <div className="text-sm text-[#5c6670] mt-1">Checked Out</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
          <div className="text-2xl font-bold text-[#b86e00]">{todayVisitors.filter(v => !v.time_out).length}</div>
          <div className="text-sm text-[#5c6670] mt-1">Still Inside</div>
        </div>
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
      ) : visitors.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-12 text-center">
          <div className="w-16 h-16 bg-[#f8fafb] rounded-full flex items-center justify-center mx-auto mb-4">
            <MaterialIcon icon="groups" className="text-3xl text-[#5c6670]" />
          </div>
          <h3 className="text-lg font-semibold text-[#191c1d] mb-2">No visitors recorded</h3>
          <p className="text-[#5c6670]">Check in your first visitor</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#e8eaed] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#f8fafb]">
                <tr>
                  <th className="text-left p-4 text-sm font-semibold text-[#191c1d]">Name</th>
                  <th className="text-left p-4 text-sm font-semibold text-[#191c1d]">Purpose</th>
                  <th className="text-left p-4 text-sm font-semibold text-[#191c1d]">Person Visited</th>
                  <th className="text-left p-4 text-sm font-semibold text-[#191c1d]">Time In</th>
                  <th className="text-left p-4 text-sm font-semibold text-[#191c1d]">Time Out</th>
                  <th className="text-left p-4 text-sm font-semibold text-[#191c1d]">Status</th>
                  <th className="text-left p-4 text-sm font-semibold text-[#191c1d]"></th>
                </tr>
              </thead>
              <tbody>
                {visitors.map((visitor) => (
                  <tr key={visitor.id} className="border-t border-[#e8eaed]">
                    <td className="p-4 font-medium text-[#191c1d]">{visitor.name}</td>
                    <td className="p-4 text-[#5c6670]">{visitor.purpose}</td>
                    <td className="p-4 text-[#5c6670]">{visitor.person_visited}</td>
                    <td className="p-4 text-[#191c1d]">{new Date(visitor.time_in).toLocaleTimeString()}</td>
                    <td className="p-4 text-[#191c1d]">{visitor.time_out ? new Date(visitor.time_out).toLocaleTimeString() : '-'}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-lg text-xs font-medium ${visitor.time_out ? 'bg-[#e8f5e9] text-[#006e1c]' : 'bg-[#fff3e0] text-[#b86e00]'}`}>
                        {visitor.time_out ? 'Checked Out' : 'Inside'}
                      </span>
                    </td>
                    <td className="p-4">
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
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-[#e8eaed]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#191c1d]">Check In Visitor</h2>
                <button onClick={() => setShowModal(false)} className="p-2 text-[#5c6670] hover:text-[#191c1d]">
                  <MaterialIcon icon="close" className="text-xl" />
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Visitor Name</label>
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
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Phone Number</label>
                <input
                  type="tel"
                  value={newVisitor.phone}
                  onChange={(e) => setNewVisitor({...newVisitor, phone: e.target.value})}
                  className="input"
                  placeholder="0700000000"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Purpose of Visit</label>
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
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Person to Visit</label>
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
'use client'
import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
}

interface Visitor {
  id: string
  name: string
  purpose: string
  person_visited: string
  time_in: string
  time_out: string | null
  phone: string
  organization: string | null
  visit_type: string
  notes: string | null
  created_at: string
}

const PURPOSES = ['Visiting Student', 'Visiting Staff', 'Meeting', 'Inspection', 'Other']

export default function VisitorsPage() {
  const { school, user } = useAuth()
  const toast = useToast()
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showCallModal, setShowCallModal] = useState(false)

  const now = new Date()
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const [newVisitor, setNewVisitor] = useState({
    name: '',
    phone: '',
    organization: '',
    purpose: '',
    person_visited: '',
    time_in: timeStr,
  })

  const [callLog, setCallLog] = useState({
    name: '',
    phone: '',
    purpose: '',
    notes: '',
    time: timeStr,
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

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school?.id) return

    try {
      setSaving(true)
      const [h, m] = newVisitor.time_in.split(':').map(Number)
      const timeIn = new Date()
      timeIn.setHours(h, m, 0, 0)

      const { error } = await supabase.from('visitors').insert({
        school_id: school.id,
        name: newVisitor.name,
        purpose: newVisitor.purpose,
        person_visited: newVisitor.person_visited,
        phone: newVisitor.phone || null,
        organization: newVisitor.organization || null,
        visit_type: 'visit',
        time_in: timeIn.toISOString(),
        time_out: null,
      })

      if (error) throw error

      toast.success('Visitor checked in')
      setShowModal(false)
      setNewVisitor({ name: '', phone: '', organization: '', purpose: '', person_visited: '', time_in: timeStr })
      fetchVisitors()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to check in visitor')
    } finally {
      setSaving(false)
    }
  }

  const handleCallSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school?.id) return

    try {
      setSaving(true)
      const [h, m] = callLog.time.split(':').map(Number)
      const callTime = new Date()
      callTime.setHours(h, m, 0, 0)

      const { error } = await supabase.from('visitors').insert({
        school_id: school.id,
        name: callLog.name,
        purpose: callLog.purpose,
        person_visited: '-',
        phone: callLog.phone || null,
        visit_type: 'call',
        notes: callLog.notes || null,
        time_in: callTime.toISOString(),
        time_out: callTime.toISOString(),
      })

      if (error) throw error

      toast.success('Call logged')
      setShowCallModal(false)
      setCallLog({ name: '', phone: '', purpose: '', notes: '', time: timeStr })
      fetchVisitors()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to log call')
    } finally {
      setSaving(false)
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

  const recentVisitors = useMemo(() => visitors.slice(0, 10), [visitors])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#002045]">Visitor Register</h1>
          <p className="text-[#5c6670] mt-1">Track school visitors and calls</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowCallModal(true)} className="btn btn-secondary">
            <MaterialIcon icon="call" className="text-lg" />
            Log Call
          </button>
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            <MaterialIcon icon="person_add" className="text-lg" />
            Check In Visitor
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
          <div className="text-2xl font-bold text-[#002045]">{todayVisitors.length}</div>
          <div className="text-sm text-[#5c6670] mt-1">Today&apos;s Visitors</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
          <div className="text-2xl font-bold text-[#006e1c]">{todayVisitors.filter(v => v.time_out && v.visit_type !== 'call').length}</div>
          <div className="text-sm text-[#5c6670] mt-1">Checked Out</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
          <div className="text-2xl font-bold text-[#b86e00]">{todayVisitors.filter(v => !v.time_out && v.visit_type !== 'call').length}</div>
          <div className="text-sm text-[#5c6670] mt-1">Still Inside</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
          <div className="text-2xl font-bold text-[#5c6670]">{todayVisitors.filter(v => v.visit_type === 'call').length}</div>
          <div className="text-sm text-[#5c6670] mt-1">Calls Logged</div>
        </div>
      </div>

      {/* Recent visitors quick list */}
      {!loading && recentVisitors.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-[#5c6670] uppercase tracking-wider mb-3">Recent Activity</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {recentVisitors.map((v) => (
              <div key={v.id} className="bg-white rounded-xl border border-[#e8eaed] p-3">
                <div className="flex items-center gap-2 mb-1">
                  <MaterialIcon
                    icon={v.visit_type === 'call' ? 'call' : 'person'}
                    className={`text-lg ${v.visit_type === 'call' ? 'text-[#5c6670]' : 'text-[#002045]'}`}
                  />
                  <span className="font-medium text-sm text-[#191c1d] truncate">{v.name}</span>
                </div>
                <div className="text-xs text-[#5c6670]">
                  {v.visit_type === 'call' ? 'Call' : v.purpose} &middot; {new Date(v.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                  <th className="text-left p-4 text-sm font-semibold text-[#191c1d]">Type</th>
                  <th className="text-left p-4 text-sm font-semibold text-[#191c1d]">Name</th>
                  <th className="text-left p-4 text-sm font-semibold text-[#191c1d]">Phone</th>
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
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${visitor.visit_type === 'call' ? 'bg-[#f0f0f0] text-[#5c6670]' : 'bg-[#e3f2fd] text-[#1565c0]'}`}>
                        {visitor.visit_type === 'call' ? 'Call' : 'Visit'}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-[#191c1d]">{visitor.name}</td>
                    <td className="p-4 text-[#5c6670]">{visitor.phone || '-'}</td>
                    <td className="p-4 text-[#5c6670]">{visitor.purpose}</td>
                    <td className="p-4 text-[#5c6670]">{visitor.person_visited}</td>
                    <td className="p-4 text-[#191c1d]">{new Date(visitor.time_in).toLocaleTimeString()}</td>
                    <td className="p-4 text-[#191c1d]">{visitor.time_out ? new Date(visitor.time_out).toLocaleTimeString() : '-'}</td>
                    <td className="p-4">
                      {visitor.visit_type === 'call' ? (
                        <span className="px-3 py-1 rounded-lg text-xs font-medium bg-[#f0f0f0] text-[#5c6670]">Logged</span>
                      ) : visitor.time_out ? (
                        <span className="px-3 py-1 rounded-lg text-xs font-medium bg-[#e8f5e9] text-[#006e1c]">Checked Out</span>
                      ) : (
                        <span className="px-3 py-1 rounded-lg text-xs font-medium bg-[#fff3e0] text-[#b86e00]">Inside</span>
                      )}
                    </td>
                    <td className="p-4">
                      {!visitor.time_out && visitor.visit_type !== 'call' && (
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

      {/* Quick Visitor Check-In Modal */}
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
            <form onSubmit={handleQuickSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Visitor Name *</label>
                <input
                  type="text"
                  value={newVisitor.name}
                  onChange={(e) => setNewVisitor({...newVisitor, name: e.target.value})}
                  className="input"
                  placeholder="Full name"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Phone</label>
                  <input
                    type="tel"
                    value={newVisitor.phone}
                    onChange={(e) => setNewVisitor({...newVisitor, phone: e.target.value})}
                    className="input"
                    placeholder="0700000000"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Time In</label>
                  <input
                    type="time"
                    value={newVisitor.time_in}
                    onChange={(e) => setNewVisitor({...newVisitor, time_in: e.target.value})}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Organization</label>
                <input
                  type="text"
                  value={newVisitor.organization}
                  onChange={(e) => setNewVisitor({...newVisitor, organization: e.target.value})}
                  className="input"
                  placeholder="Company or organization (optional)"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Purpose *</label>
                <select
                  value={newVisitor.purpose}
                  onChange={(e) => setNewVisitor({...newVisitor, purpose: e.target.value})}
                  className="input"
                  required
                >
                  <option value="">Select purpose</option>
                  {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Person Visited *</label>
                <input
                  type="text"
                  value={newVisitor.person_visited}
                  onChange={(e) => setNewVisitor({...newVisitor, person_visited: e.target.value})}
                  className="input"
                  placeholder="e.g. Headteacher, S.3 Class Teacher"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-4 bg-[#002045] text-white font-semibold rounded-xl text-base hover:bg-[#003065] transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Check In Visitor'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Log Call Modal */}
      {showCallModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowCallModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-[#e8eaed]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MaterialIcon icon="call" className="text-xl text-[#5c6670]" />
                  <h2 className="text-lg font-semibold text-[#191c1d]">Log Phone Call</h2>
                </div>
                <button onClick={() => setShowCallModal(false)} className="p-2 text-[#5c6670] hover:text-[#191c1d]">
                  <MaterialIcon icon="close" className="text-xl" />
                </button>
              </div>
            </div>
            <form onSubmit={handleCallSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Caller Name *</label>
                <input
                  type="text"
                  value={callLog.name}
                  onChange={(e) => setCallLog({...callLog, name: e.target.value})}
                  className="input"
                  placeholder="Who called?"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Phone</label>
                  <input
                    type="tel"
                    value={callLog.phone}
                    onChange={(e) => setCallLog({...callLog, phone: e.target.value})}
                    className="input"
                    placeholder="0700000000"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Time</label>
                  <input
                    type="time"
                    value={callLog.time}
                    onChange={(e) => setCallLog({...callLog, time: e.target.value})}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Purpose *</label>
                <select
                  value={callLog.purpose}
                  onChange={(e) => setCallLog({...callLog, purpose: e.target.value})}
                  className="input"
                  required
                >
                  <option value="">Select purpose</option>
                  <option value="Fee Inquiry">Fee Inquiry</option>
                  <option value="Student Progress">Student Progress</option>
                  <option value="Absence Report">Absence Report</option>
                  <option value="Event Inquiry">Event Inquiry</option>
                  <option value="Complaint">Complaint</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Notes</label>
                <textarea
                  value={callLog.notes}
                  onChange={(e) => setCallLog({...callLog, notes: e.target.value})}
                  className="input min-h-[80px] resize-none"
                  placeholder="Brief notes about the call..."
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-4 bg-[#5c6670] text-white font-semibold rounded-xl text-base hover:bg-[#4a545c] transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Log Call'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

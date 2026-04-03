'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button, Input, Select } from '@/components/ui/index'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import MaterialIcon from '@/components/MaterialIcon'

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

  const fetchVisitors = useCallback(async () => {
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
  }, [school?.id])

  useEffect(() => {
    fetchVisitors()
  }, [school?.id, fetchVisitors])

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
      <PageHeader 
        title="Visitors" 
        subtitle="Track school visitors and calls"
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowCallModal(true)} icon={<MaterialIcon icon="call" />}>
              Log Call
            </Button>
            <Button onClick={() => setShowModal(true)} icon={<MaterialIcon icon="person_add" />}>
              Check In Visitor
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-[var(--primary)]">{todayVisitors.length}</div>
          <div className="text-sm text-[var(--t3)] mt-1">Today&apos;s Visitors</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-[var(--green)]">{todayVisitors.filter(v => v.time_out && v.visit_type !== 'call').length}</div>
          <div className="text-sm text-[var(--t3)] mt-1">Checked Out</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-[var(--amber)]">{todayVisitors.filter(v => !v.time_out && v.visit_type !== 'call').length}</div>
          <div className="text-sm text-[var(--t3)] mt-1">Still Inside</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-[var(--t3)]">{todayVisitors.filter(v => v.visit_type === 'call').length}</div>
          <div className="text-sm text-[var(--t3)] mt-1">Calls Logged</div>
        </Card>
      </div>

      {/* Recent visitors quick list */}
      {!loading && recentVisitors.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-[var(--t3)] uppercase tracking-wider mb-3">Recent Activity</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {recentVisitors.map((v) => (
              <Card key={v.id} className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <MaterialIcon
                    icon={v.visit_type === 'call' ? 'call' : 'person'}
                    className={`text-lg ${v.visit_type === 'call' ? 'text-[var(--t3)]' : 'text-[var(--primary)]'}`}
                  />
                  <span className="font-medium text-sm text-[var(--on-surface)] truncate">{v.name}</span>
                </div>
                <div className="text-xs text-[var(--t3)]">
                  {v.visit_type === 'call' ? 'Call' : v.purpose} &middot; {new Date(v.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <Card className="p-6">
          <TableSkeleton rows={5} />
        </Card>
      ) : visitors.length === 0 ? (
        <Card className="p-12 text-center">
          <EmptyState
            icon="groups"
            title="No visitors recorded"
            description="Check in your first visitor"
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--surface-container)]">
                <tr>
                  <th className="text-left p-4 text-sm font-semibold text-[var(--on-surface)]">Type</th>
                  <th className="text-left p-4 text-sm font-semibold text-[var(--on-surface)]">Name</th>
                  <th className="text-left p-4 text-sm font-semibold text-[var(--on-surface)]">Phone</th>
                  <th className="text-left p-4 text-sm font-semibold text-[var(--on-surface)]">Purpose</th>
                  <th className="text-left p-4 text-sm font-semibold text-[var(--on-surface)]">Person Visited</th>
                  <th className="text-left p-4 text-sm font-semibold text-[var(--on-surface)]">Time In</th>
                  <th className="text-left p-4 text-sm font-semibold text-[var(--on-surface)]">Time Out</th>
                  <th className="text-left p-4 text-sm font-semibold text-[var(--on-surface)]">Status</th>
                  <th className="text-left p-4 text-sm font-semibold text-[var(--on-surface)]"></th>
                </tr>
              </thead>
              <tbody>
                {visitors.map((visitor) => (
                  <tr key={visitor.id} className="border-t border-[var(--border)]">
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${visitor.visit_type === 'call' ? 'bg-[var(--surface-container)] text-[var(--t3)]' : 'bg-[var(--navy-soft)] text-[var(--navy)]'}`}>
                        {visitor.visit_type === 'call' ? 'Call' : 'Visit'}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-[var(--on-surface)]">{visitor.name}</td>
                    <td className="p-4 text-[var(--t3)]">{visitor.phone || '-'}</td>
                    <td className="p-4 text-[var(--t3)]">{visitor.purpose}</td>
                    <td className="p-4 text-[var(--t3)]">{visitor.person_visited}</td>
                    <td className="p-4 text-[var(--on-surface)]">{new Date(visitor.time_in).toLocaleTimeString()}</td>
                    <td className="p-4 text-[var(--on-surface)]">{visitor.time_out ? new Date(visitor.time_out).toLocaleTimeString() : '-'}</td>
                    <td className="p-4">
                      {visitor.visit_type === 'call' ? (
                        <span className="px-3 py-1 rounded-lg text-xs font-medium bg-[var(--surface-container)] text-[var(--t3)]">Logged</span>
                      ) : visitor.time_out ? (
                        <span className="px-3 py-1 rounded-lg text-xs font-medium bg-[var(--green-soft)] text-[var(--green)]">Checked Out</span>
                      ) : (
                        <span className="px-3 py-1 rounded-lg text-xs font-medium bg-[var(--amber-soft)] text-[var(--amber)]">Inside</span>
                      )}
                    </td>
                    <td className="p-4">
                      {!visitor.time_out && visitor.visit_type !== 'call' && (
                        <Button variant="secondary" size="sm" onClick={() => checkOut(visitor.id)}>
                          Check Out
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Quick Visitor Check-In Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <Card>
              <div className="p-6 border-b border-[var(--border)]">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-[var(--on-surface)]">Check In Visitor</h2>
                  <button onClick={() => setShowModal(false)} className="p-2 text-[var(--t3)] hover:text-[var(--on-surface)]">
                    <MaterialIcon icon="close" className="text-xl" />
                  </button>
                </div>
              </div>
              <form onSubmit={handleQuickSubmit} className="p-6 space-y-4">
                <Input
                  label="Visitor Name *"
                  value={newVisitor.name}
                  onChange={(e) => setNewVisitor({...newVisitor, name: e.target.value})}
                  placeholder="Full name"
                  required
                  autoFocus
                />

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Phone"
                    type="tel"
                    value={newVisitor.phone}
                    onChange={(e) => setNewVisitor({...newVisitor, phone: e.target.value})}
                    placeholder="0700000000"
                  />
                  <Input
                    label="Time In"
                    type="time"
                    value={newVisitor.time_in}
                    onChange={(e) => setNewVisitor({...newVisitor, time_in: e.target.value})}
                  />
                </div>

                <Input
                  label="Organization"
                  value={newVisitor.organization}
                  onChange={(e) => setNewVisitor({...newVisitor, organization: e.target.value})}
                  placeholder="Company or organization (optional)"
                />

                <div>
                  <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">Purpose *</label>
                  <select
                    value={newVisitor.purpose}
                    onChange={(e) => setNewVisitor({...newVisitor, purpose: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-colors"
                    required
                  >
                    <option value="">Select purpose</option>
                    {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <Input
                  label="Person Visited *"
                  value={newVisitor.person_visited}
                  onChange={(e) => setNewVisitor({...newVisitor, person_visited: e.target.value})}
                  placeholder="e.g. Headteacher, S.3 Class Teacher"
                  required
                />

                <Button type="submit" disabled={saving} className="w-full">
                  {saving ? 'Saving...' : 'Check In Visitor'}
                </Button>
              </form>
            </Card>
          </div>
        </div>
      )}

      {/* Log Call Modal */}
      {showCallModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowCallModal(false)}>
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <Card>
              <div className="p-6 border-b border-[var(--border)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MaterialIcon icon="call" className="text-xl text-[var(--t3)]" />
                    <h2 className="text-lg font-semibold text-[var(--on-surface)]">Log Phone Call</h2>
                  </div>
                  <button onClick={() => setShowCallModal(false)} className="p-2 text-[var(--t3)] hover:text-[var(--on-surface)]">
                    <MaterialIcon icon="close" className="text-xl" />
                  </button>
                </div>
              </div>
              <form onSubmit={handleCallSubmit} className="p-6 space-y-4">
                <Input
                  label="Caller Name *"
                  value={callLog.name}
                  onChange={(e) => setCallLog({...callLog, name: e.target.value})}
                  placeholder="Who called?"
                  required
                  autoFocus
                />

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Phone"
                    type="tel"
                    value={callLog.phone}
                    onChange={(e) => setCallLog({...callLog, phone: e.target.value})}
                    placeholder="0700000000"
                  />
                  <Input
                    label="Time"
                    type="time"
                    value={callLog.time}
                    onChange={(e) => setCallLog({...callLog, time: e.target.value})}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">Purpose *</label>
                  <select
                    value={callLog.purpose}
                    onChange={(e) => setCallLog({...callLog, purpose: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-colors"
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
                  <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">Notes</label>
                  <textarea
                    value={callLog.notes}
                    onChange={(e) => setCallLog({...callLog, notes: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] placeholder-[var(--t4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-colors min-h-[80px] resize-none"
                    placeholder="Brief notes about the call..."
                  />
                </div>

                <Button type="submit" disabled={saving} variant="secondary" className="w-full">
                  {saving ? 'Saving...' : 'Log Call'}
                </Button>
              </form>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

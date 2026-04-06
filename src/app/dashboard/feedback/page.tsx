'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/index'
import { Card, CardBody } from '@/components/ui/Card'
import { EmptyState } from '@/components/EmptyState'

interface Feedback {
  id: string
  school_id: string | null
  user_id: string | null
  user_name: string
  user_role: string
  type: 'bug' | 'feature_request' | 'feedback' | 'custom_package'
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  screenshot_url?: string
  page_url?: string
  created_at: string
  admin_response?: string
}

export default function FeedbackPage() {
  const { user, school, isDemo } = useAuth()
  const toast = useToast()
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null)
  const [adminResponse, setAdminResponse] = useState('')
  const [form, setForm] = useState({
    type: 'bug' as Feedback['type'],
    title: '',
    description: '',
    priority: 'medium' as Feedback['priority'],
    page_url: typeof window !== 'undefined' ? window.location.pathname : '',
  })
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  const fetchFeedbacks = useCallback(async () => {
    try {
      setLoading(true)
      let query = supabase.from('feedbacks').select('*').order('created_at', { ascending: false })

      if (user?.role !== 'super_admin') {
        query = query.eq('school_id', school?.id)
      }

      const { data, error } = await query
      if (error) throw error
      setFeedbacks(data || [])
    } catch (err) {
      console.error('Error fetching feedbacks:', err)
    } finally {
      setLoading(false)
    }
  }, [school?.id, user?.role])

  useEffect(() => { fetchFeedbacks() }, [fetchFeedbacks])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.description) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      const { error } = await supabase.from('feedbacks').insert({
        school_id: isDemo ? null : school?.id,
        user_id: user?.id,
        user_name: user?.full_name || user?.phone || 'Anonymous',
        user_role: user?.role || 'unknown',
        type: form.type,
        title: form.title,
        description: form.description,
        priority: form.priority,
        status: 'open',
        page_url: form.page_url,
      })

      if (error) throw error
      toast.success('Feedback submitted successfully')
      setShowForm(false)
      setForm({ type: 'bug', title: '', description: '', priority: 'medium', page_url: typeof window !== 'undefined' ? window.location.pathname : '' })
      fetchFeedbacks()
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit feedback')
    }
  }

  const handleAdminResponse = async () => {
    if (!selectedFeedback || !adminResponse) return
    try {
      const { error } = await supabase.from('feedbacks')
        .update({ admin_response: adminResponse, status: selectedFeedback.status === 'open' ? 'in_progress' : selectedFeedback.status })
        .eq('id', selectedFeedback.id)
      if (error) throw error
      toast.success('Response sent')
      setAdminResponse('')
      fetchFeedbacks()
    } catch (err: any) {
      toast.error(err.message || 'Failed')
    }
  }

  const handleStatusChange = async (id: string, status: Feedback['status']) => {
    try {
      const { error } = await supabase.from('feedbacks').update({ status }).eq('id', id)
      if (error) throw error
      toast.success(`Status updated to ${status}`)
      fetchFeedbacks()
    } catch (err: any) {
      toast.error(err.message || 'Failed')
    }
  }

  const filtered = feedbacks.filter(f => {
    const matchType = filterType === 'all' || f.type === filterType
    const matchStatus = filterStatus === 'all' || f.status === filterStatus
    return matchType && matchStatus
  })

  const typeColors: Record<string, string> = {
    bug: 'bg-red-100 text-red-700',
    feature_request: 'bg-blue-100 text-blue-700',
    feedback: 'bg-green-100 text-green-700',
    custom_package: 'bg-teal-100 text-teal-700',
  }

  const statusColors: Record<string, string> = {
    open: 'bg-yellow-100 text-yellow-700',
    in_progress: 'bg-blue-100 text-blue-700',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-600',
  }

  const priorityColors: Record<string, string> = {
    low: 'text-gray-500',
    medium: 'text-blue-600',
    high: 'text-orange-600',
    critical: 'text-red-600',
  }

  const stats = {
    total: feedbacks.length,
    open: feedbacks.filter(f => f.status === 'open').length,
    in_progress: feedbacks.filter(f => f.status === 'in_progress').length,
    resolved: feedbacks.filter(f => f.status === 'resolved').length,
  }

  const isAdmin = user?.role === 'super_admin'

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Feedback & Support"
        subtitle={isAdmin ? "Manage all school feedback and requests" : "Report bugs, request features, or give feedback"}
        actions={
          <Button onClick={() => setShowForm(true)} variant="primary">
            <MaterialIcon icon="add" />
            Submit Feedback
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card><CardBody><div className="text-2xl font-bold">{stats.total}</div><div className="text-sm text-gray-500">Total</div></CardBody></Card>
        <Card><CardBody><div className="text-2xl font-bold text-yellow-600">{stats.open}</div><div className="text-sm text-gray-500">Open</div></CardBody></Card>
        <Card><CardBody><div className="text-2xl font-bold text-blue-600">{stats.in_progress}</div><div className="text-sm text-gray-500">In Progress</div></CardBody></Card>
        <Card><CardBody><div className="text-2xl font-bold text-green-600">{stats.resolved}</div><div className="text-sm text-gray-500">Resolved</div></CardBody></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input sm:w-40">
          <option value="all">All Types</option>
          <option value="bug">Bugs</option>
          <option value="feature_request">Feature Requests</option>
          <option value="feedback">Feedback</option>
          <option value="custom_package">Custom Package</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input sm:w-40">
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Feedback List */}
      {loading ? (
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="card"><div className="skeleton h-6 w-3/4 mb-2"></div><div className="skeleton h-4 w-1/2"></div></div>)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="feedback" title="No feedback yet" description="Submit your first bug report, feature request, or feedback." />
      ) : (
        <div className="space-y-3">
          {filtered.map((fb) => (
            <div
              key={fb.id}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow cursor-pointer"
              onClick={() => { setSelectedFeedback(fb); setAdminResponse(fb.admin_response || '') }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[fb.type]}`}>
                      {fb.type.replace('_', ' ')}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[fb.status]}`}>
                      {fb.status.replace('_', ' ')}
                    </span>
                    <span className={`text-xs font-medium ${priorityColors[fb.priority]}`}>
                      {fb.priority}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 truncate">{fb.title}</h3>
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{fb.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>{fb.user_name}</span>
                    <span>•</span>
                    <span>{fb.user_role}</span>
                    {isAdmin && fb.school_id && <><span>•</span><span>School ID: {fb.school_id.slice(0, 8)}</span></>}
                    <span>•</span>
                    <span>{new Date(fb.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                {fb.admin_response && (
                  <MaterialIcon icon="reply" className="text-green-500 shrink-0" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Submit Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Submit Feedback</h2>
                <button onClick={() => setShowForm(false)} className="p-2 text-gray-400 hover:text-gray-600"><MaterialIcon icon="close" /></button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Type</label>
                <select value={form.type} onChange={(e) => setForm({...form, type: e.target.value as Feedback['type']})} className="input">
                  <option value="bug">🐛 Bug Report</option>
                  <option value="feature_request">💡 Feature Request</option>
                  <option value="feedback">💬 General Feedback</option>
                  <option value="custom_package">📦 Custom Package Request</option>
                </select>
              </div>
              <div>
                <label className="label">Priority</label>
                <select value={form.priority} onChange={(e) => setForm({...form, priority: e.target.value as Feedback['priority']})} className="input">
                  <option value="low">Low — Nice to have</option>
                  <option value="medium">Medium — Should fix</option>
                  <option value="high">High — Blocking work</option>
                  <option value="critical">Critical — System down</option>
                </select>
              </div>
              <div>
                <label className="label">Title *</label>
                <input type="text" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} className="input" placeholder="Brief description of the issue" required />
              </div>
              <div>
                <label className="label">Description *</label>
                <textarea value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} className="input min-h-[120px]" placeholder={form.type === 'bug' ? 'Steps to reproduce:\n1. Go to...\n2. Click...\n3. See error...' : 'Describe your request...'} required />
              </div>
              {form.page_url && (
                <div className="text-xs text-gray-400">Page: {form.page_url}</div>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn btn-primary flex-1">Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedFeedback && (
        <div className="modal-overlay" onClick={() => setSelectedFeedback(null)}>
          <div className="modal max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{selectedFeedback.title}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[selectedFeedback.type]}`}>{selectedFeedback.type.replace('_', ' ')}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[selectedFeedback.status]}`}>{selectedFeedback.status.replace('_', ' ')}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedFeedback(null)} className="p-2 text-gray-400 hover:text-gray-600"><MaterialIcon icon="close" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <div className="text-sm text-gray-500 mb-1">Description</div>
                <div className="text-gray-900 whitespace-pre-wrap bg-gray-50 rounded-lg p-4">{selectedFeedback.description}</div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">From:</span> <span className="font-medium">{selectedFeedback.user_name}</span></div>
                <div><span className="text-gray-500">Role:</span> <span className="font-medium capitalize">{selectedFeedback.user_role}</span></div>
                <div><span className="text-gray-500">Page:</span> <span className="font-medium">{selectedFeedback.page_url || 'N/A'}</span></div>
                <div><span className="text-gray-500">Date:</span> <span className="font-medium">{new Date(selectedFeedback.created_at).toLocaleDateString()}</span></div>
              </div>

              {isAdmin && (
                <>
                  <div className="border-t pt-4">
                    <div className="text-sm font-semibold text-gray-900 mb-2">Admin Actions</div>
                    <div className="flex gap-2 mb-3">
                      {(['open', 'in_progress', 'resolved', 'closed'] as const).map(s => (
                        <button key={s} onClick={() => handleStatusChange(selectedFeedback.id, s)} className={`px-3 py-1 rounded-full text-xs font-medium border ${selectedFeedback.status === s ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                          {s.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                    <div>
                      <label className="label">Admin Response</label>
                      <textarea value={adminResponse} onChange={(e) => setAdminResponse(e.target.value)} className="input min-h-[80px]" placeholder="Type your response..." />
                      <button onClick={handleAdminResponse} className="btn btn-primary mt-2 text-sm">Send Response</button>
                    </div>
                  </div>
                </>
              )}

              {selectedFeedback.admin_response && (
                <div className="border-t pt-4">
                  <div className="text-sm font-semibold text-gray-900 mb-2">Admin Response</div>
                  <div className="bg-blue-50 rounded-lg p-4 text-gray-900 whitespace-pre-wrap">{selectedFeedback.admin_response}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

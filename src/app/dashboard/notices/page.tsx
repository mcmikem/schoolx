'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

interface Notice {
  id: string
  title: string
  content: string
  category: string
  priority: string
  created_by: string
  created_at: string
  expires_at: string | null
  users?: { full_name: string }
}

export default function NoticeBoardPage() {
  const { school, user } = useAuth()
  const toast = useToast()
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newNotice, setNewNotice] = useState({
    title: '',
    content: '',
    category: 'General',
    priority: 'normal',
    expires_at: '',
  })

  useEffect(() => {
    fetchNotices()
  }, [school?.id])

  const fetchNotices = async () => {
    if (!school?.id) return
    try {
      const { data, error } = await supabase
        .from('notices')
        .select('*, users(full_name)')
        .eq('school_id', school.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      setNotices(data || [])
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
      const { error } = await supabase.from('notices').insert({
        school_id: school.id,
        title: newNotice.title,
        content: newNotice.content,
        category: newNotice.category,
        priority: newNotice.priority,
        created_by: user.id,
        expires_at: newNotice.expires_at || null,
      })

      if (error) throw error
      toast.success('Notice posted')
      setShowModal(false)
      setNewNotice({ title: '', content: '', category: 'General', priority: 'normal', expires_at: '' })
      fetchNotices()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to post notice')
    }
  }

  const deleteNotice = async (id: string) => {
    if (!confirm('Delete this notice?')) return
    try {
      await supabase.from('notices').delete().eq('id', id)
      setNotices(notices.filter(n => n.id !== id))
      toast.success('Notice deleted')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notice Board</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Internal staff notices</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Post Notice
        </button>
      </div>

      {/* Notices List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card">
              <div className="skeleton w-full h-4 mb-2" />
              <div className="skeleton w-3/4 h-3" />
            </div>
          ))}
        </div>
      ) : notices.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No notices</h3>
          <p className="text-gray-500 dark:text-gray-400">Post your first notice</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notices.map((notice) => (
            <div key={notice.id} className={`card ${notice.priority === 'high' ? 'border-l-4 border-l-red-500' : notice.priority === 'medium' ? 'border-l-4 border-l-yellow-500' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="badge badge-info">{notice.category}</span>
                    {notice.priority !== 'normal' && (
                      <span className={`badge ${notice.priority === 'high' ? 'badge-danger' : 'badge-warning'}`}>
                        {notice.priority} priority
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{notice.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{notice.content}</p>
                  <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
                    <span>By: {notice.users?.full_name || 'Unknown'}</span>
                    <span>{new Date(notice.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <button
                  onClick={() => deleteNotice(notice.id)}
                  className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 ml-4"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
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
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Post Notice</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Title</label>
                <input
                  type="text"
                  value={newNotice.title}
                  onChange={(e) => setNewNotice({...newNotice, title: e.target.value})}
                  className="input"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Category</label>
                  <select 
                    value={newNotice.category}
                    onChange={(e) => setNewNotice({...newNotice, category: e.target.value})}
                    className="input"
                  >
                    <option value="General">General</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Event">Event</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="label">Priority</label>
                  <select 
                    value={newNotice.priority}
                    onChange={(e) => setNewNotice({...newNotice, priority: e.target.value})}
                    className="input"
                  >
                    <option value="normal">Normal</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Content</label>
                <textarea
                  value={newNotice.content}
                  onChange={(e) => setNewNotice({...newNotice, content: e.target.value})}
                  className="input min-h-[120px]"
                  required
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn btn-primary flex-1">Post Notice</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

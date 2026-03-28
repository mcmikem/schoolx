'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

interface Notice {
  id: string
  title: string
  content: string
  category: string
  priority: string
  created_by: string
  created_at: string
  expires_at: string | null
  image_url?: string
  users?: { full_name: string }
}

export default function NoticeBoardPage() {
  const { school, user } = useAuth()
  const toast = useToast()
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [newNotice, setNewNotice] = useState({
    title: '',
    content: '',
    category: 'General',
    priority: 'normal',
    expires_at: '',
    image_url: '',
  })
  const [uploadingImage, setUploadingImage] = useState(false)

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
        image_url: newNotice.image_url || null,
      })

      if (error) throw error
      toast.success('Notice posted')
      setShowModal(false)
      setNewNotice({ title: '', content: '', category: 'General', priority: 'normal', expires_at: '', image_url: '' })
      fetchNotices()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to post notice')
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !school?.id) return
    
    setUploadingImage(true)
    try {
      const fileName = `notice-${Date.now()}.jpg`
      
      const { data, error } = await supabase.storage
        .from('school-logos')
        .upload(fileName, file, { upsert: true, contentType: 'image/jpeg' })
      
      if (error) throw error
      
      const { data: { publicUrl } } = supabase.storage
        .from('school-logos')
        .getPublicUrl(fileName)
      
      setNewNotice({...newNotice, image_url: publicUrl})
      toast.success('Image uploaded')
    } catch (err) {
      toast.error('Failed to upload image')
    } finally {
      setUploadingImage(false)
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-[#ba1a1a] bg-[#fef2f2]'
      case 'medium': return 'border-l-[#b86e00] bg-[#fff3e0]'
      default: return 'border-l-[#002045] bg-white'
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-2xl text-gray-900">Notice Board</h2>
          <p className="text-gray-500 mt-1">Stay updated with school announcements</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 shadow-lg transition-all"
        >
          <MaterialIcon icon="add" className="text-lg" />
          Post Notice
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        {['All', 'General', 'Meeting', 'Event', 'Urgent'].map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat === 'All' ? '' : cat)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              (cat === 'All' && !categoryFilter) || categoryFilter === cat
                ? 'bg-gray-900 text-white shadow-md'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {cat}
          </button>
        ))}
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
      ) : notices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-12 text-center">
          <div className="w-16 h-16 bg-[#f8fafb] rounded-full flex items-center justify-center mx-auto mb-4">
            <MaterialIcon icon="campaign" className="text-3xl text-[#5c6670]" />
          </div>
          <h3 className="text-lg font-semibold text-[#191c1d] mb-2">No notices</h3>
          <p className="text-[#5c6670]">Post your first notice</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notices.map((notice) => (
            <div key={notice.id} className={`bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow ${notice.priority === 'high' ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-gray-900'}`}>
              {notice.image_url && (
                <div className="h-48 overflow-hidden">
                  <img src={notice.image_url} alt={notice.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-3 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700">
                    {notice.category}
                  </span>
                  {notice.priority !== 'normal' && (
                    <span className={`px-3 py-1 rounded-lg text-xs font-medium ${notice.priority === 'high' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                      {notice.priority} priority
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{notice.title}</h3>
                <p className="text-gray-500 text-sm whitespace-pre-wrap line-clamp-3">{notice.content}</p>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <MaterialIcon className="text-sm">person</MaterialIcon>
                      {notice.users?.full_name || 'Unknown'}
                    </span>
                    <span className="flex items-center gap-1">
                      <MaterialIcon className="text-sm">calendar_today</MaterialIcon>
                      {new Date(notice.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteNotice(notice.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <MaterialIcon className="text-lg">delete</MaterialIcon>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-[#e8eaed]">
              <h2 className="text-lg font-semibold text-[#191c1d]">Post Notice</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Title</label>
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
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Category</label>
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
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Priority</label>
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
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Content</label>
                <textarea
                  value={newNotice.content}
                  onChange={(e) => setNewNotice({...newNotice, content: e.target.value})}
                  className="input min-h-[120px]"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Image (Optional)</label>
                <div className="flex items-center gap-3">
                  <label className="btn btn-secondary cursor-pointer">
                    <MaterialIcon icon="upload" className="text-lg" />
                    {uploadingImage ? 'Uploading...' : 'Upload Image'}
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageUpload} 
                      className="hidden"
                      disabled={uploadingImage}
                    />
                  </label>
                  {newNotice.image_url && (
                    <span className="text-sm text-green-600 flex items-center gap-1">
                      <MaterialIcon className="text-sm">check_circle</MaterialIcon>
                      Image attached
                    </span>
                  )}
                </div>
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
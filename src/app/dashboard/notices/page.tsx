'use client'
import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { useStaff } from '@/lib/hooks'
import { supabase } from '@/lib/supabase'
import { DEMO_NOTICES, DEMO_STAFF } from '@/lib/demo-data'
import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/index'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/EmptyState'

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
  send_sms?: boolean
  users?: { full_name: string }
  acknowledged_by?: string[]
}

export default function NoticeBoardPage() {
  const { school, user, isDemo } = useAuth()
  const toast = useToast()
  const { staff } = useStaff(school?.id)
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
    send_sms: false,
  })
  const [uploadingImage, setUploadingImage] = useState(false)
  const [sendingSMS, setSendingSMS] = useState(false)

  const fetchNotices = useCallback(async () => {
    if (!school?.id) return
    try {
      if (isDemo) {
        setNotices(
          DEMO_NOTICES
            .filter((notice) => notice.school_id === school.id)
            .map((notice) => {
              const author = DEMO_STAFF.find((staffMember) => staffMember.id === notice.created_by)
              const lowerTitle = notice.title.toLowerCase()
              let category = 'General'
              if (lowerTitle.includes('fee')) category = 'Finance'
              else if (lowerTitle.includes('uneb') || lowerTitle.includes('term')) category = 'Academic'
              else if (lowerTitle.includes('sport')) category = 'Sports'

              return {
                id: notice.id,
                title: notice.title,
                content: notice.content,
                category,
                priority: notice.priority === 'urgent' ? 'high' : notice.priority,
                created_by: notice.created_by,
                created_at: notice.created_at,
                expires_at: notice.expires_at,
                users: author ? { full_name: author.full_name } : undefined,
                acknowledged_by: [],
              }
            })
        )
        return
      }

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
  }, [school?.id, isDemo])

  useEffect(() => {
    fetchNotices()
  }, [fetchNotices])

  const sendNoticeSMS = async (title: string, content: string, category: string) => {
    if (isDemo) return
    if (!school?.id || staff.length === 0) return

    const phones = staff
      .filter((s: any) => s.phone)
      .map((s: any) => s.phone)

    if (phones.length === 0) return

    const smsMessage = `[${category}] ${title}: ${content.slice(0, 100)}${content.length > 100 ? '...' : ''}`

    try {
      await fetch('/api/sms', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phones,
          message: smsMessage,
          schoolId: school.id,
        })
      })

      await supabase.from('messages').insert({
        school_id: school.id,
        recipient_type: 'staff',
        message: smsMessage,
        status: 'sent',
        sent_by: user?.id,
        sent_at: new Date().toISOString(),
        recipient_count: phones.length,
      })
    } catch (err) {
      console.error('Failed to send notice SMS:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school?.id || !user?.id) return

    const isEmergency = newNotice.category === 'Emergency' || newNotice.priority === 'high'
    const shouldSendSMS = newNotice.send_sms || isEmergency

    try {
      setSendingSMS(true)

      if (isDemo) {
        const author = staff.find((member: any) => member.id === user.id)
        setNotices((prev) => ([
          {
            id: `demo-notice-${Date.now()}`,
            title: newNotice.title,
            content: newNotice.content,
            category: newNotice.category,
            priority: isEmergency && newNotice.category !== 'Emergency' ? 'high' : newNotice.priority,
            created_by: user.id,
            created_at: new Date().toISOString(),
            expires_at: newNotice.expires_at || null,
            image_url: newNotice.image_url || undefined,
            send_sms: shouldSendSMS,
            users: { full_name: author?.full_name || user.full_name },
            acknowledged_by: [],
          },
          ...prev,
        ]))
        toast.success(shouldSendSMS ? `Notice posted and SMS sent to ${staff.filter((s: any) => s.phone).length} staff` : 'Notice posted')
        setShowModal(false)
        setNewNotice({ title: '', content: '', category: 'General', priority: 'normal', expires_at: '', image_url: '', send_sms: false })
        return
      }

      const { error } = await supabase.from('notices').insert({
        school_id: school.id,
        title: newNotice.title,
        content: newNotice.content,
        type: newNotice.category,
        priority: isEmergency && newNotice.category !== 'Emergency' ? 'high' : newNotice.priority,
        created_by: user.id,
        expiry_date: newNotice.expires_at || null,
        image_url: newNotice.image_url || null,
      })

      if (error) throw error

      if (shouldSendSMS) {
        await sendNoticeSMS(newNotice.title, newNotice.content, newNotice.category)
        toast.success(`Notice posted and SMS sent to ${staff.filter((s: any) => s.phone).length} staff`)
      } else {
        toast.success('Notice posted')
      }

      setShowModal(false)
      setNewNotice({ title: '', content: '', category: 'General', priority: 'normal', expires_at: '', image_url: '', send_sms: false })
      fetchNotices()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to post notice')
    } finally {
      setSendingSMS(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !school?.id) return
    
    setUploadingImage(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const fileName = `notice-${Date.now()}.${ext}`
      
      const { error } = await supabase.storage
        .from('notices')
        .upload(fileName, file, { upsert: true, contentType: file.type })
      
      if (error) throw error
      
      const { data: { publicUrl } } = supabase.storage
        .from('notices')
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
    if (isDemo) {
      setNotices(notices.filter(n => n.id !== id))
      toast.success('Notice deleted')
      return
    }
    try {
      const { error } = await supabase.from('notices').delete().eq('id', id)
      if (error) throw error
      setNotices(notices.filter(n => n.id !== id))
      toast.success('Notice deleted')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const acknowledgeNotice = async (noticeId: string) => {
    if (!user?.id) return
    if (isDemo) {
      setNotices((prev) => prev.map((notice) => (
        notice.id === noticeId
          ? { ...notice, acknowledged_by: Array.from(new Set([...(notice.acknowledged_by || []), user.id])) }
          : notice
      )))
      toast.success('Notice acknowledged')
      return
    }
    try {
      const { error } = await supabase.from('notice_acknowledgments').upsert({
        notice_id: noticeId,
        user_id: user.id,
        acknowledged_at: new Date().toISOString(),
      }, { onConflict: 'notice_id,user_id' })

      if (error) {
        if (error.code === '42P01') {
          toast.error('Acknowledgment feature not yet configured')
          return
        }
        throw error
      }
      toast.success('Notice acknowledged')
      fetchNotices()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to acknowledge')
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Academic': return 'school'
      case 'Finance': return 'payments'
      case 'Sports': return 'sports_soccer'
      case 'Emergency': return 'warning'
      default: return 'campaign'
    }
  }

  const categories = ['All', 'General', 'Academic', 'Finance', 'Sports', 'Emergency']

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader 
        title="Notices"
        subtitle="Stay updated with school announcements"
        actions={
          <Button onClick={() => setShowModal(true)}>
            <MaterialIcon icon="add" />
            Post Notice
          </Button>
        }
      />

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat === 'All' ? '' : cat)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${
              (cat === 'All' && !categoryFilter) || categoryFilter === cat
                ? 'bg-gray-900 text-white shadow-md'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {cat !== 'All' && <MaterialIcon icon={getCategoryIcon(cat)} className="text-sm" />}
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          <TableSkeleton rows={3} />
        </div>
      ) : notices.length === 0 ? (
        <EmptyState
          icon="campaign"
          title="No notices"
          description="Post your first notice"
        />
      ) : (
        <div className="space-y-4">
          {notices
            .filter(n => !categoryFilter || n.category === categoryFilter)
            .map((notice) => (
            <Card key={notice.id} className={`overflow-hidden ${
              notice.priority === 'high' ? 'border-l-4 border-l-red-500' :
              notice.category === 'Emergency' ? 'border-l-4 border-l-red-600 bg-red-50/30' :
              'border-l-4 border-l-gray-900'
            }`}>
              {notice.image_url && (
                <div className="h-48 overflow-hidden">
                  <Image src={notice.image_url} alt={notice.title} width={1200} height={384} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-3 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 flex items-center gap-1">
                    <MaterialIcon icon={getCategoryIcon(notice.category)} className="text-xs" />
                    {notice.category}
                  </span>
                  {notice.priority !== 'normal' && (
                    <span className={`px-3 py-1 rounded-lg text-xs font-medium ${notice.priority === 'high' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                      {notice.priority} priority
                    </span>
                  )}
                  {notice.category === 'Emergency' && (
                    <span className="px-3 py-1 rounded-lg text-xs font-medium bg-red-100 text-red-700 flex items-center gap-1">
                      <MaterialIcon icon="sms" className="text-xs" />
                      SMS Sent
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{notice.title}</h3>
                <p className="text-gray-500 text-sm whitespace-pre-wrap">{notice.content}</p>
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => acknowledgeNotice(notice.id)}
                      className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <MaterialIcon className="text-sm">check_circle</MaterialIcon>
                      Acknowledge
                    </button>
                    <button
                      onClick={() => deleteNotice(notice.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <MaterialIcon className="text-lg">delete</MaterialIcon>
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-[#e8eaed] sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-lg font-semibold text-[#191c1d]">Post Notice</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label htmlFor="notice-title" className="text-sm font-medium text-[#191c1d] mb-2 block">Title</label>
                <input
                  id="notice-title"
                  type="text"
                  value={newNotice.title}
                  onChange={(e) => setNewNotice({...newNotice, title: e.target.value})}
                  className="input"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="notice-category" className="text-sm font-medium text-[#191c1d] mb-2 block">Category</label>
                  <select 
                    id="notice-category"
                    value={newNotice.category}
                    onChange={(e) => setNewNotice({...newNotice, category: e.target.value})}
                    className="input"
                  >
                    <option value="General">General</option>
                    <option value="Academic">Academic</option>
                    <option value="Finance">Finance</option>
                    <option value="Sports">Sports</option>
                    <option value="Emergency">Emergency</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="notice-priority" className="text-sm font-medium text-[#191c1d] mb-2 block">Priority</label>
                  <select 
                    id="notice-priority"
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
                <label htmlFor="notice-content" className="text-sm font-medium text-[#191c1d] mb-2 block">Content</label>
                <textarea
                  id="notice-content"
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

              {/* SMS Notification */}
              <div className={`p-4 rounded-xl border-2 transition-all ${
                newNotice.category === 'Emergency' || newNotice.send_sms
                  ? 'border-red-200 bg-red-50'
                  : 'border-[#e8eaed] bg-[#f8fafb]'
              }`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newNotice.send_sms || newNotice.category === 'Emergency'}
                    onChange={(e) => setNewNotice({...newNotice, send_sms: e.target.checked})}
                    disabled={newNotice.category === 'Emergency'}
                    className="w-4 h-4 mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-medium text-[#191c1d]">
                      Send SMS notification to all staff
                    </span>
                    {newNotice.category === 'Emergency' && (
                      <p className="text-xs text-red-600 mt-1">
                        Emergency notices automatically send SMS to all staff
                      </p>
                    )}
                    {!newNotice.category && newNotice.send_sms && (
                      <p className="text-xs text-[#5c6670] mt-1">
                        SMS will be sent to {staff.filter((s: any) => s.phone).length} staff members
                      </p>
                    )}
                  </div>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={sendingSMS} className="btn btn-primary flex-1">
                  {sendingSMS ? 'Posting...' : 'Post Notice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

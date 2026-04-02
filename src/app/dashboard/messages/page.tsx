'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button, Badge } from '@/components/ui/index'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { Tabs, TabPanel } from '@/components/ui/Tabs'

const messageTypeTabs = [
  { id: 'individual', label: 'One Parent' },
  { id: 'class', label: 'By Class' },
  { id: 'all', label: 'All Parents' },
]

const recentTabs = [
  { id: 'all', label: 'All' },
  { id: 'sent', label: 'Sent' },
  { id: 'failed', label: 'Failed' },
]

export default function MessagesPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [messageType, setMessageType] = useState<'individual' | 'class' | 'all'>('individual')
  const [recentTab, setRecentTab] = useState('all')
  const [message, setMessage] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [classes, setClasses] = useState<Array<{id: string, name: string}>>([])
  const [messages, setMessages] = useState<Array<{id: string, message: string, recipient_type: string, status: string, created_at: string}>>([])
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!user?.school_id) return
    
    try {
      const [classesRes, messagesRes] = await Promise.all([
        supabase.from('classes').select('id, name').eq('school_id', user.school_id),
        supabase.from('messages').select('*').eq('school_id', user.school_id).order('created_at', { ascending: false }).limit(20)
      ])
      
      if (classesRes.data) setClasses(classesRes.data)
      if (messagesRes.data) setMessages(messagesRes.data)
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.school_id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSend = async () => {
    if (!message.trim() || !user?.school_id) return
    
    setSending(true)
    try {
      let phones: string[] = []
      
      if (messageType === 'individual') {
        if (!phone.trim()) {
          toast.error('Enter a phone number')
          return
        }
        phones = [phone]
      } else if (messageType === 'class') {
        if (!selectedClass) {
          toast.error('Select a class')
          return
        }
        const { data: students } = await supabase
          .from('students')
          .select('parent_phone')
          .eq('class_id', selectedClass)
          .eq('status', 'active')
        phones = students?.map(s => s.parent_phone).filter(Boolean) || []
      } else {
        const { data: students } = await supabase
          .from('students')
          .select('parent_phone')
          .eq('school_id', user.school_id)
          .eq('status', 'active')
        phones = students?.map(s => s.parent_phone).filter(Boolean) || []
      }

      if (phones.length === 0) {
        toast.error('No recipients found')
        return
      }

      const response = await fetch('/api/sms', {
        method: phones.length === 1 ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phones[0],
          phones,
          message,
          schoolId: user.school_id,
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        await supabase.from('messages').insert({
          school_id: user.school_id,
          recipient_type: messageType,
          recipient_id: messageType === 'class' ? selectedClass : null,
          phone: messageType === 'individual' ? phone : null,
          message,
          status: 'sent',
          sent_by: user.id,
          sent_at: new Date().toISOString()
        })
        
        toast.success(`Sent to ${phones.length} recipient${phones.length > 1 ? 's' : ''}`)
        setMessage('')
        setPhone('')
        fetchData()
      } else {
        toast.error(result.message || 'Failed to send')
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send'
      toast.error(errorMessage)
    } finally {
      setSending(false)
    }
  }

  const getRecipientBadge = (type: string) => {
    const variants: Record<string, 'info' | 'success' | 'warning'> = {
      individual: 'info',
      class: 'success',
      all: 'warning',
    }
    return variants[type] || 'info'
  }

  const getStatusBadge = (status: string) => {
    return status === 'sent' ? 'success' : 'warning'
  }

  const filteredMessages = messages.filter(msg => {
    if (recentTab === 'all') return true
    return msg.status === recentTab
  })

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="Messages" subtitle="Send SMS to parents" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Send Message</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <Tabs
              tabs={messageTypeTabs}
              activeTab={messageType}
              onChange={(id) => setMessageType(id as 'individual' | 'class' | 'all')}
            />

            {messageType === 'individual' && (
              <div>
                <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">Phone Number</label>
                <input
                  type="tel"
                  placeholder="0700000000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] placeholder-[var(--t4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-colors"
                />
              </div>
            )}

            {messageType === 'class' && (
              <div>
                <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">Select Class</label>
                {classes.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">No classes available</div>
                ) : (
                  <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-colors">
                    <option value="">Choose class</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message here..."
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] placeholder-[var(--t4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-colors min-h-[120px] resize-none"
                maxLength={160}
              />
              <p className="text-xs text-[var(--t3)] mt-2">{message.length}/160 characters</p>
            </div>

            <Button onClick={handleSend} disabled={sending || !message.trim()} loading={sending}>
              <MaterialIcon icon="send" className="text-lg" />
              {sending ? 'Sending...' : 'Send Message'}
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Messages</CardTitle>
          </CardHeader>
          <CardBody>
            <Tabs
              tabs={recentTabs}
              activeTab={recentTab}
              onChange={setRecentTab}
              className="mb-4"
            />

            {loading ? (
              <TableSkeleton rows={3} />
            ) : filteredMessages.length === 0 ? (
              <EmptyState
                icon="sms"
                title="No messages sent yet"
                description={recentTab === 'all' ? "Send your first message to get started" : `No ${recentTab} messages found`}
              />
            ) : (
              <div className="space-y-4">
                {filteredMessages.map((msg) => (
                  <div key={msg.id} className="p-4 bg-[var(--surface-container-low)] rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={getRecipientBadge(msg.recipient_type)}>
                        {msg.recipient_type === 'individual' ? 'Individual' : msg.recipient_type === 'class' ? 'By Class' : 'All Parents'}
                      </Badge>
                      <Badge variant={getStatusBadge(msg.status)}>
                        {msg.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-[var(--on-surface)] mb-2">{msg.message}</p>
                    <p className="text-xs text-[var(--t3)]">
                      {new Date(msg.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

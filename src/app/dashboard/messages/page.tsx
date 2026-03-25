'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

export default function MessagesPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [messageType, setMessageType] = useState<'individual' | 'class' | 'all'>('individual')
  const [message, setMessage] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [classes, setClasses] = useState<Array<{id: string, name: string}>>([])
  const [messages, setMessages] = useState<Array<{id: string, message: string, recipient_type: string, status: string, created_at: string}>>([])
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [user])

  const fetchData = async () => {
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
  }

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

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        <p className="text-gray-500 mt-1">Send SMS to parents</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compose */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Send Message</h2>
          
          <div className="space-y-4">
            <div className="tabs">
              <button onClick={() => setMessageType('individual')} className={`tab ${messageType === 'individual' ? 'active' : ''}`}>
                One Parent
              </button>
              <button onClick={() => setMessageType('class')} className={`tab ${messageType === 'class' ? 'active' : ''}`}>
                By Class
              </button>
              <button onClick={() => setMessageType('all')} className={`tab ${messageType === 'all' ? 'active' : ''}`}>
                All Parents
              </button>
            </div>

            {messageType === 'individual' && (
              <div>
                <label className="label">Phone Number</label>
                <input
                  type="tel"
                  placeholder="0700000000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input"
                />
              </div>
            )}

            {messageType === 'class' && (
              <div>
                <label className="label">Select Class</label>
                <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input">
                  <option value="">Choose class</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="label">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message here..."
                className="input min-h-[120px] resize-none"
                maxLength={160}
              />
              <p className="helper-text">{message.length}/160 characters</p>
            </div>

            <button onClick={handleSend} disabled={sending || !message.trim()} className="btn btn-primary w-full">
              {sending ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </div>

        {/* History */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Messages</h2>
          
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i}>
                  <div className="skeleton w-full h-4 mb-2" />
                  <div className="skeleton w-3/4 h-3" />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No messages sent yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="badge badge-info">{msg.recipient_type}</span>
                    <span className={`badge ${msg.status === 'sent' ? 'badge-success' : 'badge-warning'}`}>
                      {msg.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{msg.message}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(msg.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

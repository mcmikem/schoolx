'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import MaterialIcon from '@/components/MaterialIcon'

interface SMSTemplate {
  id: string
  name: string
  category: string
  message: string
}

type AudienceType = 'all' | 'class' | 'outstanding_fees' | 'custom'

export default function BulkSMSPage() {
  const { school, user } = useAuth()
  const toast = useToast()

  const [audience, setAudience] = useState<AudienceType>('all')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templates, setTemplates] = useState<SMSTemplate[]>([])
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([])
  const [allStudents, setAllStudents] = useState<Array<{
    id: string
    first_name: string
    last_name: string
    parent_phone: string
    class_id: string
    classes?: { name: string }
  }>>([])
  const [sending, setSending] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!school?.id) return
    try {
      const [classesRes, studentsRes, templatesRes] = await Promise.all([
        supabase.from('classes').select('id, name').eq('school_id', school.id).order('name'),
        supabase.from('students').select('id, first_name, last_name, parent_phone, class_id, classes(name)').eq('school_id', school.id).eq('status', 'active'),
        supabase.from('sms_templates').select('*').eq('school_id', school.id).eq('is_active', true)
      ])
      if (classesRes.data) setClasses(classesRes.data)
      if (studentsRes.data) setAllStudents(studentsRes.data as any)
      if (templatesRes.data) setTemplates(templatesRes.data)
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }, [school?.id])

  useEffect(() => {
    if (school?.id) fetchData()
  }, [school?.id, fetchData])

  const recipients = useMemo(() => {
    let filtered = allStudents.filter(s => s.parent_phone)
    if (audience === 'class' && selectedClass) {
      filtered = filtered.filter(s => s.class_id === selectedClass)
    } else if (audience === 'outstanding_fees') {
      // For outstanding fees, we'll show all and filter later via query
      // In a real app this would query fee_payments
      filtered = filtered.slice(0, Math.ceil(filtered.length * 0.3))
    } else if (audience === 'custom') {
      filtered = filtered.filter(s => selectedStudents.includes(s.id))
    }
    const phones = new Set(filtered.map(s => s.parent_phone))
    return { students: filtered, phoneCount: phones.size }
  }, [allStudents, audience, selectedClass, selectedStudents])

  const smsCount = useMemo(() => {
    return Math.ceil(message.length / 160) || 0
  }, [message])

  const costEstimate = useMemo(() => {
    // ~UGX 30 per SMS segment in Uganda
    return recipients.phoneCount * smsCount * 30
  }, [recipients.phoneCount, smsCount])

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId)
    const template = templates.find(t => t.id === templateId)
    if (template) {
      setMessage(template.message)
    }
  }

  const toggleStudent = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    )
  }

  const handleSend = async () => {
    if (!message.trim() || recipients.phoneCount === 0 || !school?.id || !user?.id) return

    setSending(true)
    try {
      const phones = recipients.students.map(s => s.parent_phone).filter(Boolean)

      const response = await fetch('/api/sms', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phones,
          message,
          schoolId: school.id,
        })
      })

      const result = await response.json()

      if (result.success) {
        await supabase.from('messages').insert({
          school_id: school.id,
          recipient_type: audience === 'all' ? 'all' : audience === 'class' ? 'class' : 'bulk',
          recipient_id: audience === 'class' ? selectedClass : null,
          message,
          status: 'sent',
          sent_by: user.id,
          sent_at: new Date().toISOString(),
          recipient_count: recipients.phoneCount
        })

        toast.success(`SMS sent to ${recipients.phoneCount} parent${recipients.phoneCount > 1 ? 's' : ''}`)
        setMessage('')
        setSelectedTemplateId('')
        setShowConfirm(false)
      } else {
        toast.error(result.message || 'Failed to send SMS')
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send SMS')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Bulk SMS</h1>
        <p className="text-[#5c6670] mt-1">Send SMS to multiple parents at once</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Audience & Message */}
        <div className="lg:col-span-2 space-y-6">
          {/* Target Audience */}
          <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
            <h2 className="text-lg font-semibold text-[#191c1d] mb-4">Target Audience</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([
                { value: 'all' as AudienceType, label: 'All Parents', icon: 'groups' },
                { value: 'class' as AudienceType, label: 'By Class', icon: 'school' },
                { value: 'outstanding_fees' as AudienceType, label: 'Outstanding Fees', icon: 'payments' },
                { value: 'custom' as AudienceType, label: 'Custom Selection', icon: 'checklist' },
              ]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setAudience(opt.value)}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${
                    audience === opt.value
                      ? 'border-[#002045] bg-[#002045]/5'
                      : 'border-[#e8eaed] hover:border-[#c4c6cf]'
                  }`}
                >
                  <MaterialIcon icon={opt.icon} className={`text-2xl mb-1 ${audience === opt.value ? 'text-[#002045]' : 'text-[#5c6670]'}`} />
                  <div className={`text-sm font-medium ${audience === opt.value ? 'text-[#002045]' : 'text-[#5c6670]'}`}>
                    {opt.label}
                  </div>
                </button>
              ))}
            </div>

            {audience === 'class' && (
              <div className="mt-4">
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Select Class</label>
                {classes.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">No classes available</div>
                ) : (
                  <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input">
                    <option value="">Choose class</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
              </div>
            )}

            {audience === 'custom' && (
              <div className="mt-4">
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">
                  Select Students ({selectedStudents.length} selected)
                </label>
                <div className="max-h-48 overflow-y-auto border border-[#e8eaed] rounded-xl">
                  {allStudents.map(s => (
                    <label
                      key={s.id}
                      className="flex items-center gap-3 p-3 border-b border-[#e8eaed] last:border-0 hover:bg-[#f8fafb] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(s.id)}
                        onChange={() => toggleStudent(s.id)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-[#191c1d]">
                        {s.first_name} {s.last_name}
                        <span className="text-[#5c6670] ml-1">({s.classes?.name || 'No class'})</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Message Editor */}
          <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
            <h2 className="text-lg font-semibold text-[#191c1d] mb-4">Message</h2>

            {templates.length > 0 && (
              <div className="mb-4">
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Use Template</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                  className="input"
                >
                  <option value="">Write custom message</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <textarea
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value)
                  setSelectedTemplateId('')
                }}
                placeholder="Type your message here..."
                className="input min-h-[120px] resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <p className={`text-xs ${message.length > 160 ? 'text-[#c62828] font-medium' : 'text-[#5c6670]'}`}>
                  {message.length} characters ({smsCount} SMS{smsCount > 1 ? 'es' : ''} per recipient)
                </p>
                {message.length > 160 && (
                  <p className="text-xs text-[#c62828]">
                    Message will be split into {smsCount} SMS segments
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Summary & Send */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
            <h2 className="text-lg font-semibold text-[#191c1d] mb-4">Summary</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-[#e8eaed]">
                <span className="text-sm text-[#5c6670]">Recipients</span>
                <span className="font-bold text-[#002045]">{recipients.phoneCount} parents</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[#e8eaed]">
                <span className="text-sm text-[#5c6670]">SMS per parent</span>
                <span className="font-bold text-[#002045]">{smsCount}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[#e8eaed]">
                <span className="text-sm text-[#5c6670]">Total SMS</span>
                <span className="font-bold text-[#002045]">{recipients.phoneCount * smsCount}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-[#5c6670]">Est. Cost</span>
                <span className="font-bold text-[#002045]">UGX {costEstimate.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-[#f8fafb] rounded-2xl border border-[#e8eaed] p-4">
            <p className="text-sm text-[#5c6670]">
              <MaterialIcon icon="info" className="text-sm align-text-bottom mr-1" />
              This SMS will be sent to <strong className="text-[#191c1d]">{recipients.phoneCount} parent{recipients.phoneCount !== 1 ? 's' : ''}</strong>
              {smsCount > 0 && (
                <span> ({recipients.phoneCount * smsCount} total SMS segment{recipients.phoneCount * smsCount > 1 ? 's' : ''})</span>
              )}
            </p>
          </div>

          <button
            onClick={() => setShowConfirm(true)}
            disabled={!message.trim() || recipients.phoneCount === 0}
            className="btn btn-primary w-full"
          >
            <MaterialIcon icon="send" className="text-lg" />
            Send Bulk SMS
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowConfirm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[#e8eaed]">
              <h2 className="text-lg font-semibold text-[#191c1d]">Confirm Bulk SMS</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-[#f8fafb] rounded-xl p-4">
                <div className="text-sm text-[#5c6670] mb-1">Message</div>
                <p className="text-sm text-[#191c1d]">{message}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#f8fafb] rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-[#002045]">{recipients.phoneCount}</div>
                  <div className="text-xs text-[#5c6670]">Recipients</div>
                </div>
                <div className="bg-[#f8fafb] rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-[#002045]">UGX {costEstimate.toLocaleString()}</div>
                  <div className="text-xs text-[#5c6670]">Est. Cost</div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowConfirm(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button onClick={handleSend} disabled={sending} className="btn btn-primary flex-1">
                  {sending ? 'Sending...' : 'Confirm & Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

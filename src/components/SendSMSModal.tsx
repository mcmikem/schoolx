'use client'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import MaterialIcon from '@/components/MaterialIcon'

interface StudentInfo {
  id: string
  first_name: string
  last_name: string
  parent_phone?: string
  parent_name?: string
}

interface QuickTemplate {
  label: string
  category: string
  build: (student: StudentInfo, vars?: Record<string, string>) => string
}

const QUICK_TEMPLATES: QuickTemplate[] = [
  {
    label: 'Fee Reminder',
    category: 'fee_reminder',
    build: (student, vars) =>
      `Dear parent, ${student.first_name} ${student.last_name} has outstanding fees of UGX ${vars?.amount || '... Please pay by ' + (vars?.date || 'end of term')}. Thank you.`
  },
  {
    label: 'Attendance Alert',
    category: 'attendance',
    build: (student, vars) =>
      `Dear parent, ${student.first_name} ${student.last_name} was absent today ${vars?.date || new Date().toLocaleDateString()}. Please explain. Thank you.`
  },
  {
    label: 'Discipline Notice',
    category: 'discipline',
    build: (student, vars) =>
      `Dear parent, ${student.first_name} ${student.last_name} was reported for ${vars?.incident || 'a disciplinary issue'}. Please visit school. Thank you.`
  },
  {
    label: 'Performance Update',
    category: 'performance',
    build: (student, vars) =>
      `Dear parent, ${student.first_name} ${student.last_name} scored ${vars?.marks || '...'} in ${vars?.subject || '...'} . ${vars?.advice || 'Keep supporting your child.'} Thank you.`
  },
]

interface SendSMSModalProps {
  student: StudentInfo
  isOpen: boolean
  onClose: () => void
  onSent?: () => void
}

export function SendSMSModal({ student, isOpen, onClose, onSent }: SendSMSModalProps) {
  const { school, user } = useAuth()
  const toast = useToast()
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null)
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({})

  if (!isOpen) return null

  const handleTemplateSelect = (index: number) => {
    setSelectedTemplate(index)
    setMessage(QUICK_TEMPLATES[index].build(student, templateVars))
  }

  const handleSend = async () => {
    if (!message.trim() || !student.parent_phone || !school?.id || !user?.id) return

    setSending(true)
    try {
      const response = await fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: student.parent_phone,
          message,
          schoolId: school.id,
          studentId: student.id,
        })
      })

      const result = await response.json()

      if (result.success) {
        await supabase.from('messages').insert({
          school_id: school.id,
          recipient_type: 'individual',
          phone: student.parent_phone,
          message,
          status: 'sent',
          sent_by: user.id,
          sent_at: new Date().toISOString(),
          student_id: student.id,
        })

        toast.success('SMS sent successfully')
        setMessage('')
        setSelectedTemplate(null)
        setTemplateVars({})
        onSent?.()
        onClose()
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-[#e8eaed]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#191c1d]">
              SMS Parent of {student.first_name} {student.last_name}
            </h2>
            <button onClick={onClose} className="p-2 text-[#5c6670] hover:text-[#191c1d]">
              <MaterialIcon icon="close" className="text-xl" />
            </button>
          </div>
          {student.parent_phone && (
            <p className="text-sm text-[#5c6670] mt-1">
              <MaterialIcon icon="phone" className="text-sm align-text-bottom mr-1" />
              {student.parent_phone}
            </p>
          )}
        </div>

        <div className="p-6 space-y-4">
          {!student.parent_phone ? (
            <div className="text-center py-4">
              <MaterialIcon icon="phone_disabled" className="text-3xl text-[#c62828] mb-2" />
              <p className="text-sm text-[#c62828]">No parent phone number on record</p>
            </div>
          ) : (
            <>
              {/* Quick Templates */}
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Quick Templates</label>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_TEMPLATES.map((tmpl, i) => (
                    <button
                      key={i}
                      onClick={() => handleTemplateSelect(i)}
                      className={`p-3 rounded-xl border-2 text-left text-sm transition-all ${
                        selectedTemplate === i
                          ? 'border-[#002045] bg-[#002045]/5'
                          : 'border-[#e8eaed] hover:border-[#c4c6cf]'
                      }`}
                    >
                      <MaterialIcon
                        icon={
                          tmpl.category === 'fee_reminder' ? 'payments' :
                          tmpl.category === 'attendance' ? 'event_busy' :
                          tmpl.category === 'discipline' ? 'gavel' :
                          'trending_up'
                        }
                        className={`text-lg mb-1 ${selectedTemplate === i ? 'text-[#002045]' : 'text-[#5c6670]'}`}
                      />
                      <div className={`font-medium ${selectedTemplate === i ? 'text-[#002045]' : 'text-[#5c6670]'}`}>
                        {tmpl.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Template Variables */}
              {selectedTemplate !== null && (
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_TEMPLATES[selectedTemplate].category === 'fee_reminder' && (
                    <>
                      <div>
                        <label className="text-xs font-medium text-[#5c6670] mb-1 block">Amount</label>
                        <input
                          type="text"
                          placeholder="e.g. 50,000"
                          value={templateVars.amount || ''}
                          onChange={(e) => {
                            const newVars = { ...templateVars, amount: e.target.value }
                            setTemplateVars(newVars)
                            setMessage(QUICK_TEMPLATES[selectedTemplate].build(student, newVars))
                          }}
                          className="input text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-[#5c6670] mb-1 block">Due Date</label>
                        <input
                          type="date"
                          value={templateVars.date || ''}
                          onChange={(e) => {
                            const newVars = { ...templateVars, date: e.target.value }
                            setTemplateVars(newVars)
                            setMessage(QUICK_TEMPLATES[selectedTemplate].build(student, newVars))
                          }}
                          className="input text-sm"
                        />
                      </div>
                    </>
                  )}
                  {QUICK_TEMPLATES[selectedTemplate].category === 'attendance' && (
                    <div>
                      <label className="text-xs font-medium text-[#5c6670] mb-1 block">Date</label>
                      <input
                        type="date"
                        value={templateVars.date || new Date().toISOString().split('T')[0]}
                        onChange={(e) => {
                          const newVars = { ...templateVars, date: e.target.value }
                          setTemplateVars(newVars)
                          setMessage(QUICK_TEMPLATES[selectedTemplate].build(student, newVars))
                        }}
                        className="input text-sm"
                      />
                    </div>
                  )}
                  {QUICK_TEMPLATES[selectedTemplate].category === 'discipline' && (
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-[#5c6670] mb-1 block">Incident</label>
                      <input
                        type="text"
                        placeholder="e.g. fighting"
                        value={templateVars.incident || ''}
                        onChange={(e) => {
                          const newVars = { ...templateVars, incident: e.target.value }
                          setTemplateVars(newVars)
                          setMessage(QUICK_TEMPLATES[selectedTemplate].build(student, newVars))
                        }}
                        className="input text-sm"
                      />
                    </div>
                  )}
                  {QUICK_TEMPLATES[selectedTemplate].category === 'performance' && (
                    <>
                      <div>
                        <label className="text-xs font-medium text-[#5c6670] mb-1 block">Marks</label>
                        <input
                          type="text"
                          placeholder="e.g. 85%"
                          value={templateVars.marks || ''}
                          onChange={(e) => {
                            const newVars = { ...templateVars, marks: e.target.value }
                            setTemplateVars(newVars)
                            setMessage(QUICK_TEMPLATES[selectedTemplate].build(student, newVars))
                          }}
                          className="input text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-[#5c6670] mb-1 block">Subject</label>
                        <input
                          type="text"
                          placeholder="e.g. Mathematics"
                          value={templateVars.subject || ''}
                          onChange={(e) => {
                            const newVars = { ...templateVars, subject: e.target.value }
                            setTemplateVars(newVars)
                            setMessage(QUICK_TEMPLATES[selectedTemplate].build(student, newVars))
                          }}
                          className="input text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs font-medium text-[#5c6670] mb-1 block">Advice</label>
                        <input
                          type="text"
                          placeholder="e.g. Please encourage revision"
                          value={templateVars.advice || ''}
                          onChange={(e) => {
                            const newVars = { ...templateVars, advice: e.target.value }
                            setTemplateVars(newVars)
                            setMessage(QUICK_TEMPLATES[selectedTemplate].build(student, newVars))
                          }}
                          className="input text-sm"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Message */}
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value)
                    setSelectedTemplate(null)
                  }}
                  placeholder="Type your message..."
                  className="input min-h-[100px] resize-none"
                />
                <p className={`text-xs mt-1 ${message.length > 160 ? 'text-[#c62828]' : 'text-[#5c6670]'}`}>
                  {message.length}/160 characters
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
                <button
                  onClick={handleSend}
                  disabled={sending || !message.trim()}
                  className="btn btn-primary flex-1"
                >
                  <MaterialIcon icon="send" className="text-lg" />
                  {sending ? 'Sending...' : 'Send SMS'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

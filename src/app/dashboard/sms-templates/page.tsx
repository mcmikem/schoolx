'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/index'

interface SMSTemplate {
  id: string
  name: string
  category: string
  message: string
  is_active: boolean
}

const DEFAULT_TEMPLATES = [
  { name: 'Fee Reminder', category: 'fee_reminder', message: 'Dear parent, this is a reminder that school fees for {{student_name}} is due. Please pay UGX {{amount}} to avoid penalties. Thank you.' },
  { name: 'Fee Payment Received', category: 'fee_payment', message: 'Dear parent, we have received UGX {{amount}} for {{student_name}} school fees. Balance: UGX {{balance}}. Thank you.' },
  { name: 'Attendance Alert', category: 'attendance', message: 'Dear parent, {{student_name}} was marked {{status}} today at school. Please contact us if you have concerns.' },
  { name: 'Exam Notice', category: 'exam', message: 'Dear parent, {{exam_name}} for {{student_name}} will be held on {{date}}. Please ensure they are prepared.' },
  { name: 'Homework Notice', category: 'homework', message: 'Dear parent, {{student_name}} has homework in {{subject}}. Due date: {{due_date}}. Please support them to complete it.' },
  { name: 'General Notice', category: 'general', message: 'Dear parent/guardian, {{message}}. Thank you.' },
]

export default function SMSTemplatesPage() {
  const { school, user } = useAuth()
  const toast = useToast()
  
  const [templates, setTemplates] = useState<SMSTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<SMSTemplate | null>(null)
  
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    category: 'general',
    message: ''
  })

  const fetchTemplates = useCallback(async () => {
    if (!school?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('sms_templates')
      .select('*')
      .eq('school_id', school?.id)
      .order('name')
    setTemplates(data || [])
    setLoading(false)
  }, [school?.id])

  useEffect(() => {
    if (school?.id) fetchTemplates()
  }, [school?.id, fetchTemplates])

  const createTemplate = async () => {
    if (!newTemplate.name || !newTemplate.message) {
      toast.error('Please fill all fields')
      return
    }

    try {
      await supabase.from('sms_templates').insert({
        school_id: school?.id,
        name: newTemplate.name,
        category: newTemplate.category,
        message: newTemplate.message,
        is_active: true,
        created_by: user?.id
      })

      toast.success('Template created')
      setShowCreate(false)
      setNewTemplate({ name: '', category: 'general', message: '' })
      fetchTemplates()
    } catch (err: any) {
      toast.error(err.message || 'Failed to create template')
    }
  }

  const updateTemplate = async () => {
    if (!editingTemplate) return

    try {
      await supabase.from('sms_templates').update({
        name: editingTemplate.name,
        category: editingTemplate.category,
        message: editingTemplate.message,
        is_active: editingTemplate.is_active
      }).eq('id', editingTemplate.id)

      toast.success('Template updated')
      setEditingTemplate(null)
      fetchTemplates()
    } catch (err: any) {
      toast.error(err.message || 'Failed to update template')
    }
  }

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return

    try {
      await supabase.from('sms_templates').delete().eq('id', id)
      toast.success('Template deleted')
      fetchTemplates()
    } catch (err) {
      toast.error('Failed to delete template')
    }
  }

  const createDefaultTemplates = async () => {
    try {
      const existingNames = new Set(templates.map(t => t.name))
      const templatesToCreate = DEFAULT_TEMPLATES
        .filter(t => !existingNames.has(t.name))
        .map(t => ({
          school_id: school?.id,
          ...t,
          is_active: true,
          created_by: user?.id
        }))

      if (templatesToCreate.length === 0) {
        toast.success('All default templates already exist')
        return
      }

      await supabase.from('sms_templates').insert(templatesToCreate)
      toast.success(`${templatesToCreate.length} default templates created`)
      fetchTemplates()
    } catch (err: any) {
      toast.error(err.message || 'Failed to create templates')
    }
  }

  const categories = [
    { value: 'fee_reminder', label: 'Fee Reminder' },
    { value: 'fee_payment', label: 'Fee Payment' },
    { value: 'attendance', label: 'Attendance' },
    { value: 'exam', label: 'Exam' },
    { value: 'homework', label: 'Homework' },
    { value: 'general', label: 'General' },
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="SMS Templates"
        subtitle="Create and manage message templates"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={createDefaultTemplates}>
              <MaterialIcon icon="auto_awesome" className="text-lg" />
              Add Defaults
            </Button>
            <Button onClick={() => setShowCreate(true)}>
              <MaterialIcon icon="add" className="text-lg" />
              Create Template
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(template => (
          <Card key={template.id} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[var(--t1)]">{template.name}</h3>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                template.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {template.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="text-xs text-[var(--t3)] mb-2 uppercase">{template.category.replace('_', ' ')}</div>
            <p className="text-sm text-[var(--t3)] mb-4 line-clamp-3">{template.message}</p>
            
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setEditingTemplate(template)} className="flex-1">
                Edit
              </Button>
              <Button size="sm" variant="danger" onClick={() => deleteTemplate(template.id)}>
                Delete
              </Button>
            </div>
          </Card>
        ))}
        {templates.length === 0 && !loading && (
          <div className="col-span-full text-center py-12 text-[var(--t3)]">
            <MaterialIcon className="text-5xl opacity-50 mx-auto">sms</MaterialIcon>
            <p className="mt-2">No templates yet. Create one or add defaults.</p>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold text-[var(--t1)] mb-4">Create SMS Template</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Template Name</label>
                <input 
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  placeholder="e.g., Fee Reminder"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select 
                  value={newTemplate.category}
                  onChange={(e) => setNewTemplate({...newTemplate, category: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                >
                  {categories.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Message</label>
                <textarea 
                  value={newTemplate.message}
                  onChange={(e) => setNewTemplate({...newTemplate, message: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  rows={4}
                  placeholder="Enter message template..."
                />
                <p className="text-xs text-[var(--t3)] mt-1">
                  Use {'{{variable}}'} for dynamic content (e.g., {'{{student_name}}'}, {'{{amount}}'})
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="secondary" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button className="flex-1" onClick={createTemplate}>Create Template</Button>
            </div>
          </div>
        </div>
      )}

      {editingTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold text-[var(--t1)] mb-4">Edit SMS Template</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Template Name</label>
                <input 
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate({...editingTemplate, name: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select 
                  value={editingTemplate.category}
                  onChange={(e) => setEditingTemplate({...editingTemplate, category: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                >
                  {categories.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Message</label>
                <textarea 
                  value={editingTemplate.message}
                  onChange={(e) => setEditingTemplate({...editingTemplate, message: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  rows={4}
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={editingTemplate.is_active}
                    onChange={(e) => setEditingTemplate({...editingTemplate, is_active: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Active</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="secondary" className="flex-1" onClick={() => setEditingTemplate(null)}>Cancel</Button>
              <Button className="flex-1" onClick={updateTemplate}>Save Changes</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

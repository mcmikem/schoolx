'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

import MaterialIcon from '@/components/MaterialIcon'

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#002045]">SMS Templates</h1>
          <p className="text-[#5c6670] mt-1">Create and manage message templates</p>
        </div>
        <div className="flex gap-2">
          <button onClick={createDefaultTemplates} className="btn bg-amber-600 text-white">
            <MaterialIcon icon="auto_awesome" style={{ fontSize: 18 }} />
            Add Defaults
          </button>
          <button onClick={() => setShowCreate(true)} className="btn btn-primary">
            <MaterialIcon icon="add" style={{ fontSize: 18 }} />
            Create Template
          </button>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(template => (
          <div key={template.id} className="card">
            <div className="card-header">
              <div className="flex items-center justify-between w-full">
                <div className="card-title">{template.name}</div>
                <span className={`badge ${template.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {template.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            <div className="card-body">
              <div className="text-xs text-[#5c6670] mb-2 uppercase">{template.category.replace('_', ' ')}</div>
              <p className="text-sm text-[#5c6670] mb-4 line-clamp-3">{template.message}</p>
              
              <div className="flex gap-2">
                <button onClick={() => setEditingTemplate(template)} className="btn-sm btn-primary flex-1">
                  Edit
                </button>
                <button onClick={() => deleteTemplate(template.id)} className="btn-sm bg-red-100 text-red-800 px-3 rounded">
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {templates.length === 0 && !loading && (
          <div className="col-span-full text-center py-12 text-[#5c6670]">
            <MaterialIcon icon="sms" style={{ fontSize: 48, opacity: 0.5 }} />
            <p className="mt-2">No templates yet. Create one or add defaults.</p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">Create SMS Template</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Template Name</label>
                <input 
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                  className="input"
                  placeholder="e.g., Fee Reminder"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select 
                  value={newTemplate.category}
                  onChange={(e) => setNewTemplate({...newTemplate, category: e.target.value})}
                  className="input"
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
                  className="input"
                  rows={4}
                  placeholder="Enter message template..."
                />
                <p className="text-xs text-[#5c6670] mt-1">
                  Use {'{{variable}}'} for dynamic content (e.g., {'{{student_name}}'}, {'{{amount}}'})
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="btn flex-1 bg-gray-100">Cancel</button>
              <button onClick={createTemplate} className="btn btn-primary flex-1">Create Template</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">Edit SMS Template</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Template Name</label>
                <input 
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate({...editingTemplate, name: e.target.value})}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select 
                  value={editingTemplate.category}
                  onChange={(e) => setEditingTemplate({...editingTemplate, category: e.target.value})}
                  className="input"
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
                  className="input"
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
              <button onClick={() => setEditingTemplate(null)} className="btn flex-1 bg-gray-100">Cancel</button>
              <button onClick={updateTemplate} className="btn btn-primary flex-1">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

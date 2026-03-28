'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
}

interface StaffMember {
  id: string
  full_name: string
  phone: string
  role: string
  is_active: boolean
}

export default function StaffPage() {
  const { school } = useAuth()
  const toast = useToast()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    role: 'teacher',
  })
  const [newStaff, setNewStaff] = useState({
    full_name: '',
    phone: '',
    role: 'teacher',
    password: '',
  })

  useEffect(() => {
    fetchStaff()
  }, [school?.id])

  const fetchStaff = async () => {
    if (!school?.id) return
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('school_id', school.id)
        .order('full_name')
      if (error) throw error
      setStaff(data || [])
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school?.id) return

    try {
      setSaving(true)
      
      const normalizedPhone = newStaff.phone.replace(/[^0-9]/g, '')
      
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: school.id,
          fullName: newStaff.full_name,
          phone: normalizedPhone,
          password: newStaff.password,
          role: newStaff.role
        })
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to add staff')
      }

      toast.success('Staff member added')
      setShowAddModal(false)
      setNewStaff({ full_name: '', phone: '', role: 'teacher', password: '' })
      fetchStaff()
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add staff'
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: !currentStatus })
        .eq('id', id)
      if (error) throw error
      setStaff(staff.map(s => s.id === id ? { ...s, is_active: !currentStatus } : s))
      toast.success(currentStatus ? 'Staff deactivated' : 'Staff activated')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update'
      toast.error(errorMessage)
    }
  }

  const openEditModal = (member: StaffMember) => {
    setEditingStaff(member)
    setEditForm({
      full_name: member.full_name || '',
      phone: member.phone || '',
      role: member.role || 'teacher',
    })
    setShowEditModal(true)
  }

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingStaff) return
    try {
      setSaving(true)
      const { error } = await supabase
        .from('users')
        .update({
          full_name: editForm.full_name,
          phone: editForm.phone.replace(/[^0-9]/g, ''),
          role: editForm.role,
        })
        .eq('id', editingStaff.id)
      if (error) throw error
      setStaff(staff.map(s => s.id === editingStaff.id ? { ...s, ...editForm } : s))
      toast.success('Staff member updated')
      setShowEditModal(false)
      setEditingStaff(null)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update staff'
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteStaff = async (id: string) => {
    if (!confirm('Are you sure you want to delete this staff member?')) return
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id)
      if (error) throw error
      setStaff(staff.filter(s => s.id !== id))
      toast.success('Staff member deleted')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete staff'
      toast.error(errorMessage)
    }
  }

  const getRoleBadge = (role: string) => {
    const roles: Record<string, { bg: string, text: string }> = {
      teacher: { bg: 'bg-[#e8f5e9]', text: 'text-[#006e1c]' },
      school_admin: { bg: 'bg-[#e3f2fd]', text: 'text-[#002045]' },
      dos: { bg: 'bg-[#fff3e0]', text: 'text-[#b86e00]' },
      bursar: { bg: 'bg-[#fce4ec]', text: 'text-[#c62828]' },
    }
    const style = roles[role] || roles.teacher
    return (
      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${style.bg} ${style.text}`}>
        {role === 'dos' ? 'Director of Studies' : role === 'school_admin' ? 'Administrator' : role.charAt(0).toUpperCase() + role.slice(1)}
      </span>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#002045]">Staff</h1>
          <p className="text-[#5c6670] mt-1">{staff.length} staff members</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
          <MaterialIcon icon="person_add" className="text-lg" />
          Add Staff
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#e8eaed] p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#f0f4f8] rounded-full" />
                <div className="flex-1">
                  <div className="w-32 h-4 bg-[#e8eaed] rounded mb-2" />
                  <div className="w-24 h-3 bg-[#e8eaed] rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : staff.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-12 text-center">
          <div className="w-16 h-16 bg-[#f8fafb] rounded-full flex items-center justify-center mx-auto mb-4">
            <MaterialIcon icon="groups" className="text-3xl text-[#5c6670]" />
          </div>
          <h3 className="text-lg font-semibold text-[#191c1d] mb-2">No staff members</h3>
          <p className="text-[#5c6670] mb-4">Add teachers and other staff</p>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
            <MaterialIcon icon="person_add" className="text-lg" />
            Add Staff
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map((member) => (
            <div key={member.id} className="bg-white rounded-2xl border border-[#e8eaed] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#f0f4f8] rounded-full flex items-center justify-center">
                    <span className="text-[#002045] font-semibold">
                      {member.full_name?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium text-[#191c1d]">{member.full_name}</div>
                    <div className="flex items-center gap-2 mt-2">
                      {getRoleBadge(member.role)}
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${member.is_active ? 'bg-[#e8f5e9] text-[#006e1c]' : 'bg-[#fef2f2] text-[#ba1a1a]'}`}>
                        {member.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(member)}
                    className="btn btn-sm btn-ghost"
                  >
                    <MaterialIcon icon="edit" className="text-sm" />
                    Edit
                  </button>
                  <button
                    onClick={() => toggleStatus(member.id, member.is_active)}
                    className={`btn btn-sm ${member.is_active ? 'btn-secondary' : 'btn-primary'}`}
                  >
                    {member.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDeleteStaff(member.id)}
                    className="btn btn-sm btn-ghost text-red-600"
                  >
                    <MaterialIcon icon="delete" className="text-sm" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-[#e8eaed]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#191c1d]">Add Staff Member</h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 text-[#5c6670] hover:text-[#191c1d]">
                  <MaterialIcon icon="close" className="text-xl" />
                </button>
              </div>
            </div>
            <form onSubmit={handleAddStaff} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Full Name</label>
                <input
                  type="text"
                  value={newStaff.full_name}
                  onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Phone Number</label>
                <input
                  type="tel"
                  placeholder="0700000000"
                  value={newStaff.phone}
                  onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Role</label>
                <select
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                  className="input"
                >
                  <option value="teacher">Teacher</option>
                  <option value="school_admin">Administrator</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Password</label>
                <input
                  type="password"
                  placeholder="Min 6 characters"
                  value={newStaff.password}
                  onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                  className="input"
                  required
                  minLength={6}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary flex-1">
                  {saving ? 'Adding...' : 'Add Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editingStaff && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-[#e8eaed]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#191c1d]">Edit Staff Member</h2>
                <button onClick={() => setShowEditModal(false)} className="p-2 text-[#5c6670] hover:text-[#191c1d]">
                  <MaterialIcon icon="close" className="text-xl" />
                </button>
              </div>
            </div>
            <form onSubmit={handleUpdateStaff} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Full Name</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Phone Number</label>
                <input
                  type="tel"
                  placeholder="0700000000"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="input"
                >
                  <option value="teacher">Teacher</option>
                  <option value="school_admin">Administrator</option>
                  <option value="dos">Director of Studies</option>
                  <option value="bursar">Bursar</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary flex-1">
                  {saving ? 'Updating...' : 'Update Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
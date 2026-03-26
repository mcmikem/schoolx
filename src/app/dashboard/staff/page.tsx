'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
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
  const [saving, setSaving] = useState(false)
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
      const email = `${normalizedPhone}@omuto.sms`
      
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: newStaff.password,
        email_confirm: true,
      })

      if (authError) throw authError

      const { error: userError } = await supabase.from('users').insert({
        auth_id: authData.user.id,
        school_id: school.id,
        full_name: newStaff.full_name,
        phone: normalizedPhone,
        role: newStaff.role,
        is_active: true,
      })

      if (userError) throw userError

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
                <button
                  onClick={() => toggleStatus(member.id, member.is_active)}
                  className={`btn btn-sm ${member.is_active ? 'btn-secondary' : 'btn-primary'}`}
                >
                  {member.is_active ? 'Deactivate' : 'Activate'}
                </button>
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
    </div>
  )
}
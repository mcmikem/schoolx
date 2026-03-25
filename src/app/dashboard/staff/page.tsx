'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

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

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
          <p className="text-gray-500 mt-1">{staff.length} staff members</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Staff
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card">
              <div className="flex items-center gap-4">
                <div className="skeleton w-12 h-12 rounded-full" />
                <div className="flex-1">
                  <div className="skeleton w-32 h-4 mb-2" />
                  <div className="skeleton w-24 h-3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : staff.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No staff members</h3>
          <p className="text-gray-500 mb-4">Add teachers and other staff</p>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
            Add Staff
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map((member) => (
            <div key={member.id} className="card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold">
                      {member.full_name?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{member.full_name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="badge badge-info">{member.role}</span>
                      <span className={`badge ${member.is_active ? 'badge-success' : 'badge-danger'}`}>
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

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Add Staff Member</h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <form onSubmit={handleAddStaff} className="p-6 space-y-4">
              <div>
                <label className="label">Full Name</label>
                <input
                  type="text"
                  value={newStaff.full_name}
                  onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">Phone Number</label>
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
                <label className="label">Role</label>
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
                <label className="label">Password</label>
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

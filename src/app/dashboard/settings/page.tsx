'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

export default function SettingsPage() {
  const { school, user } = useAuth()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState('general')
  const [saving, setSaving] = useState(false)
  const [users, setUsers] = useState<Array<{id: string, full_name: string, phone: string, role: string, is_active: boolean}>>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUser, setNewUser] = useState({ full_name: '', phone: '', role: 'teacher', password: '' })
  const [schoolData, setSchoolData] = useState({
    name: school?.name || '',
    district: school?.district || '',
    subcounty: '',
    phone: '',
    email: '',
  })

  useEffect(() => {
    if (school) {
      setSchoolData(prev => ({
        ...prev,
        name: school.name || '',
        district: school.district || '',
      }))
    }
  }, [school])

  useEffect(() => {
    if (activeTab === 'users' && school?.id) {
      fetchUsers()
    }
  }, [activeTab, school?.id])

  const fetchUsers = async () => {
    if (!school?.id) return
    try {
      setLoadingUsers(true)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('school_id', school.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setUsers(data || [])
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoadingUsers(false)
    }
  }

  const saveSchoolSettings = async () => {
    if (!school?.id) return
    try {
      setSaving(true)
      const { error } = await supabase
        .from('schools')
        .update({
          name: schoolData.name,
          district: schoolData.district,
          phone: schoolData.phone || null,
          email: schoolData.email || null,
        })
        .eq('id', school.id)
      if (error) throw error
      toast.success('Settings saved')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const toggleUserStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: !currentStatus })
        .eq('id', id)
      if (error) throw error
      setUsers(users.map(u => u.id === id ? { ...u, is_active: !currentStatus } : u))
      toast.success(currentStatus ? 'User deactivated' : 'User activated')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school?.id) return
    try {
      const normalizedPhone = newUser.phone.replace(/[^0-9]/g, '')
      const email = `${normalizedPhone}@omuto.sms`
      
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: newUser.password,
        email_confirm: true,
      })
      if (authError) throw authError

      await supabase.from('users').insert({
        auth_id: authData.user.id,
        school_id: school.id,
        full_name: newUser.full_name,
        phone: normalizedPhone,
        role: newUser.role,
        is_active: true,
      })

      toast.success('User added')
      setShowAddUser(false)
      setNewUser({ full_name: '', phone: '', role: 'teacher', password: '' })
      fetchUsers()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add user')
    }
  }

  const tabs = [
    { key: 'general', label: 'School Details' },
    { key: 'users', label: 'Staff & Users' },
    { key: 'notifications', label: 'Notifications' },
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your school settings</p>
      </div>

      {/* Tabs */}
      <div className="tabs mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`tab ${activeTab === tab.key ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* School Details Tab */}
      {activeTab === 'general' && (
        <div className="card max-w-2xl">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">School Information</h2>
          <div className="space-y-4">
            <div>
              <label className="label">School Name</label>
              <input
                type="text"
                value={schoolData.name}
                onChange={(e) => setSchoolData({...schoolData, name: e.target.value})}
                className="input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">District</label>
                <input
                  type="text"
                  value={schoolData.district}
                  onChange={(e) => setSchoolData({...schoolData, district: e.target.value})}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Sub-county</label>
                <input
                  type="text"
                  value={schoolData.subcounty}
                  onChange={(e) => setSchoolData({...schoolData, subcounty: e.target.value})}
                  className="input"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Phone</label>
                <input
                  type="tel"
                  value={schoolData.phone}
                  onChange={(e) => setSchoolData({...schoolData, phone: e.target.value})}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  value={schoolData.email}
                  onChange={(e) => setSchoolData({...schoolData, email: e.target.value})}
                  className="input"
                />
              </div>
            </div>
            <div className="pt-4">
              <button onClick={saveSchoolSettings} disabled={saving} className="btn btn-primary">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button onClick={() => setShowAddUser(true)} className="btn btn-primary">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add User
            </button>
          </div>

          {loadingUsers ? (
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
          ) : (
            <div className="space-y-3">
              {users.map((u) => (
                <div key={u.id} className="card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 dark:text-blue-300 font-semibold">
                          {u.full_name?.charAt(0) || 'U'}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{u.full_name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="badge badge-info">{u.role}</span>
                          <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                            {u.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleUserStatus(u.id, u.is_active)}
                      className={`btn btn-sm ${u.is_active ? 'btn-secondary' : 'btn-primary'}`}
                    >
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="card max-w-2xl">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Notification Settings</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">SMS Notifications</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Send SMS to parents for fee reminders</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Attendance Alerts</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Notify when student is absent</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Fee Reminders</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Send automatic fee balance reminders</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUser && (
        <div className="modal-overlay" onClick={() => setShowAddUser(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Staff Member</h2>
                <button onClick={() => setShowAddUser(false)} className="p-2 text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              <div>
                <label className="label">Full Name</label>
                <input type="text" value={newUser.full_name} onChange={(e) => setNewUser({...newUser, full_name: e.target.value})} className="input" required />
              </div>
              <div>
                <label className="label">Phone Number</label>
                <input type="tel" placeholder="0700000000" value={newUser.phone} onChange={(e) => setNewUser({...newUser, phone: e.target.value})} className="input" required />
              </div>
              <div>
                <label className="label">Role</label>
                <select value={newUser.role} onChange={(e) => setNewUser({...newUser, role: e.target.value})} className="input">
                  <option value="teacher">Teacher</option>
                  <option value="school_admin">Administrator</option>
                  <option value="dos">Director of Studies</option>
                  <option value="bursar">Bursar</option>
                  <option value="secretary">Secretary</option>
                </select>
              </div>
              <div>
                <label className="label">Password</label>
                <input type="password" placeholder="Min 6 characters" value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} className="input" required minLength={6} />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddUser(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn btn-primary flex-1">Add User</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

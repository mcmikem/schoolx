'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import MaterialIcon from '@/components/MaterialIcon'

interface SchoolData {
  id: string
  name: string
  school_code: string
  district: string
  school_type: string
  ownership: string
  phone: string
  subscription_plan: string
  subscription_status: string
  created_at: string
}

export default function SchoolsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [schools, setSchools] = useState<SchoolData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newSchool, setNewSchool] = useState({
    name: '',
    school_code: '',
    district: '',
    school_type: 'primary',
    ownership: 'private',
    phone: ''
  })

  useEffect(() => {
    if (user?.role === 'super_admin') {
      fetchSchools()
    }
  }, [user?.role])

  const fetchSchools = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setSchools(data || [])
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = schools.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                       s.district?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchStatus = filterStatus === 'all' || s.subscription_status === filterStatus
    return matchSearch && matchStatus
  })

  // Per-term pricing matching landing page: Basic=100K, Premium=200K, Max=370K
  const PLAN_PRICES: Record<string, number> = {
    basic: 100_000,
    premium: 200_000,
    max: 370_000,
  }
  const totalRevenue = schools.reduce((sum, s) => {
    return sum + (PLAN_PRICES[s.subscription_plan] ?? 0)
  }, 0)
  const activeSchools = schools.filter((s) => s.subscription_status === 'active').length

  const handleAddSchool = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { error } = await supabase.from('schools').insert(newSchool)
      if (error) throw error
      toast.success('School added successfully')
      setShowAddModal(false)
      fetchSchools()
      setNewSchool({
        name: '',
        school_code: '',
        district: '',
        school_type: 'primary',
        ownership: 'private',
        phone: ''
      })
    } catch (err) {
      toast.error('Failed to add school')
    }
  }

  if (user?.role !== 'super_admin') {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[#002045] mb-2">Access Restricted</h3>
          <p className="text-[#5c6670]">Only super admins can manage schools.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#002045]">Schools</h1>
          <p className="text-[#5c6670] mt-1">Manage all registered schools</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
          <MaterialIcon icon="add" />
          Add School
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="card">
              <div className="skeleton h-6 w-3/4 mb-2"></div>
              <div className="skeleton h-4 w-1/2 mb-4"></div>
              <div className="skeleton h-8 w-full"></div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
              <div className="stat-value">{schools.length}</div>
              <div className="stat-label">Total Schools</div>
            </div>
            <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
              <div className="stat-value text-green-600">{activeSchools}</div>
              <div className="stat-label">Active</div>
            </div>
            <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
              <div className="stat-value">{schools.filter(s => s.subscription_plan === 'premium').length}</div>
              <div className="stat-label">Premium</div>
            </div>
            <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
              <div className="stat-value">UGX {(totalRevenue / 1000).toFixed(0)}K</div>
              <div className="stat-label">Term Revenue (active)</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <input
              type="text"
              placeholder="Search schools..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input flex-1"
            />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input sm:w-40">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((school) => (
              <div key={school.id} className="bg-white rounded-2xl border border-[#e8eaed] p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="font-semibold text-[#002045]">{school.name}</div>
                    <div className="text-sm text-[#5c6670]">{school.school_code} • {school.district}</div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    school.subscription_status === 'active' ? 'bg-[#e8f5e9] text-[#006e1c]' :
                    school.subscription_status === 'trial' ? 'bg-[#fff3e0] text-[#e65100]' : 'bg-[#ffebee] text-[#c62828]'
                  }`}>
                    {school.subscription_status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-[#5c6670] mb-3">
                  <span className="capitalize">{school.school_type}</span>
                  <span className="capitalize">{school.ownership}</span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#e3f2fd] text-[#1565c0]">{school.subscription_plan}</span>
                </div>
                {school.phone && (
                  <div className="text-sm text-[#5c6670]">📞 {school.phone}</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#002045]">Add New School</h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <form onSubmit={handleAddSchool} className="p-6 space-y-4">
              <div>
                <label className="label">School Name</label>
                <input 
                  type="text" 
                  value={newSchool.name} 
                  onChange={(e) => setNewSchool({...newSchool, name: e.target.value})} 
                  className="input" 
                  required 
                />
              </div>
              <div>
                <label className="label">School Code</label>
                <input 
                  type="text" 
                  value={newSchool.school_code} 
                  onChange={(e) => setNewSchool({...newSchool, school_code: e.target.value})} 
                  className="input" 
                  required 
                  placeholder="e.g., STMS001"
                />
              </div>
              <div>
                <label className="label">District</label>
                <input 
                  type="text" 
                  value={newSchool.district} 
                  onChange={(e) => setNewSchool({...newSchool, district: e.target.value})} 
                  className="input" 
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">School Type</label>
                  <select 
                    value={newSchool.school_type} 
                    onChange={(e) => setNewSchool({...newSchool, school_type: e.target.value})} 
                    className="input"
                  >
                    <option value="primary">Primary</option>
                    <option value="secondary">Secondary</option>
                    <option value="combined">Combined</option>
                  </select>
                </div>
                <div>
                  <label className="label">Ownership</label>
                  <select 
                    value={newSchool.ownership} 
                    onChange={(e) => setNewSchool({...newSchool, ownership: e.target.value})} 
                    className="input"
                  >
                    <option value="private">Private</option>
                    <option value="government">Government</option>
                    <option value="government_aided">Government Aided</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Phone</label>
                <input 
                  type="tel" 
                  value={newSchool.phone} 
                  onChange={(e) => setNewSchool({...newSchool, phone: e.target.value})} 
                  className="input" 
                  placeholder="0700000000"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn btn-primary flex-1">Add School</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

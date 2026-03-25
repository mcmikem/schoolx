'use client'
import { useState } from 'react'

const schools = [
  { id: 1, name: "St. Mary's Primary School", code: 'STMS001', district: 'Kampala', type: 'primary', ownership: 'private', students: 1247, teachers: 28, plan: 'Basic', status: 'active', phone: '0701234567', revenue: 50000 },
  { id: 2, name: 'Kampala Parents School', code: 'KPS002', district: 'Kampala', type: 'primary', ownership: 'private', students: 2100, teachers: 45, plan: 'Premium', status: 'active', phone: '0702345678', revenue: 150000 },
  { id: 3, name: 'Nabisunsa Girls School', code: 'NAB003', district: 'Kampala', type: 'secondary', ownership: 'government_aided', students: 1800, teachers: 52, plan: 'Premium', status: 'active', phone: '0703456789', revenue: 150000 },
  { id: 4, name: 'Lira Central Primary', code: 'LCP004', district: 'Lira', type: 'primary', ownership: 'government', students: 890, teachers: 18, plan: 'Free', status: 'trial', phone: '0704567890', revenue: 0 },
  { id: 5, name: 'Mbale Progressive Academy', code: 'MPA005', district: 'Mbale', type: 'combined', ownership: 'private', students: 650, teachers: 22, plan: 'Basic', status: 'expired', phone: '0705678901', revenue: 50000 },
]

export default function SchoolsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  const filtered = schools.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.district.toLowerCase().includes(searchTerm.toLowerCase())
    const matchStatus = filterStatus === 'all' || s.status === filterStatus
    return matchSearch && matchStatus
  })

  const totalRevenue = schools.reduce((sum, s) => sum + s.revenue, 0)
  const activeSchools = schools.filter((s) => s.status === 'active').length
  const totalStudents = schools.reduce((sum, s) => sum + s.students, 0)

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Schools</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage all registered schools</p>
        </div>
        <button className="btn btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add School
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-value">{schools.length}</div>
          <div className="stat-label">Total Schools</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-green-600 dark:text-green-400">{activeSchools}</div>
          <div className="stat-label">Active</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalStudents.toLocaleString()}</div>
          <div className="stat-label">Total Students</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">UGX {(totalRevenue / 1000).toFixed(0)}K</div>
          <div className="stat-label">Monthly Revenue</div>
        </div>
      </div>

      {/* Filters */}
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

      {/* Schools List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((school) => (
          <div key={school.id} className="card">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">{school.name}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{school.code} • {school.district}</div>
              </div>
              <span className={`badge ${
                school.status === 'active' ? 'badge-success' :
                school.status === 'trial' ? 'badge-warning' : 'badge-danger'
              }`}>
                {school.status}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">{school.students}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Students</div>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">{school.teachers}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Teachers</div>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">{school.plan}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Plan</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

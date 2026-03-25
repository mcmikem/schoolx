'use client'
import { useState } from 'react'
import { Search, Plus, Building2, Users, CreditCard, MapPin, Phone, CheckCircle, XCircle, Clock, ChevronRight, Activity, Zap, Star } from 'lucide-react'

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
    <div className="space-y-12 pb-24 animate-fade-in relative z-10">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
           <div className="flex items-center gap-3 mb-3">
             <div className="w-8 h-8 rounded-lg bg-primary-800 flex items-center justify-center shadow-lg shadow-primary-500/20">
               <Building2 className="w-4 h-4 text-white fill-white" />
             </div>
             <span className="text-[10px] font-black text-primary-800 uppercase tracking-[4px]">Super Admin Hub</span>
          </div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Institutional Clusters</h1>
          <p className="text-gray-400 font-bold mt-2 text-base max-w-lg">Monitor regional school performance, architectural clusters, and subscription deltas.</p>
        </div>
        <button className="h-16 px-10 bg-primary-800 text-white rounded-[24px] font-black text-xs uppercase tracking-[3px] flex items-center gap-4 hover:bg-black transition-all shadow-2xl shadow-primary-500/30 active:scale-95">
          <Plus className="w-6 h-6 border-2 border-white/20 rounded-lg" /> Integrate New School
        </button>
      </div>

      {/* Stats Matrix */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
        {[
          { label: 'Global Schools', value: schools.length, sub: `${activeSchools} Active Clusters`, icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Scholar Population', value: totalStudents.toLocaleString(), sub: 'Across all clusters', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Cluster Revenue', value: `UGX ${totalRevenue.toLocaleString()}`, sub: 'Monthly Recurring', icon: CreditCard, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Premium Nodes', value: schools.filter((s) => s.plan !== 'Free').length, sub: 'Active Subscriptions', icon: Zap, color: 'text-primary-800', bg: 'bg-primary-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white/70 backdrop-blur-xl rounded-[40px] border border-white/60 shadow-xl shadow-gray-200/20 p-8 flex items-start gap-6 group hover:scale-[1.02] transition-all duration-500">
            <div className={`w-14 h-14 ${stat.bg} rounded-2xl flex items-center justify-center shadow-sm group-hover:rotate-12 transition-all duration-500`}>
              <stat.icon className={`w-7 h-7 ${stat.color}`} />
            </div>
            <div>
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mb-1">{stat.label}</div>
              <div className={`text-2xl font-black ${stat.color} leading-none mb-1.5 tracking-tight`}>{stat.value}</div>
              <div className="text-[9px] font-bold text-gray-300 uppercase italic tracking-wider">{stat.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Matrix */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="relative flex-1 group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-300 group-focus-within:text-primary-800 transition-all" />
          <input 
            type="text" 
            placeholder="Search regional clusters by name or district sequence..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full h-18 bg-white/70 backdrop-blur-md border border-white/60 rounded-[28px] pl-16 pr-8 text-sm font-black text-gray-900 focus:ring-4 focus:ring-primary-100 outline-none transition-all shadow-xl shadow-gray-100/20" 
          />
        </div>
        <div className="relative">
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)} 
            className="h-18 px-10 bg-white/70 backdrop-blur-md border border-white/60 rounded-[28px] text-xs font-black text-gray-900 uppercase tracking-widest focus:ring-4 focus:ring-primary-100 outline-none appearance-none cursor-pointer pr-16 transition-all shadow-xl shadow-gray-100/20"
          >
            <option value="all">Every Status Protocol</option>
            <option value="active">Active Nodes</option>
            <option value="trial">Temporal Trial</option>
            <option value="expired">Expired Access</option>
          </select>
          <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 rotate-90" />
        </div>
      </div>

      {/* Cluster Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {filtered.map((school) => (
          <div key={school.id} className="bg-white/70 backdrop-blur-xl rounded-[48px] border border-white/60 shadow-2xl shadow-gray-200/20 p-10 group hover:scale-[1.01] transition-all duration-500 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-primary-50/20 rounded-full blur-3xl -mr-10 -mt-10" />
            
            <div className="flex items-start gap-6 mb-8 relative z-10">
              <div className="w-16 h-16 bg-white border border-gray-50 rounded-[24px] flex items-center justify-center shadow-xl shadow-gray-200/10 group-hover:rotate-6 transition-all duration-500">
                <Building2 className="w-8 h-8 text-primary-800" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-black text-gray-900 tracking-tight group-hover:text-primary-800 transition-smooth">{school.name}</h3>
                <div className="flex items-center gap-4 text-[10px] font-black text-gray-400 mt-2 uppercase tracking-[2px]">
                  <span className="bg-gray-50 px-3 py-1 rounded-lg">{school.code}</span>
                  <span className="w-1 h-1 rounded-full bg-gray-200" />
                  <span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-primary-200" /> {school.district} Portal</span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mb-8 relative z-10">
              {[
                { label: 'Scholars', value: school.students.toLocaleString(), icon: Users },
                { label: 'Personnel', value: school.teachers, icon: Users },
                { label: 'Access Plan', value: school.plan, icon: Star },
              ].map((m, i) => (
                <div key={i} className="bg-gray-50/50 backdrop-blur-sm rounded-[24px] p-5 text-center border border-white group-hover:bg-white transition-all duration-500 hover:shadow-lg">
                  <m.icon className="w-4 h-4 text-gray-300 mx-auto mb-2 group-hover:text-primary-800 transition-smooth" />
                  <div className="text-sm font-black text-gray-900 tracking-tight">{m.value}</div>
                  <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">{m.label}</div>
                </div>
              ))}
            </div>
            
            <div className="flex items-center justify-between pt-6 border-t border-gray-50/50 relative z-10">
              <div className="flex items-center gap-3">
                {school.status === 'active' && (
                  <span className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-[2px] border border-emerald-100/50">
                    <Activity className="w-3 h-3 animate-pulse" /> Active Node
                  </span>
                )}
                {school.status === 'trial' && (
                  <span className="flex items-center gap-2 bg-amber-50 text-amber-600 px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-[2px] border border-amber-100/50">
                    <Clock className="w-3 h-3" /> Trial Lifecycle
                  </span>
                )}
                {school.status === 'expired' && (
                  <span className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-[2px] border border-red-100/50">
                    <XCircle className="w-3 h-3" /> Access Suspended
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] font-black text-gray-300 uppercase tracking-widest italic group-hover:text-gray-900 transition-smooth">
                <Phone className="w-4 h-4 text-primary-200" /> {school.phone}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

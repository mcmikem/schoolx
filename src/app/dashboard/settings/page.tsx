'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { Building2, Palette, Users, Bell, BookOpen, Clock, Globe, Loader2, Check, X, Shield, Mail, Phone, MapPin, Sparkles, ChevronRight, Plus, Award, Megaphone, CreditCard, Activity, Zap, Star } from 'lucide-react'

const tabs = [
  { key: 'general', label: 'Institutional Details', icon: Building2 },
  { key: 'branding', label: 'Visual Identity', icon: Palette },
  { key: 'academic', label: 'Scholastic Setup', icon: BookOpen },
  { key: 'users', label: 'Authority & Team', icon: Shield },
  { key: 'notifications', label: 'Protocol Alerts', icon: Bell },
]

const languages = ['Luganda', 'Runyankole', 'Rukiga', 'Runyoro', 'Rutoro', 'Lusoga', 'Acholi', 'Luo', 'Ateso', 'Lugbara', 'Swahili', 'English']
const ugandaDistricts = ['Kampala', 'Wakiso', 'Mukono', 'Jinja', 'Mbale', 'Lira', 'Gulu', 'Mbarara', 'Fort Portal', 'Masaka', 'Entebbe', 'Soroti']

export default function SettingsPage() {
  const { school, user } = useAuth()
  const [activeTab, setActiveTab] = useState('general')
  const [saving, setSaving] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUser, setNewUser] = useState({ full_name: '', phone: '', role: 'teacher' })
  const [schoolData, setSchoolData] = useState({
    name: school?.name || '',
    school_code: school?.school_code || '',
    district: school?.district || '',
    subcounty: '',
    parish: '',
    village: '',
    phone: '',
    email: '',
    uneab_center_number: '',
    school_type: 'primary',
    ownership: 'private',
    primary_color: school?.primary_color || '#5D2FFB',
  })

  useEffect(() => {
    if (school) {
      setSchoolData(prev => ({
        ...prev,
        name: school.name || '',
        school_code: school.school_code || '',
        district: school.district || '',
        primary_color: school.primary_color || '#5D2FFB',
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
      console.error('Error fetching users:', err)
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
          primary_color: schoolData.primary_color,
        })
        .eq('id', school.id)

      if (error) throw error
    } catch (err: any) {
      console.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const addUser = async () => {
    if (!school?.id || !newUser.full_name || !newUser.phone) return
    try {
      setSaving(true)
      const { error } = await supabase
        .from('users')
        .insert({
          ...newUser,
          school_id: school.id,
          auth_id: null,
          is_active: true,
        })

      if (error) throw error
      setShowAddUser(false)
      setNewUser({ full_name: '', phone: '', role: 'teacher' })
      fetchUsers()
    } catch (err: any) {
      console.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: !currentStatus })
        .eq('id', userId)

      if (error) throw error
      fetchUsers()
    } catch (err: any) {
      console.error(err.message)
    }
  }

  return (
    <div className="space-y-12 pb-24 animate-fade-in relative z-10">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
           <div className="flex items-center gap-3 mb-3">
             <div className="w-8 h-8 rounded-lg bg-primary-800 flex items-center justify-center shadow-lg shadow-primary-500/20">
               <Shield className="w-4 h-4 text-white fill-white" />
             </div>
             <span className="text-[10px] font-black text-primary-800 uppercase tracking-[4px]">Institutional Core</span>
          </div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">System Configuration</h1>
          <p className="text-gray-400 font-bold mt-2 text-base max-w-lg">Architect institutional protocols, global preferences, and authority hierarchies.</p>
        </div>
        <div className="flex items-center gap-4">
           <div className="px-6 py-3 bg-white border border-gray-100 rounded-2xl flex items-center gap-3 shadow-xl shadow-gray-200/5">
              <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Global Cloud Sync Enabled</span>
           </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-12">
        {/* Extreme Glass Sidebar Tabs */}
        <div className="lg:w-80 flex-shrink-0">
          <div className="bg-white/40 backdrop-blur-md rounded-[48px] border border-white/60 shadow-2xl shadow-gray-200/10 p-6 sticky top-28">
            <nav className="space-y-3">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`w-full flex items-center justify-between px-8 py-5 rounded-[28px] text-xs font-black transition-all duration-500 group uppercase tracking-widest ${
                    activeTab === tab.key 
                      ? 'bg-primary-800 text-white shadow-2xl shadow-primary-500/30 translate-x-3' 
                      : 'text-gray-400 hover:bg-white hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-5">
                    <tab.icon className={`w-5 h-5 ${activeTab === tab.key ? 'text-white' : 'text-gray-300 group-hover:text-primary-800 font-black transition-smooth'}`} />
                    {tab.label}
                  </div>
                  {activeTab === tab.key && <ChevronRight className="w-4 h-4" />}
                </button>
              ))}
            </nav>
            
            <div className="mt-10 p-8 bg-gray-50/50 rounded-[32px] border border-gray-100/50 relative overflow-hidden group">
               <div className="absolute -top-6 -right-6 w-16 h-16 bg-primary-100/50 rounded-full blur-xl group-hover:scale-150 transition-all duration-1000" />
               <div className="flex items-center gap-3 text-primary-800 mb-4">
                  <Sparkles className="w-5 h-5 fill-primary-800" />
                  <span className="text-[10px] font-black uppercase tracking-[3px]">System Health</span>
               </div>
               <p className="text-[10px] font-bold text-gray-400 leading-relaxed uppercase tracking-wider italic">
                  Institutional data matrix synchronized with regional operational clusters.<br />
                  <span className="text-emerald-500 mt-2 block font-black">2 mins ago (UG Hub)</span>
               </p>
            </div>
          </div>
        </div>

        {/* Supreme Glass Content Area */}
        <div className="flex-1 min-w-0">
          <div className="bg-white/70 backdrop-blur-xl rounded-[64px] border border-white/60 shadow-2xl shadow-gray-200/20 overflow-hidden min-h-[700px]">
            {activeTab === 'general' && (
              <div className="p-12 md:p-16 space-y-12">
                <div className="border-b border-gray-50 pb-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                  <div>
                    <h2 className="text-3xl font-black text-gray-900 leading-tight tracking-tight">Institutional Signature</h2>
                    <p className="text-gray-400 font-bold text-sm mt-2 uppercase tracking-widest leading-none italic">Legal Identity & Spatial Mapping</p>
                  </div>
                  <button onClick={saveSchoolSettings} disabled={saving} className="h-16 px-10 bg-primary-800 text-white rounded-[24px] font-black text-xs uppercase tracking-[3px] flex items-center gap-4 hover:bg-black transition-all shadow-2xl shadow-primary-500/30 disabled:bg-gray-100 disabled:text-gray-300 active:scale-95">
                    {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Check className="w-6 h-6" />}
                    {saving ? 'Syncing...' : 'Commit Baseline'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-3 group">
                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-[2px] pl-4">Legal Institution Name</label>
                    <input
                      type="text"
                      value={schoolData.name}
                      onChange={(e) => setSchoolData({ ...schoolData, name: e.target.value })}
                      className="w-full h-16 bg-white border border-gray-100 rounded-[24px] px-8 text-sm font-black text-gray-900 focus:ring-4 focus:ring-primary-100 outline-none transition-all shadow-sm"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-[2px] pl-4">Institutional Identifier</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={schoolData.school_code}
                        disabled
                        className="w-full h-16 bg-gray-50 border-none rounded-[24px] px-8 text-sm font-black text-gray-400 cursor-not-allowed"
                      />
                      <Shield className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-200" />
                    </div>
                  </div>
                  <div className="space-y-3 group">
                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-[2px] pl-4 flex items-center gap-2"><MapPin className="w-4 h-4 text-primary-200" /> Administrative District</label>
                    <div className="relative">
                      <select
                        value={schoolData.district}
                        onChange={(e) => setSchoolData({ ...schoolData, district: e.target.value })}
                        className="w-full h-16 bg-white border border-gray-100 rounded-[24px] px-8 text-sm font-black text-gray-900 focus:ring-4 focus:ring-primary-100 outline-none appearance-none cursor-pointer transition-all shadow-sm"
                      >
                        <option value="">Select operational district</option>
                        {ugandaDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 rotate-90" />
                    </div>
                  </div>
                  <div className="space-y-3 group">
                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-[2px] pl-4">UNEB Center Protocol</label>
                    <input
                      type="text"
                      placeholder="e.g. U0001"
                      className="w-full h-16 bg-white border border-gray-100 rounded-[24px] px-8 text-sm font-black text-gray-900 focus:ring-4 focus:ring-primary-100 outline-none transition-all shadow-sm"
                    />
                  </div>
                  <div className="space-y-3 group">
                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-[2px] pl-4 flex items-center gap-2"><Phone className="w-4 h-4 text-primary-200" /> Administrative Contact</label>
                    <input
                      type="tel"
                      className="w-full h-16 bg-white border border-gray-100 rounded-[24px] px-8 text-sm font-black text-gray-900 focus:ring-4 focus:ring-primary-100 outline-none transition-all shadow-sm"
                    />
                  </div>
                  <div className="space-y-3 group">
                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-[2px] pl-4 flex items-center gap-2"><Mail className="w-4 h-4 text-primary-200" /> Institutional Email</label>
                    <input
                      type="email"
                      className="w-full h-16 bg-white border border-gray-100 rounded-[24px] px-8 text-sm font-black text-gray-900 focus:ring-4 focus:ring-primary-100 outline-none transition-all shadow-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'academic' && (
              <div className="p-12 md:p-16 space-y-12">
                 <div className="border-b border-gray-50 pb-10">
                    <h2 className="text-3xl font-black text-gray-900 leading-tight tracking-tight">Scholastic Calibration</h2>
                    <p className="text-gray-400 font-bold text-sm mt-2 uppercase tracking-widest leading-none italic">Temporal Cycles & Curriculum Architecture</p>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-gray-400 uppercase tracking-[2px] pl-4">Operational Academic Year</label>
                      <input type="text" defaultValue="2026" className="w-full h-16 bg-white border border-gray-100 rounded-[24px] px-8 text-sm font-black text-gray-700 focus:ring-4 focus:ring-primary-100 outline-none transition-all shadow-sm" />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-gray-400 uppercase tracking-[2px] pl-4">Active Term Protocol</label>
                      <div className="relative">
                        <select className="w-full h-16 bg-white border border-gray-100 rounded-[24px] px-8 text-sm font-black text-gray-700 focus:ring-4 focus:ring-primary-100 outline-none cursor-pointer appearance-none transition-all shadow-sm">
                          <option>Term 1 (Opening Matrix)</option>
                          <option>Term 2</option>
                          <option>Term 3</option>
                        </select>
                        <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 rotate-90" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-gray-400 uppercase tracking-[2px] pl-4">Achievement Mapping System</label>
                      <div className="relative">
                        <select className="w-full h-16 bg-white border border-gray-100 rounded-[24px] px-8 text-sm font-black text-gray-700 focus:ring-4 focus:ring-primary-100 outline-none cursor-pointer appearance-none transition-all shadow-sm">
                          <option>UNEB Standard (D1-F9 Matrix)</option>
                          <option>NCDC Competency-Based Model</option>
                          <option>Percentage Distribution Protocol</option>
                        </select>
                        <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 rotate-90" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-gray-400 uppercase tracking-[2px] pl-4 flex items-center gap-2"><Globe className="w-4 h-4 text-primary-200" /> Instruction Language</label>
                      <div className="relative">
                        <select className="w-full h-16 bg-white border border-gray-100 rounded-[24px] px-8 text-sm font-black text-gray-700 focus:ring-4 focus:ring-primary-100 outline-none cursor-pointer appearance-none transition-all shadow-sm">
                          {languages.map(l => <option key={l}>{l}</option>)}
                        </select>
                        <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 rotate-90" />
                      </div>
                    </div>
                 </div>
                 <button className="h-16 px-12 bg-black text-white rounded-[24px] font-black text-xs uppercase tracking-[3px] hover:bg-primary-800 transition-all shadow-2xl shadow-gray-900/20 active:scale-95">Apply Scholastic Framework</button>
              </div>
            )}

            {activeTab === 'branding' && (
              <div className="p-12 md:p-16 space-y-12">
                 <div className="border-b border-gray-50 pb-10">
                    <h2 className="text-3xl font-black text-gray-900 leading-tight tracking-tight">V3 Visual Identity</h2>
                    <p className="text-gray-400 font-bold text-sm mt-2 uppercase tracking-widest leading-none italic">Branding Aura & Output Aesthetic</p>
                 </div>

                 <div className="space-y-6">
                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-[2px] pl-4">Institutional Digital Seal (Logo)</label>
                    <div className="border-4 border-dashed border-gray-50 rounded-[48px] p-24 text-center hover:border-primary-100 hover:bg-primary-50/20 transition-all duration-500 cursor-pointer group relative overflow-hidden">
                       <div className="absolute inset-0 bg-gradient-to-tr from-primary-50/30 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-700" />
                       <div className="relative z-10">
                          <div className="w-24 h-24 bg-white border border-gray-50 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-xl group-hover:rotate-12 group-hover:scale-110 transition-all duration-500">
                             <Plus className="w-10 h-10 text-primary-200" />
                          </div>
                          <p className="text-lg font-black text-gray-900 tracking-tight">Integrate School Logo</p>
                          <p className="text-[10px] font-black text-gray-400 mt-2 uppercase tracking-[3px] italic">High-Fidelity SVG or transparent PNG (Max 4MB)</p>
                       </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-4">
                       <label className="text-[11px] font-black text-gray-400 uppercase tracking-[2px] pl-4">Institutional Primary Color</label>
                       <div className="flex items-center gap-6 bg-white border border-gray-100 rounded-[28px] p-4 shadow-sm group hover:border-primary-100 transition-all">
                          <input type="color" value={schoolData.primary_color} onChange={(e) => setSchoolData({...schoolData, primary_color: e.target.value})} className="w-16 h-16 rounded-[20px] border-4 border-white cursor-pointer shadow-xl" />
                          <div className="flex-1">
                             <input type="text" value={schoolData.primary_color} onChange={(e) => setSchoolData({...schoolData, primary_color: e.target.value})} className="bg-transparent border-none text-base font-black text-gray-900 outline-none w-full font-mono uppercase tracking-widest" />
                             <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">HEX CORE PROTOCOL</p>
                          </div>
                       </div>
                    </div>
                    <div className="space-y-4">
                       <label className="text-[11px] font-black text-gray-400 uppercase tracking-[2px] pl-4">Output Contrast Spectrum</label>
                       <div className="flex items-center gap-6 bg-white border border-gray-100 rounded-[28px] p-4 shadow-sm group hover:border-primary-100 transition-all">
                          <input type="color" defaultValue="#FFFFFF" className="w-16 h-16 rounded-[20px] border-4 border-white cursor-pointer shadow-xl" />
                          <div className="flex-1">
                             <input type="text" defaultValue="#FFFFFF" className="bg-transparent border-none text-base font-black text-gray-900 outline-none w-full font-mono uppercase tracking-widest" />
                             <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">CONTRAST ACCENT PROTOCOL</p>
                          </div>
                       </div>
                    </div>
                 </div>
                 <button onClick={saveSchoolSettings} className="h-16 px-12 bg-primary-800 text-white rounded-[24px] font-black text-xs uppercase tracking-[3px] hover:bg-black transition-all shadow-2xl shadow-primary-500/30 active:scale-95">Update Branding Essence</button>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="p-12 md:p-16 space-y-12">
                <div className="border-b border-gray-50 pb-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                  <div>
                    <h2 className="text-3xl font-black text-gray-900 leading-tight tracking-tight">Authority & Permissions</h2>
                    <p className="text-gray-400 font-bold text-sm mt-2 uppercase tracking-widest leading-none italic">Hierarchical Access Control Matrix</p>
                  </div>
                  <button onClick={() => setShowAddUser(true)} className="h-16 px-10 bg-primary-800 text-white rounded-[24px] font-black text-xs uppercase tracking-[3px] hover:bg-black transition-all shadow-2xl shadow-primary-500/30 flex items-center gap-4 active:scale-95">
                    <Plus className="w-6 h-6 border-2 border-white/20 rounded-lg" /> Onboard Team Member
                  </button>
                </div>

                <div className="bg-white rounded-[40px] border border-gray-50 shadow-2xl shadow-gray-200/5 overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr>
                        <th className="px-10 py-8 text-[11px] font-black text-gray-400 uppercase tracking-[3px]">Member Identity</th>
                        <th className="px-6 py-8 text-[11px] font-black text-gray-400 uppercase tracking-[3px] text-center">Operational Role</th>
                        <th className="px-6 py-8 text-[11px] font-black text-gray-400 uppercase tracking-[3px] text-center">Status</th>
                        <th className="px-10 py-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50/50">
                      {loadingUsers ? (
                        <tr><td colSpan={4} className="p-32 text-center"><Loader2 className="w-12 h-12 animate-spin text-primary-800 mx-auto mb-4" /><p className="text-[10px] font-black text-gray-300 uppercase tracking-[5px]">Synchronizing Team Roster...</p></td></tr>
                      ) : users.length === 0 ? (
                        <tr><td colSpan={4} className="p-32 text-center"><p className="text-base font-black text-gray-300 italic">No operational team identified in this cluster.</p></td></tr>
                      ) : (
                        users.map((u) => (
                          <tr key={u.id} className="group hover:bg-gray-50/50 transition-all duration-500">
                            <td className="px-10 py-6">
                               <div className="flex items-center gap-5">
                                  <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center border border-gray-100 shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                                     <Users className="w-6 h-6 text-primary-200 group-hover:text-primary-800 transition-smooth" />
                                  </div>
                                  <div>
                                     <div className="font-black text-gray-900 text-base leading-tight group-hover:text-primary-800 transition-smooth">{u.full_name}</div>
                                     <div className="text-[10px] font-black text-gray-400 mt-1 uppercase tracking-widest font-mono">{u.phone}</div>
                                  </div>
                               </div>
                            </td>
                            <td className="px-6 py-6 text-center">
                               <span className="text-[9px] font-black bg-primary-800/5 border border-primary-100 text-primary-800 px-4 py-2 rounded-xl uppercase tracking-[2px] shadow-sm group-hover:bg-primary-800 group-hover:text-white transition-all duration-500">
                                  {u.role?.replace('_', ' ')}
                               </span>
                            </td>
                            <td className="px-6 py-6 text-center">
                               <div className={`w-3 h-3 rounded-full mx-auto shadow-2xl transition-all duration-500 group-hover:scale-125 ${u.is_active ? 'bg-emerald-500 shadow-emerald-500/30' : 'bg-red-400 shadow-red-500/30'}`} />
                            </td>
                            <td className="px-10 py-6 text-right">
                               <button 
                                 onClick={() => toggleUserStatus(u.id, u.is_active)}
                                 className="w-12 h-12 rounded-2xl text-gray-200 hover:text-red-500 hover:bg-red-50 transition-all active:scale-95 flex items-center justify-center border border-transparent hover:border-red-100 mx-auto lg:ml-auto lg:mr-0"
                               >
                                  <X className="w-6 h-6" />
                               </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="p-12 md:p-16 space-y-12">
                 <div className="border-b border-gray-50 pb-10">
                    <h2 className="text-3xl font-black text-gray-900 leading-tight tracking-tight">Alert Architecture</h2>
                    <p className="text-gray-400 font-bold text-sm mt-2 uppercase tracking-widest leading-none italic">Omni-Channel Communication Protocols</p>
                 </div>

                 <div className="grid grid-cols-1 gap-6">
                    {[
                      { label: 'Cloud Fee Reconciliations', desc: 'Auto-SMS parent cohorts on all successful payment deltas', icon: CreditCard, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                      { label: 'Attendance Deviations', desc: 'Instant alert when scholar bypasses morning roll-call', icon: Clock, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                      { label: 'Scholastic Result Dissemination', desc: 'Global broadcast of achievement deltas on protocol termination', icon: Award, color: 'text-amber-600', bg: 'bg-amber-50' },
                      { label: 'Administrative Hub Broadcasts', desc: 'General institutional newsletters and operational closure notices', icon: Megaphone, color: 'text-primary-800', bg: 'bg-primary-50' },
                    ].map((item, i) => (
                      <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-8 bg-white hover:bg-gray-50/50 rounded-[48px] border border-gray-100 group transition-all duration-500 hover:shadow-2xl">
                        <div className="flex items-center gap-8">
                           <div className={`w-16 h-16 ${item.bg} rounded-[28px] flex items-center justify-center shadow-xl shadow-gray-200/10 group-hover:rotate-12 transition-all duration-500`}>
                              <item.icon className={`w-8 h-8 ${item.color}`} />
                           </div>
                           <div>
                              <div className="font-black text-gray-900 text-lg leading-tight tracking-tight group-hover:text-primary-800 transition-smooth">{item.label}</div>
                              <div className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mt-1.5 leading-relaxed">{item.desc}</div>
                           </div>
                        </div>
                        <div className="mt-8 sm:mt-0">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" defaultChecked className="sr-only peer" />
                            <div className="w-16 h-10 bg-gray-100 rounded-full peer peer-checked:bg-primary-800 after:content-[''] after:absolute after:top-[6px] after:left-[6px] after:bg-white after:rounded-full after:h-7 after:w-7 after:transition-all peer-checked:after:translate-x-6 shadow-xl" />
                          </label>
                        </div>
                      </div>
                    ))}
                 </div>
                 <button className="h-16 px-12 bg-primary-800 text-white rounded-[24px] font-black text-xs uppercase tracking-[3px] hover:bg-black transition-all shadow-2xl shadow-primary-500/30 active:scale-95">Commit Interaction Policy</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Extreme Glass Team Member Modal */}
      {showAddUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-10">
           <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-xl animate-in fade-in duration-500" onClick={() => setShowAddUser(false)} />
           <div className="relative bg-white/90 backdrop-blur-md w-full max-w-lg rounded-[64px] shadow-2xl border border-white/40 overflow-hidden animate-in zoom-in slide-in-from-bottom-20 duration-500" onClick={(e) => e.stopPropagation()}>
              <div className="p-12 md:p-16 space-y-12">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                     <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                     <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[4px]">Operational Onboarding</span>
                  </div>
                  <h2 className="text-4xl font-black text-gray-900 tracking-tight">Onboard Member</h2>
                  <p className="text-gray-400 font-bold text-base mt-2">Configure institutional authority and access credentials.</p>
                </div>

                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-[2px] pl-4">Full Legal Identity</label>
                    <input type="text" value={newUser.full_name} onChange={(e) => setNewUser({...newUser, full_name: e.target.value})} className="w-full h-16 bg-white border border-gray-100 rounded-[24px] px-8 text-sm font-black text-gray-700 focus:ring-4 focus:ring-primary-100 outline-none transition-all shadow-sm" placeholder="e.g. John Okello" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-[2px] pl-4">Mobile Authority Number</label>
                    <input type="tel" value={newUser.phone} onChange={(e) => setNewUser({...newUser, phone: e.target.value})} className="w-full h-16 bg-white border border-gray-100 rounded-[24px] px-8 text-sm font-black text-gray-700 focus:ring-4 focus:ring-primary-100 outline-none transition-all shadow-sm" placeholder="+256..." />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-[2px] pl-4">Functional Role Protocol</label>
                    <div className="relative">
                       <select value={newUser.role} onChange={(e) => setNewUser({...newUser, role: e.target.value})} className="w-full h-16 bg-white border border-gray-100 rounded-[24px] px-8 text-sm font-black text-gray-700 focus:ring-4 focus:ring-primary-100 outline-none appearance-none cursor-pointer transition-all shadow-sm">
                        <option value="teacher">Class Instructor</option>
                        <option value="school_admin">System Administrator</option>
                        <option value="bursar">Financial Bursar</option>
                      </select>
                      <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 rotate-90" />
                    </div>
                  </div>
                </div>

                <div className="flex gap-6 pt-6">
                   <button onClick={() => setShowAddUser(false)} className="flex-1 h-16 rounded-[24px] text-xs font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-smooth">Abort Protocol</button>
                   <button onClick={addUser} className="flex-[2] h-16 bg-primary-800 text-white rounded-[24px] font-black text-xs uppercase tracking-[3px] flex items-center justify-center gap-4 hover:bg-black transition-all shadow-2xl shadow-primary-500/30 active:scale-95">
                      <Star className="w-5 h-5" /> Enable Access
                   </button>
                </div>
              </div>
           </div>
        </div>
      )}
    </div>
  )
}

'use client'
import { useState, useEffect, useCallback } from 'react'
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
  student_count?: number
  user_count?: number
  created_at: string
  logo_url?: string
  trial_ends_at?: string
  subscription_ends_at?: string
  primary_color?: string
  school_motto?: string
  onboarding_complete?: boolean
  custom_features?: string[]
  notes?: string
}

interface SchoolUser {
  id: string
  full_name: string
  phone: string
  email?: string
  role: string
  is_active: boolean
  created_at: string
}

interface SupportTicket {
  id: string
  school_id: string
  type: 'bug' | 'feature_request' | 'custom_package' | 'onboarding' | 'other'
  title: string
  description: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  created_at: string
  resolved_at?: string
}

const PLANS: Record<string, { monthly: number; annual: number; perStudent: number; label: string; color: string }> = {
  starter: { monthly: 350_000, annual: 3_800_000, perStudent: 50_000, label: 'Starter', color: '#3b82f6' },
  standard: { monthly: 550_000, annual: 6_000_000, perStudent: 65_000, label: 'Standard', color: '#8b5cf6' },
  premium: { monthly: 850_000, annual: 9_500_000, perStudent: 80_000, label: 'Premium', color: '#f59e0b' },
}

const ALL_MODULES = [
  { key: 'students', label: 'Students', icon: 'group' },
  { key: 'attendance', label: 'Attendance', icon: 'how_to_reg' },
  { key: 'grades', label: 'Grades & Reports', icon: 'menu_book' },
  { key: 'exams', label: 'Exams', icon: 'fact_check' },
  { key: 'fees', label: 'Fee Collection', icon: 'payments' },
  { key: 'budget', label: 'Budget', icon: 'account_balance_wallet' },
  { key: 'payroll', label: 'Payroll', icon: 'payments' },
  { key: 'staff', label: 'Staff', icon: 'person' },
  { key: 'timetable', label: 'Timetable', icon: 'calendar_month' },
  { key: 'sms', label: 'Bulk SMS', icon: 'sms' },
  { key: 'notices', label: 'Announcements', icon: 'campaign' },
  { key: 'library', label: 'Library', icon: 'local_library' },
  { key: 'transport', label: 'Transport', icon: 'directions_bus' },
  { key: 'dorm', label: 'Dormitory', icon: 'bed' },
  { key: 'health', label: 'Health', icon: 'local_hospital' },
  { key: 'inventory', label: 'Inventory', icon: 'inventory_2' },
  { key: 'parent_portal', label: 'Parent Portal', icon: 'family_restroom' },
  { key: 'analytics', label: 'Analytics', icon: 'analytics' },
  { key: 'uneb', label: 'UNEB', icon: 'verified' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar_today' },
]

const ONBOARDING_STEPS = [
  { key: 'school_info', label: 'School info entered', icon: 'school' },
  { key: 'logo_uploaded', label: 'Logo uploaded', icon: 'image' },
  { key: 'classes_created', label: 'Classes created', icon: 'class' },
  { key: 'subjects_added', label: 'Subjects added', icon: 'menu_book' },
  { key: 'staff_added', label: 'Staff accounts created', icon: 'person' },
  { key: 'students_imported', label: 'Students imported', icon: 'group' },
  { key: 'fees_configured', label: 'Fee structure set', icon: 'payments' },
  { key: 'sms_configured', label: 'SMS configured', icon: 'sms' },
  { key: 'timetable_set', label: 'Timetable created', icon: 'calendar_month' },
  { key: 'parent_invites', label: 'Parent invites sent', icon: 'mail' },
]

export default function SchoolsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [schools, setSchools] = useState<SchoolData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPlan, setFilterPlan] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedSchool, setSelectedSchool] = useState<SchoolData | null>(null)
  const [showSchoolDetail, setShowSchoolDetail] = useState(false)
  const [schoolUsers, setSchoolUsers] = useState<SchoolUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [showSubModal, setShowSubModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [showTrialModal, setShowTrialModal] = useState(false)
  const [showSuspendModal, setShowSuspendModal] = useState(false)
  const [showCustomizeModal, setShowCustomizeModal] = useState(false)
  const [showOnboardingModal, setShowOnboardingModal] = useState(false)
  const [showTicketModal, setShowTicketModal] = useState(false)
  const [showFeaturesModal, setShowFeaturesModal] = useState(false)
  const [subForm, setSubForm] = useState({ plan: 'starter', status: 'active', billing: 'annual' })
  const [customizeForm, setCustomizeForm] = useState({ primary_color: '#002045', school_motto: '', accent_color: '#3b82f6' })
  const [onboardingSteps, setOnboardingSteps] = useState<Record<string, boolean>>({})
  const [ticketForm, setTicketForm] = useState({ type: 'bug' as SupportTicket['type'], title: '', description: '', priority: 'medium' as SupportTicket['priority'] })
  const [enabledModules, setEnabledModules] = useState<string[]>([])
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([])
  const [resetPhone, setResetPhone] = useState('')
  const [trialDays, setTrialDays] = useState(14)
  const [stats, setStats] = useState({ totalSchools: 0, active: 0, trial: 0, expired: 0, totalStudents: 0, revenue: 0 })
  const [newSchool, setNewSchool] = useState({
    name: '', school_code: '', district: '', school_type: 'primary',
    ownership: 'private', phone: '', subscription_plan: 'starter',
  })

  useEffect(() => {
    if (user?.role === 'super_admin') fetchSchools()
  }, [user?.role])

  const fetchSchools = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.from('schools').select('*').order('created_at', { ascending: false })
      if (error) throw error

      const schoolsWithCounts = await Promise.all(
        (data || []).map(async (school) => {
          const [{ count: studentCount }, { count: userCount }] = await Promise.all([
            supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', school.id),
            supabase.from('users').select('id', { count: 'exact', head: true }).eq('school_id', school.id),
          ])
          return { ...school, student_count: studentCount || 0, user_count: userCount || 0 }
        })
      )

      setSchools(schoolsWithCounts as any)
      const totalStudents = schoolsWithCounts.reduce((sum, s) => sum + (s.student_count || 0), 0)
      const totalRevenue = schoolsWithCounts.reduce((sum, s) => {
        const plan = PLANS[s.subscription_plan]
        return sum + (s.subscription_status === 'active' ? plan.annual : 0)
      }, 0)

      setStats({
        totalSchools: schoolsWithCounts.length,
        active: schoolsWithCounts.filter(s => s.subscription_status === 'active').length,
        trial: schoolsWithCounts.filter(s => s.subscription_status === 'trial').length,
        expired: schoolsWithCounts.filter(s => s.subscription_status === 'expired').length,
        totalStudents,
        revenue: totalRevenue,
      })
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchSchoolUsers = useCallback(async (schoolId: string) => {
    try {
      setLoadingUsers(true)
      const { data, error } = await supabase.from('users').select('id, full_name, phone, email, role, is_active, created_at').eq('school_id', schoolId).order('full_name')
      if (error) throw error
      setSchoolUsers(data || [])
    } catch (err) {
      console.error('Error fetching users:', err)
    } finally {
      setLoadingUsers(false)
    }
  }, [])

  const openSchoolDetail = async (school: SchoolData) => {
    setSelectedSchool(school)
    setShowSchoolDetail(true)
    await fetchSchoolUsers(school.id)
  }

  const handleAddSchool = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { error } = await supabase.from('schools').insert({
        ...newSchool,
        subscription_status: 'trial',
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      })
      if (error) throw error
      toast.success('School added successfully')
      setShowAddModal(false)
      fetchSchools()
      setNewSchool({ name: '', school_code: '', district: '', school_type: 'primary', ownership: 'private', phone: '', subscription_plan: 'starter' })
    } catch (err: any) {
      toast.error(err.message || 'Failed to add school')
    }
  }

  const handleUpdateSubscription = async () => {
    if (!selectedSchool) return
    try {
      const { error } = await supabase.from('schools').update({
        subscription_plan: subForm.plan,
        subscription_status: subForm.status,
        subscription_ends_at: new Date(Date.now() + (subForm.billing === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString(),
      }).eq('id', selectedSchool.id)
      if (error) throw error
      toast.success(`Subscription updated to ${PLANS[subForm.plan].label}`)
      setShowSubModal(false)
      fetchSchools()
    } catch (err: any) {
      toast.error(err.message || 'Failed to update subscription')
    }
  }

  const handleResetPassword = async () => {
    if (!selectedSchool || !resetPhone) return
    try {
      const targetUser = schoolUsers.find(u => u.phone === resetPhone)
      if (!targetUser) { toast.error('User not found'); return }
      const { error } = await supabase.from('users').update({ password_reset_required: true }).eq('id', targetUser.id)
      if (error) throw error
      toast.success(`Password reset flag set for ${targetUser.full_name}`)
      setShowResetModal(false)
      setResetPhone('')
    } catch (err: any) {
      toast.error(err.message || 'Failed')
    }
  }

  const handleExtendTrial = async () => {
    if (!selectedSchool) return
    try {
      const trialEnds = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString()
      const { error } = await supabase.from('schools').update({ subscription_status: 'trial', trial_ends_at: trialEnds }).eq('id', selectedSchool.id)
      if (error) throw error
      toast.success(`Trial extended by ${trialDays} days`)
      setShowTrialModal(false)
      fetchSchools()
    } catch (err: any) {
      toast.error(err.message || 'Failed to extend trial')
    }
  }

  const handleSuspendSchool = async () => {
    if (!selectedSchool) return
    try {
      const newStatus = selectedSchool.subscription_status === 'suspended' ? 'active' : 'suspended'
      const { error } = await supabase.from('schools').update({ subscription_status: newStatus }).eq('id', selectedSchool.id)
      if (error) throw error
      toast.success(`School ${newStatus === 'suspended' ? 'suspended' : 'reactivated'}`)
      setShowSuspendModal(false)
      fetchSchools()
    } catch (err: any) {
      toast.error(err.message || 'Failed')
    }
  }

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.from('users').update({ is_active: !currentStatus }).eq('id', userId)
      if (error) throw error
      toast.success(`User ${currentStatus ? 'deactivated' : 'activated'}`)
      if (selectedSchool) await fetchSchoolUsers(selectedSchool.id)
    } catch (err: any) {
      toast.error(err.message || 'Failed')
    }
  }

  const openCustomizeModal = async (school: SchoolData) => {
    setSelectedSchool(school)
    setCustomizeForm({
      primary_color: school.primary_color || '#002045',
      school_motto: school.school_motto || '',
      accent_color: '#3b82f6',
    })
    setShowCustomizeModal(true)
  }

  const handleCustomize = async () => {
    if (!selectedSchool) return
    try {
      const { error } = await supabase.from('schools').update({
        primary_color: customizeForm.primary_color,
        school_motto: customizeForm.school_motto,
      }).eq('id', selectedSchool.id)
      if (error) throw error
      toast.success('School customization saved')
      setShowCustomizeModal(false)
      fetchSchools()
    } catch (err: any) {
      toast.error(err.message || 'Failed')
    }
  }

  const openOnboardingModal = async (school: SchoolData) => {
    setSelectedSchool(school)
    const steps: Record<string, boolean> = {}
    ONBOARDING_STEPS.forEach(s => { steps[s.key] = false })
    setOnboardingSteps(steps)

    try {
      const { count: classCount } = await supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', school.id)
      if ((classCount || 0) > 0) steps.classes_created = true

      const { count: subjectCount } = await supabase.from('subjects').select('id', { count: 'exact', head: true }).eq('school_id', school.id)
      if ((subjectCount || 0) > 0) steps.subjects_added = true

      const { count: staffCount } = await supabase.from('users').select('id', { count: 'exact', head: true }).eq('school_id', school.id)
      if ((staffCount || 0) > 0) steps.staff_added = true

      if (school.student_count && school.student_count > 0) steps.students_imported = true
      if (school.logo_url) steps.logo_uploaded = true
      if (school.name) steps.school_info = true
    } catch { /* ignore */ }

    setShowOnboardingModal(true)
  }

  const handleOnboardingComplete = async () => {
    if (!selectedSchool) return
    try {
      const { error } = await supabase.from('schools').update({ onboarding_complete: true }).eq('id', selectedSchool.id)
      if (error) throw error
      toast.success('Onboarding marked as complete')
      setShowOnboardingModal(false)
      fetchSchools()
    } catch (err: any) {
      toast.error(err.message || 'Failed')
    }
  }

  const openTicketModal = (school: SchoolData, type: SupportTicket['type'] = 'bug') => {
    setSelectedSchool(school)
    setTicketForm({ type, title: '', description: '', priority: 'medium' })
    setShowTicketModal(true)
  }

  const handleCreateTicket = async () => {
    if (!selectedSchool || !ticketForm.title) return
    try {
      const { error } = await supabase.from('support_tickets').insert({
        school_id: selectedSchool.id,
        type: ticketForm.type,
        title: ticketForm.title,
        description: ticketForm.description,
        priority: ticketForm.priority,
        status: 'open',
      })
      if (error) throw error
      toast.success('Ticket created')
      setShowTicketModal(false)
    } catch (err: any) {
      toast.error(err.message || 'Failed')
    }
  }

  const openFeaturesModal = async (school: SchoolData) => {
    setSelectedSchool(school)
    const custom = (school.custom_features as string[]) || []
    setEnabledModules(custom.length > 0 ? custom : ALL_MODULES.map(m => m.key))
    setShowFeaturesModal(true)
  }

  const handleSaveFeatures = async () => {
    if (!selectedSchool) return
    try {
      const { error } = await supabase.from('schools').update({ custom_features: enabledModules }).eq('id', selectedSchool.id)
      if (error) throw error
      toast.success('Module access updated')
      setShowFeaturesModal(false)
      fetchSchools()
    } catch (err: any) {
      toast.error(err.message || 'Failed')
    }
  }

  const filtered = schools.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.school_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.district?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchStatus = filterStatus === 'all' || s.subscription_status === filterStatus
    const matchPlan = filterPlan === 'all' || s.subscription_plan === filterPlan
    return matchSearch && matchStatus && matchPlan
  })

  const formatUGX = (amount: number) => {
    if (amount >= 1_000_000) return `UGX ${(amount / 1_000_000).toFixed(1)}M`
    if (amount >= 1_000) return `UGX ${(amount / 1_000).toFixed(0)}K`
    return `UGX ${amount.toLocaleString()}`
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Not set'
    return new Date(dateStr).toLocaleDateString('en-UG', { year: 'numeric', month: 'short', day: 'numeric' })
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
          <h1 className="text-2xl font-bold text-[#002045]">School Management</h1>
          <p className="text-[#5c6670] mt-1">Manage all registered schools and subscriptions</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
          <MaterialIcon icon="add" />
          Add School
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-4">
          <div className="text-2xl font-bold text-[#002045]">{stats.totalSchools}</div>
          <div className="text-xs text-[#5c6670]">Total Schools</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-4">
          <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          <div className="text-xs text-[#5c6670]">Active</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-4">
          <div className="text-2xl font-bold text-amber-600">{stats.trial}</div>
          <div className="text-xs text-[#5c6670]">On Trial</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-4">
          <div className="text-2xl font-bold text-red-600">{stats.expired}</div>
          <div className="text-xs text-[#5c6670]">Expired</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-4">
          <div className="text-2xl font-bold text-[#002045]">{stats.totalStudents.toLocaleString()}</div>
          <div className="text-xs text-[#5c6670]">Total Students</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-4">
          <div className="text-2xl font-bold text-green-700">{formatUGX(stats.revenue)}</div>
          <div className="text-xs text-[#5c6670]">Annual Revenue</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input type="text" placeholder="Search schools..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="input flex-1" />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input sm:w-40">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="expired">Expired</option>
          <option value="suspended">Suspended</option>
        </select>
        <select value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)} className="input sm:w-40">
          <option value="all">All Plans</option>
          <option value="starter">Starter</option>
          <option value="standard">Standard</option>
          <option value="premium">Premium</option>
        </select>
      </div>

      {/* School Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="card"><div className="skeleton h-6 w-3/4 mb-2"></div><div className="skeleton h-4 w-1/2 mb-4"></div><div className="skeleton h-8 w-full"></div></div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <MaterialIcon icon="school" className="text-4xl text-[#5c6670]" />
          <h3 className="text-lg font-semibold text-[#002045] mb-2">No schools found</h3>
          <p className="text-[#5c6670]">Try adjusting your filters or add a new school.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((school) => (
            <div key={school.id} className="bg-white rounded-2xl border border-[#e8eaed] p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => openSchoolDetail(school)}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[#002045] truncate">{school.name}</div>
                  <div className="text-sm text-[#5c6670]">{school.school_code} • {school.district}</div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ml-2 shrink-0 ${
                  school.subscription_status === 'active' ? 'bg-[#e8f5e9] text-[#006e1c]' :
                  school.subscription_status === 'trial' ? 'bg-[#fff3e0] text-[#e65100]' :
                  school.subscription_status === 'suspended' ? 'bg-gray-100 text-gray-600' : 'bg-[#ffebee] text-[#c62828]'
                }`}>
                  {school.subscription_status}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-[#5c6670] mb-3">
                <span className="capitalize">{school.school_type}</span>
                <span className="capitalize">{school.ownership}</span>
              </div>
              <div className="flex items-center justify-between text-sm mb-3">
                <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: `${PLANS[school.subscription_plan]?.color}15`, color: PLANS[school.subscription_plan]?.color }}>
                  {PLANS[school.subscription_plan]?.label || school.subscription_plan}
                </span>
                <span className="text-[#5c6670]">{school.student_count || 0} students</span>
              </div>
              {school.phone && <div className="text-sm text-[#5c6670]">📞 {school.phone}</div>}
              {school.trial_ends_at && school.subscription_status === 'trial' && (
                <div className="text-xs text-amber-600 mt-1">Trial ends: {formatDate(school.trial_ends_at)}</div>
              )}
              <div className="mt-3 pt-3 border-t border-[#e8eaed] flex gap-3">
                <button onClick={(e) => { e.stopPropagation(); openSchoolDetail(school) }} className="text-xs text-blue-600 hover:text-blue-800 font-medium">View Details</button>
                <span className="text-[#e8eaed]">|</span>
                <button onClick={(e) => { e.stopPropagation(); setSelectedSchool(school); setSubForm({ plan: school.subscription_plan === 'suspended' ? 'starter' : school.subscription_plan, status: school.subscription_status === 'suspended' ? 'active' : school.subscription_status, billing: 'annual' }); setShowSubModal(true) }} className="text-xs text-green-600 hover:text-green-800 font-medium">Manage Plan</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* School Detail Modal */}
      {showSchoolDetail && selectedSchool && (
        <div className="modal-overlay" onClick={() => setShowSchoolDetail(false)}>
          <div className="modal max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[#002045]">{selectedSchool.name}</h2>
                  <p className="text-sm text-[#5c6670]">{selectedSchool.school_code} • {selectedSchool.district}</p>
                </div>
                <button onClick={() => setShowSchoolDetail(false)} className="p-2 text-gray-400 hover:text-gray-600"><MaterialIcon icon="close" /></button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* School Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#f8f9fa] rounded-xl p-4">
                  <div className="text-sm text-[#5c6670] mb-1">Plan</div>
                  <div className="font-semibold text-[#002045]">{PLANS[selectedSchool.subscription_plan]?.label || selectedSchool.subscription_plan}</div>
                </div>
                <div className="bg-[#f8f9fa] rounded-xl p-4">
                  <div className="text-sm text-[#5c6670] mb-1">Status</div>
                  <div className="font-semibold capitalize">{selectedSchool.subscription_status}</div>
                </div>
                <div className="bg-[#f8f9fa] rounded-xl p-4">
                  <div className="text-sm text-[#5c6670] mb-1">Students</div>
                  <div className="font-semibold">{selectedSchool.student_count || 0}</div>
                </div>
                <div className="bg-[#f8f9fa] rounded-xl p-4">
                  <div className="text-sm text-[#5c6670] mb-1">Users</div>
                  <div className="font-semibold">{selectedSchool.user_count || 0}</div>
                </div>
                <div className="bg-[#f8f9fa] rounded-xl p-4">
                  <div className="text-sm text-[#5c6670] mb-1">Trial Ends</div>
                  <div className="font-semibold">{formatDate(selectedSchool.trial_ends_at)}</div>
                </div>
                <div className="bg-[#f8f9fa] rounded-xl p-4">
                  <div className="text-sm text-[#5c6670] mb-1">Sub Ends</div>
                  <div className="font-semibold">{formatDate(selectedSchool.subscription_ends_at)}</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => { setSubForm({ plan: selectedSchool.subscription_plan === 'suspended' ? 'starter' : selectedSchool.subscription_plan, status: selectedSchool.subscription_status === 'suspended' ? 'active' : selectedSchool.subscription_status, billing: 'annual' }); setShowSubModal(true) }} className="btn btn-primary text-sm">
                  <MaterialIcon icon="swap_horiz" /> Change Plan
                </button>
                <button onClick={() => setShowTrialModal(true)} className="btn btn-secondary text-sm">
                  <MaterialIcon icon="timer" /> Extend Trial
                </button>
                <button onClick={() => setShowResetModal(true)} className="btn btn-secondary text-sm">
                  <MaterialIcon icon="lock_reset" /> Reset Password
                </button>
                <button onClick={() => setShowSuspendModal(true)} className="text-sm px-4 py-2 rounded-xl border font-medium text-red-600 border-red-200 hover:bg-red-50">
                  <MaterialIcon icon="block" /> {selectedSchool.subscription_status === 'suspended' ? 'Reactivate' : 'Suspend'}
                </button>
              </div>

              {/* Admin Tools */}
              <div className="border-t border-[#e8eaed] pt-4">
                <h3 className="font-semibold text-[#002045] mb-3 text-sm uppercase tracking-wide">Admin Tools</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button onClick={() => openCustomizeModal(selectedSchool)} className="flex flex-col items-center gap-1 p-3 rounded-xl border border-[#e8eaed] hover:border-blue-300 hover:bg-blue-50 transition-all">
                    <MaterialIcon icon="palette" className="text-blue-600" />
                    <span className="text-xs font-medium">Customize</span>
                  </button>
                  <button onClick={() => openOnboardingModal(selectedSchool)} className="flex flex-col items-center gap-1 p-3 rounded-xl border border-[#e8eaed] hover:border-green-300 hover:bg-green-50 transition-all">
                    <MaterialIcon icon="rocket_launch" className="text-green-600" />
                    <span className="text-xs font-medium">Onboarding</span>
                  </button>
                  <button onClick={() => openFeaturesModal(selectedSchool)} className="flex flex-col items-center gap-1 p-3 rounded-xl border border-[#e8eaed] hover:border-purple-300 hover:bg-purple-50 transition-all">
                    <MaterialIcon icon="extension" className="text-purple-600" />
                    <span className="text-xs font-medium">Features</span>
                  </button>
                  <button onClick={() => openTicketModal(selectedSchool)} className="flex flex-col items-center gap-1 p-3 rounded-xl border border-[#e8eaed] hover:border-amber-300 hover:bg-amber-50 transition-all">
                    <MaterialIcon icon="bug_report" className="text-amber-600" />
                    <span className="text-xs font-medium">Support</span>
                  </button>
                </div>
              </div>

              {/* Users */}
              <div>
                <h3 className="font-semibold text-[#002045] mb-3">Users ({schoolUsers.length})</h3>
                {loadingUsers ? (
                  <div className="text-sm text-[#5c6670]">Loading users...</div>
                ) : schoolUsers.length === 0 ? (
                  <div className="text-sm text-[#5c6670]">No users found</div>
                ) : (
                  <div className="space-y-2">
                    {schoolUsers.map((u) => (
                      <div key={u.id} className="flex items-center justify-between p-3 bg-[#f8f9fa] rounded-xl">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-[#002045] truncate">{u.full_name}</div>
                          <div className="text-xs text-[#5c6670]">{u.phone} • {u.email || 'No email'}</div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            u.role === 'headmaster' ? 'bg-purple-100 text-purple-700' :
                            u.role === 'school_admin' ? 'bg-blue-100 text-blue-700' :
                            u.role === 'bursar' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>{u.role.replace('_', ' ')}</span>
                          <button onClick={() => handleToggleUserStatus(u.id, u.is_active)} className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                            {u.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add School Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#002045]">Add New School</h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 text-gray-400 hover:text-gray-600"><MaterialIcon icon="close" /></button>
              </div>
            </div>
            <form onSubmit={handleAddSchool} className="p-6 space-y-4">
              <div><label className="label">School Name</label><input type="text" value={newSchool.name} onChange={(e) => setNewSchool({...newSchool, name: e.target.value})} className="input" required /></div>
              <div><label className="label">School Code</label><input type="text" value={newSchool.school_code} onChange={(e) => setNewSchool({...newSchool, school_code: e.target.value})} className="input" required placeholder="e.g., STMS001" /></div>
              <div><label className="label">District</label><input type="text" value={newSchool.district} onChange={(e) => setNewSchool({...newSchool, district: e.target.value})} className="input" required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">School Type</label><select value={newSchool.school_type} onChange={(e) => setNewSchool({...newSchool, school_type: e.target.value})} className="input"><option value="primary">Primary</option><option value="secondary">Secondary</option><option value="combined">Combined</option></select></div>
                <div><label className="label">Ownership</label><select value={newSchool.ownership} onChange={(e) => setNewSchool({...newSchool, ownership: e.target.value})} className="input"><option value="private">Private</option><option value="government">Government</option><option value="government_aided">Government Aided</option></select></div>
              </div>
              <div><label className="label">Phone</label><input type="tel" value={newSchool.phone} onChange={(e) => setNewSchool({...newSchool, phone: e.target.value})} className="input" placeholder="0700000000" /></div>
              <div><label className="label">Starting Plan</label><select value={newSchool.subscription_plan} onChange={(e) => setNewSchool({...newSchool, subscription_plan: e.target.value})} className="input"><option value="starter">Starter (UGX 50K/student)</option><option value="standard">Standard (UGX 65K/student)</option><option value="premium">Premium (UGX 80K/student)</option></select></div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn btn-primary flex-1">Add School</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subscription Modal */}
      {showSubModal && selectedSchool && (
        <div className="modal-overlay" onClick={() => setShowSubModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#002045]">Manage Subscription - {selectedSchool.name}</h2>
                <button onClick={() => setShowSubModal(false)} className="p-2 text-gray-400 hover:text-gray-600"><MaterialIcon icon="close" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Plan</label>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(PLANS).map(([key, plan]) => (
                    <button key={key} type="button" onClick={() => setSubForm({...subForm, plan: key})} className={`p-4 rounded-xl border-2 text-center transition-all ${subForm.plan === key ? 'border-blue-500 bg-blue-50' : 'border-[#e8eaed] hover:border-gray-300'}`}>
                      <div className="font-semibold text-sm" style={{ color: plan.color }}>{plan.label}</div>
                      <div className="text-xs text-[#5c6670] mt-1">{formatUGX(plan.annual)}/yr</div>
                      <div className="text-xs text-[#5c6670]">{formatUGX(plan.perStudent)}/student</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Status</label>
                <select value={subForm.status} onChange={(e) => setSubForm({...subForm, status: e.target.value})} className="input">
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
              <div>
                <label className="label">Billing</label>
                <select value={subForm.billing} onChange={(e) => setSubForm({...subForm, billing: e.target.value})} className="input">
                  <option value="annual">Annual (save ~15%)</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="bg-[#f8f9fa] rounded-xl p-4">
                <div className="text-sm text-[#5c6670]">Plan: <span className="font-semibold">{PLANS[subForm.plan].label}</span></div>
                <div className="text-sm text-[#5c6670]">Price: <span className="font-semibold">{formatUGX(subForm.billing === 'annual' ? PLANS[subForm.plan].annual : PLANS[subForm.plan].monthly)}</span>/{subForm.billing === 'annual' ? 'year' : 'month'}</div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowSubModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button onClick={handleUpdateSubscription} className="btn btn-primary flex-1">Update</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && selectedSchool && (
        <div className="modal-overlay" onClick={() => setShowResetModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#002045]">Reset Password - {selectedSchool.name}</h2>
                <button onClick={() => setShowResetModal(false)} className="p-2 text-gray-400 hover:text-gray-600"><MaterialIcon icon="close" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-[#5c6670]">Select a user to flag for password reset. They will be prompted to change their password on next login.</p>
              <div>
                <label className="label">User Phone</label>
                <select value={resetPhone} onChange={(e) => setResetPhone(e.target.value)} className="input">
                  <option value="">Select user...</option>
                  {schoolUsers.map(u => <option key={u.id} value={u.phone}>{u.full_name} ({u.phone})</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowResetModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button onClick={handleResetPassword} className="btn btn-primary flex-1">Flag Reset</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Extend Trial Modal */}
      {showTrialModal && selectedSchool && (
        <div className="modal-overlay" onClick={() => setShowTrialModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#002045]">Extend Trial - {selectedSchool.name}</h2>
                <button onClick={() => setShowTrialModal(false)} className="p-2 text-gray-400 hover:text-gray-600"><MaterialIcon icon="close" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Extend by (days)</label>
                <input type="number" value={trialDays} onChange={(e) => setTrialDays(parseInt(e.target.value) || 14)} className="input" min={1} max={90} />
              </div>
              <div className="bg-[#f8f9fa] rounded-xl p-4">
                <div className="text-sm text-[#5c6670]">New trial end date:</div>
                <div className="font-semibold">{new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toLocaleDateString('en-UG', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowTrialModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button onClick={handleExtendTrial} className="btn btn-primary flex-1">Extend Trial</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Modal */}
      {showSuspendModal && selectedSchool && (
        <div className="modal-overlay" onClick={() => setShowSuspendModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#002045]">{selectedSchool.subscription_status === 'suspended' ? 'Reactivate' : 'Suspend'} School</h2>
                <button onClick={() => setShowSuspendModal(false)} className="p-2 text-gray-400 hover:text-gray-600"><MaterialIcon icon="close" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-[#5c6670]">
                {selectedSchool.subscription_status === 'suspended'
                  ? `Reactivate ${selectedSchool.name}? They will regain full access immediately.`
                  : `Suspend ${selectedSchool.name}? They will lose access to the dashboard. This is typically used for non-payment.`}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowSuspendModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button onClick={handleSuspendSchool} className={`btn flex-1 ${selectedSchool.subscription_status === 'suspended' ? 'btn-primary' : ''}`} style={selectedSchool.subscription_status !== 'suspended' ? { background: '#dc2626', color: '#fff' } : {}}>
                  {selectedSchool.subscription_status === 'suspended' ? 'Reactivate' : 'Suspend'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

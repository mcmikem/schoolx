'use client'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import HeadmasterDashboard from './dashboards/HeadmasterDashboard'
import DeanDashboard from './dashboards/DeanDashboard'
import BursarDashboard from './dashboards/BursarDashboard'
import TeacherDashboard from './dashboards/TeacherDashboard'
import { DashboardSkeleton } from '@/components/Skeletons'

function SecretaryDashboard() {
  const { user, school } = useAuth()
  const currentDate = new Date()
  const greeting = currentDate.getHours() < 12 ? 'Good Morning' : currentDate.getHours() < 17 ? 'Good Afternoon' : 'Good Evening'

  return (
    <div className="content">
      <div className="page-header">
        <div>
          <div className="ph-title truncate">{greeting}, {user?.full_name?.split(' ')[0]}</div>
          <div className="ph-sub truncate">{school?.name} • Office Dashboard</div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/dashboard/visitors" className="stat-card">
          <div className="stat-accent" style={{ background: 'var(--navy)' }} />
          <div className="stat-inner">
            <div className="stat-meta">
              <div className="stat-label">Visitors Log</div>
              <div className="stat-icon-box" style={{ background: 'var(--navy-soft)', color: 'var(--navy)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>badge</span>
              </div>
            </div>
            <div className="stat-val" style={{ color: 'var(--navy)' }}>Track Visitors</div>
            <div className="text-[11px] text-[var(--t3)] font-medium mt-1">Log and manage school visitors</div>
          </div>
        </Link>
        <Link href="/dashboard/messages" className="stat-card">
          <div className="stat-accent" style={{ background: 'var(--green)' }} />
          <div className="stat-inner">
            <div className="stat-meta">
              <div className="stat-label">Messages</div>
              <div className="stat-icon-box" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chat</span>
              </div>
            </div>
            <div className="stat-val" style={{ color: 'var(--green)' }}>Communication</div>
            <div className="text-[11px] text-[var(--t3)] font-medium mt-1">Manage messages and notices</div>
          </div>
        </Link>
      </div>
    </div>
  )
}

function DormMasterDashboard() {
  const { user, school } = useAuth()
  const currentDate = new Date()
  const greeting = currentDate.getHours() < 12 ? 'Good Morning' : currentDate.getHours() < 17 ? 'Good Afternoon' : 'Good Evening'

  return (
    <div className="content">
      <div className="page-header">
        <div>
          <div className="ph-title truncate">{greeting}, {user?.full_name?.split(' ')[0]}</div>
          <div className="ph-sub truncate">{school?.name} • Dormitory Dashboard</div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/dashboard/dorm" className="stat-card">
          <div className="stat-accent" style={{ background: 'var(--navy)' }} />
          <div className="stat-inner">
            <div className="stat-meta">
              <div className="stat-label">Dorm Management</div>
              <div className="stat-icon-box" style={{ background: 'var(--navy-soft)', color: 'var(--navy)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>bed</span>
              </div>
            </div>
            <div className="stat-val" style={{ color: 'var(--navy)' }}>Manage Rooms</div>
            <div className="text-[11px] text-[var(--t3)] font-medium mt-1">Dormitory assignments</div>
          </div>
        </Link>
        <Link href="/dashboard/dorm-attendance" className="stat-card">
          <div className="stat-accent" style={{ background: 'var(--green)' }} />
          <div className="stat-inner">
            <div className="stat-meta">
              <div className="stat-label">Dorm Attendance</div>
              <div className="stat-icon-box" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>nightlight</span>
              </div>
            </div>
            <div className="stat-val" style={{ color: 'var(--green)' }}>Night Check</div>
            <div className="text-[11px] text-[var(--t3)] font-medium mt-1">Track student presence</div>
          </div>
        </Link>
        <Link href="/dashboard/health" className="stat-card">
          <div className="stat-accent" style={{ background: 'var(--amber)' }} />
          <div className="stat-inner">
            <div className="stat-meta">
              <div className="stat-label">Health Records</div>
              <div className="stat-icon-box" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>medical_services</span>
              </div>
            </div>
            <div className="stat-val" style={{ color: 'var(--amber)' }}>Student Health</div>
            <div className="text-[11px] text-[var(--t3)] font-medium mt-1">Medical records and visits</div>
          </div>
        </Link>
      </div>
    </div>
  )
}

export default function DashboardRouter() {
  const { user, school, loading } = useAuth()

  if (loading) {
    return <DashboardSkeleton />
  }

  if (!user) {
    return null
  }

  // Super admin bypasses school check
  if (user.role === 'super_admin') {
    // Show super admin dashboard or redirect to schools
    return (
      <div className="content">
        <div className="page-header">
          <div>
            <div className="ph-title">Super Admin Dashboard</div>
            <div className="ph-sub">System Administration</div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/dashboard/schools" className="stat-card">
            <div className="stat-accent" style={{ background: 'var(--navy)' }} />
            <div className="stat-inner">
              <div className="stat-meta">
                <div className="stat-label">Manage Schools</div>
              </div>
              <div className="stat-val" style={{ color: 'var(--navy)' }}>Schools</div>
            </div>
          </Link>
          <Link href="/dashboard/users" className="stat-card">
            <div className="stat-accent" style={{ background: 'var(--green)' }} />
            <div className="stat-inner">
              <div className="stat-meta">
                <div className="stat-label">System Users</div>
              </div>
              <div className="stat-val" style={{ color: 'var(--green)' }}>Users</div>
            </div>
          </Link>
          <Link href="/dashboard/feedback" className="stat-card">
            <div className="stat-accent" style={{ background: 'var(--amber)' }} />
            <div className="stat-inner">
              <div className="stat-meta">
                <div className="stat-label">Support Tickets</div>
              </div>
              <div className="stat-val" style={{ color: 'var(--amber)' }}>Feedback</div>
            </div>
          </Link>
        </div>
      </div>
    )
  }

  // Centralized setup check: ensure school is initialized
  if (!school || !school.name || school.name === 'My School') {
    window.location.href = '/dashboard/setup-wizard'
    return null
  }

  const role = user.role as string

  switch (role) {
    case 'headmaster':
    case 'school_admin':
    case 'admin':
    case 'board':
      return <HeadmasterDashboard />
    case 'dean_of_studies':
      return <DeanDashboard />
    case 'bursar':
      return <BursarDashboard />
    case 'teacher':
      return <TeacherDashboard />
    case 'secretary':
      return <SecretaryDashboard />
    case 'dorm_master':
      return <DormMasterDashboard />
    default:
      console.warn('[DashboardRouter] Unknown role:', role, '- defaulting to HeadmasterDashboard')
      return <HeadmasterDashboard />
  }
}

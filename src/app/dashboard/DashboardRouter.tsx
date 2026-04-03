'use client'
import { useAuth } from '@/lib/auth-context'
import HeadmasterDashboard from './dashboards/HeadmasterDashboard'
import DeanDashboard from './dashboards/DeanDashboard'
import BursarDashboard from './dashboards/BursarDashboard'
import TeacherDashboard from './dashboards/TeacherDashboard'

export default function DashboardRouter() {
  const { user, isDemo, loading } = useAuth()

  // Skip loading check - show dashboard immediately
  if (!user) {
    // No user - redirect will happen in layout
    return null
  }

  // Route based on role
  switch (user.role) {
    case 'headmaster':
    case 'school_admin':
      return <HeadmasterDashboard />
    
    case 'dean_of_studies':
      return <DeanDashboard />
    
    case 'bursar':
      return <BursarDashboard />
    
    case 'teacher':
      return <TeacherDashboard />
    
    default:
      // Default to headmaster view
      return <HeadmasterDashboard />
  }
}

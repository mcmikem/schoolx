'use client'
import { useAuth } from '@/lib/auth-context'
import HeadmasterDashboard from './dashboards/HeadmasterDashboard'
import DeanDashboard from './dashboards/DeanDashboard'
import BursarDashboard from './dashboards/BursarDashboard'
import TeacherDashboard from './dashboards/TeacherDashboard'

export default function DashboardRouter() {
  const { user, isDemo, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
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

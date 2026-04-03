'use client'
import { useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import ErrorBoundary from '@/components/ErrorBoundary'
import ExpiredNotice from '@/components/dashboard/ExpiredNotice'
import SidebarShell from '@/components/dashboard/SidebarShell'
import TopBar from '@/components/dashboard/TopBar'
import MobileBottomNav from '@/components/dashboard/MobileBottomNav'
import { useAccessControl, getPageTitle } from '@/components/dashboard/AccessControlGuard'
import { usePathname } from 'next/navigation'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isTrialExpired, signOut } = useAuth()
  const pathname = usePathname()
  const toast = useToast()

  useAccessControl()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const sidebar = document.querySelector('.sidebar.open')
        if (sidebar) sidebar.classList.remove('open')
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSignOut = async () => {
    sessionStorage.removeItem('lastDeniedPath')
    await signOut()
    toast.success('Signed out successfully')
  }

  const pageTitle = getPageTitle(pathname || '/dashboard')

  return (
    <ErrorBoundary>
      <OfflineIndicator />
      {isTrialExpired && <ExpiredNotice />}
      <div className="bg-motif flex min-h-screen bg-[var(--bg)]">
        <SidebarShell onNavigate={() => document.querySelector('.sidebar')?.classList.remove('open')} />

        <main className="main-content mobile-container ml-[var(--sidebar-width)] flex-1 flex flex-col min-h-screen w-[calc(100%-var(--sidebar-width))] overflow-hidden">
          <TopBar pageTitle={pageTitle} onSignOut={handleSignOut} />
          {children}
        </main>
      </div>

      <MobileBottomNav />
    </ErrorBoundary>
  )
}

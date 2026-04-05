'use client'
import { useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import ErrorBoundary from '@/components/ErrorBoundary'
import ExpiredNotice from '@/components/dashboard/ExpiredNotice'
import TrialBanner from '@/components/dashboard/TrialBanner'
import SidebarShell from '@/components/dashboard/SidebarShell'
import TopBar from '@/components/dashboard/TopBar'
import MobileBottomNav from '@/components/dashboard/MobileBottomNav'
import WorkflowGuide from '@/components/dashboard/WorkflowGuide'
import WhatsAppSupport from '@/components/WhatsAppSupport'
import { useAccessControl, getPageTitle } from '@/components/dashboard/AccessControlGuard'
import { usePathname, useRouter } from 'next/navigation'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isDemo, isTrialExpired, signOut } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const toast = useToast()
  const hasCheckedAuth = useRef(false)

  useAccessControl()

  // Only redirect after initial auth check is complete
  useEffect(() => {
    if (!loading) {
      hasCheckedAuth.current = true
    }
    if (hasCheckedAuth.current && !loading && !user && !isDemo) {
      router.replace('/login')
    }
  }, [loading, user, isDemo, router])

  const handleSignOut = async () => {
    sessionStorage.removeItem('lastDeniedPath')
    await signOut()
    toast.success('Signed out successfully')
  }

  const pageTitle = getPageTitle(pathname || '/dashboard')

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--t3)]">
        Loading dashboard...
      </div>
    )
  }

  if (!user) return null

  return (
    <ErrorBoundary>
      <OfflineIndicator />
      {isTrialExpired && <ExpiredNotice />}
      <div className="bg-motif flex min-h-screen bg-[var(--bg)]">
        <SidebarShell onNavigate={() => {
          document.querySelector('.sidebar')?.classList.remove('open')
          document.querySelector('.sidebar-overlay')?.classList.remove('visible')
        }} />
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => {
            document.querySelector('.sidebar')?.classList.remove('open')
            document.querySelector('.sidebar-overlay')?.classList.remove('visible')
          }}
        />

        <main className="main-content mobile-container ml-[var(--sidebar-width)] flex-1 flex flex-col min-h-screen w-[calc(100%-var(--sidebar-width))] overflow-hidden">
          <TopBar pageTitle={pageTitle} onSignOut={handleSignOut} />
          <TrialBanner />
          <WorkflowGuide />
          {children}
        </main>
      </div>

      <MobileBottomNav />
      <WhatsAppSupport />
    </ErrorBoundary>
  )
}

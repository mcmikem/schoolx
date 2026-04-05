'use client'
import Link from 'next/link'
import FeatherIcon from "@/components/FeatherIcon"
import { usePathname } from 'next/navigation'
import { useMemo } from 'react'

type QuickStep = {
  label: string
  href: string
  icon: string
}

export default function MobileBottomNav() {
  const pathname = usePathname()
  const isActive = (path: string) => pathname === path || pathname?.startsWith(path + '/')
  const quickStep = useMemo<QuickStep>(() => {
    if (!pathname) return { label: 'Add Student', href: '/dashboard/students', icon: 'add' }
    if (pathname.startsWith('/dashboard/students')) return { label: 'Take Attendance', href: '/dashboard/attendance', icon: 'how_to_reg' }
    if (pathname.startsWith('/dashboard/attendance')) return { label: 'Record Fees', href: '/dashboard/fees', icon: 'finance' }
    if (pathname.startsWith('/dashboard/fees')) return { label: 'Send Reminder', href: '/dashboard/messages', icon: 'sms' }
    return { label: 'Add Student', href: '/dashboard/students', icon: 'add' }
  }, [pathname])

  return (
    <div className="mobile-bottom-nav">
      <Link href="/dashboard" className={`mobile-nav-item ${pathname === '/dashboard' ? 'active' : ''}`}>
        <FeatherIcon name="dashboard" size={20} />
        <span>Home</span>
      </Link>
      <Link href="/dashboard/students" className={`mobile-nav-item ${isActive('/dashboard/students') ? 'active' : ''}`}>
        <FeatherIcon name="students" size={20} />
        <span>Students</span>
      </Link>
      <Link href={quickStep.href} className="mobile-nav-item mobile-nav-item-primary">
        <FeatherIcon name={quickStep.icon} size={20} />
        <span>{quickStep.label}</span>
      </Link>
      <Link href="/dashboard/fees" className={`mobile-nav-item ${isActive('/dashboard/fees') ? 'active' : ''}`}>
        <FeatherIcon name="finance" size={20} />
        <span>Fees</span>
      </Link>
      <button
        type="button"
        className="mobile-nav-item"
        onClick={() => {
          document.querySelector('.sidebar')?.classList.add('open')
          document.querySelector('.sidebar-overlay')?.classList.add('visible')
        }}
        aria-label="Open more pages"
      >
        <FeatherIcon name="dashboard" size={20} />
        <span>More</span>
      </button>
    </div>
  )
}

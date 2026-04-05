'use client'
import Link from 'next/link'
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
    if (!pathname) return { label: 'Add Student', href: '/dashboard/students', icon: 'person_add' }
    if (pathname.startsWith('/dashboard/students')) return { label: 'Take Attendance', href: '/dashboard/attendance', icon: 'how_to_reg' }
    if (pathname.startsWith('/dashboard/attendance')) return { label: 'Record Fees', href: '/dashboard/fees', icon: 'payments' }
    if (pathname.startsWith('/dashboard/fees')) return { label: 'Send Reminder', href: '/dashboard/messages', icon: 'sms' }
    return { label: 'Add Student', href: '/dashboard/students', icon: 'person_add' }
  }, [pathname])

  return (
    <div className="mobile-bottom-nav">
      <Link href="/dashboard" className={`mobile-nav-item ${pathname === '/dashboard' ? 'active' : ''}`}>
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>dashboard</span>
        <span>Home</span>
      </Link>
      <Link href="/dashboard/students" className={`mobile-nav-item ${isActive('/dashboard/students') ? 'active' : ''}`}>
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>group</span>
        <span>Students</span>
      </Link>
      <Link href={quickStep.href} className="mobile-nav-item mobile-nav-item-primary">
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{quickStep.icon}</span>
        <span>{quickStep.label}</span>
      </Link>
      <Link href="/dashboard/fees" className={`mobile-nav-item ${isActive('/dashboard/fees') ? 'active' : ''}`}>
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>payments</span>
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
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>apps</span>
        <span>More</span>
      </button>
    </div>
  )
}

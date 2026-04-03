'use client'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function MobileBottomNav() {
  const pathname = usePathname()
  const isActive = (path: string) => pathname === path || pathname?.startsWith(path + '/')

  return (
    <div className="mobile-bottom-nav">
      <a href="/dashboard" className={`mobile-nav-item ${pathname === '/dashboard' ? 'active' : ''}`}>
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>dashboard</span>
        <span>Home</span>
      </a>
      <a href="/dashboard/students" className={`mobile-nav-item ${isActive('/dashboard/students') ? 'active' : ''}`}>
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>group</span>
        <span>Students</span>
      </a>
      <a href="/dashboard/attendance" className={`mobile-nav-item ${isActive('/dashboard/attendance') ? 'active' : ''}`}>
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>how_to_reg</span>
        <span>Attendance</span>
      </a>
      <a href="/dashboard/fees" className={`mobile-nav-item ${isActive('/dashboard/fees') ? 'active' : ''}`}>
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>payments</span>
        <span>Fees</span>
      </a>
      <a href="/dashboard/messages" className={`mobile-nav-item ${isActive('/dashboard/messages') ? 'active' : ''}`}>
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chat</span>
        <span>Messages</span>
      </a>
    </div>
  )
}

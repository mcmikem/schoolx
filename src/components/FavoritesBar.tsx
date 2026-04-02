'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import MaterialIcon from '@/components/MaterialIcon'

interface PinnedItem {
  href: string
  label: string
  icon: string
}

const FAVORITES_KEY = 'schoolx_pinned_items'

const defaultPins: PinnedItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/dashboard/students', label: 'Students', icon: 'group' },
  { href: '/dashboard/fees', label: 'Fees', icon: 'payments' },
]

const availableItems: PinnedItem[] = [
  { href: '/dashboard/attendance', label: 'Attendance', icon: 'how_to_reg' },
  { href: '/dashboard/grades', label: 'Grades', icon: 'menu_book' },
  { href: '/dashboard/exams', label: 'Exams', icon: 'fact_check' },
  { href: '/dashboard/staff', label: 'Staff', icon: 'person' },
  { href: '/dashboard/reports', label: 'Reports', icon: 'description' },
  { href: '/dashboard/messages', label: 'Messages', icon: 'chat' },
  { href: '/dashboard/notices', label: 'Notices', icon: 'campaign' },
  { href: '/dashboard/timetable', label: 'Timetable', icon: 'calendar_month' },
  { href: '/dashboard/payroll', label: 'Payroll', icon: 'payments' },
  { href: '/dashboard/budget', label: 'Budget', icon: 'account_balance_wallet' },
  { href: '/dashboard/settings', label: 'Settings', icon: 'settings' },
  { href: '/dashboard/health', label: 'Health', icon: 'medical_services' },
  { href: '/dashboard/discipline', label: 'Discipline', icon: 'warning' },
  { href: '/dashboard/uneb', label: 'UNEB', icon: 'workspace_premium' },
  { href: '/dashboard/promotion', label: 'Promotion', icon: 'trending_up' },
  { href: '/dashboard/homework', label: 'Homework', icon: 'assignment' },
  { href: '/dashboard/analytics', label: 'Analytics', icon: 'analytics' },
]

export default function FavoritesBar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>(defaultPins)

  useEffect(() => {
    const saved = localStorage.getItem(FAVORITES_KEY)
    if (saved) {
      try {
        setPinnedItems(JSON.parse(saved))
      } catch {
        setPinnedItems(defaultPins)
      }
    }
  }, [])

  const savePins = useCallback((items: PinnedItem[]) => {
    setPinnedItems(items)
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(items))
  }, [])

  const pinItem = (item: PinnedItem) => {
    if (pinnedItems.find(p => p.href === item.href)) return
    if (pinnedItems.length >= 6) {
      alert('Maximum 6 pinned items allowed. Remove one first.')
      return
    }
    savePins([...pinnedItems, item])
  }

  const unpinItem = (href: string) => {
    savePins(pinnedItems.filter(p => p.href !== href))
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {pinnedItems.slice(0, 5).map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className="fav-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                color: isActive ? 'var(--navy)' : 'var(--t2)',
                background: isActive ? 'var(--navy)' : 'transparent',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
              title={item.label}
            >
              <MaterialIcon 
                icon={item.icon} 
                style={{ fontSize: 16, color: isActive ? '#fff' : 'var(--t3)' }} 
              />
              <span style={{ display: pathname ? 'inline' : 'none' }}>{item.label}</span>
            </Link>
          )
        })}
      </div>

      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          cursor: 'pointer',
          color: 'var(--t3)',
        }}
        title="Manage pinned items"
      >
        <MaterialIcon icon={isOpen ? 'close' : 'push_pin'} style={{ fontSize: 16 }} />
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 8,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r)',
          boxShadow: 'var(--sh3)',
          width: 280,
          zIndex: 100,
          maxHeight: 320,
          overflowY: 'auto',
        }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>Pinned Items</div>
            <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>Click to pin/unpin (max 6)</div>
          </div>
          
          <div style={{ padding: 8 }}>
            {pinnedItems.map(item => (
              <div
                key={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
                onClick={() => unpinItem(item.href)}
                className="hover:bg-surface-container"
              >
                <MaterialIcon icon={item.icon} style={{ fontSize: 16, color: 'var(--t3)' }} />
                <span style={{ flex: 1, fontSize: 13, color: 'var(--t1)' }}>{item.label}</span>
                <MaterialIcon icon="close" style={{ fontSize: 14, color: 'var(--t4)' }} />
              </div>
            ))}
          </div>

          <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', marginBottom: 6 }}>Available to pin</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {availableItems
                .filter(item => !pinnedItems.find(p => p.href === item.href))
                .map(item => (
                  <button
                    key={item.href}
                    onClick={() => pinItem(item)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      fontSize: 11,
                      color: 'var(--t2)',
                      cursor: 'pointer',
                    }}
                  >
                    <MaterialIcon icon="add" style={{ fontSize: 12 }} />
                    {item.label}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

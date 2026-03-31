'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import MaterialIcon from '@/components/MaterialIcon'
import { NavGroup } from '@/lib/navigation'

interface CollapsibleSidebarProps {
  groups: NavGroup[]
  onNavigate?: () => void
}

export default function CollapsibleSidebar({ groups, onNavigate }: CollapsibleSidebarProps) {
  const pathname = usePathname()
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  // Initialize open state based on defaultOpen and if any item is active
  useEffect(() => {
    const initial: Record<string, boolean> = {}
    groups.forEach((group) => {
      const hasActive = group.items.some(item => pathname === item.href || pathname.startsWith(item.href + '/'))
      initial[group.label] = hasActive || group.defaultOpen || false
    })
    setOpenGroups(initial)
  }, [groups, pathname])

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <nav className="sidebar-nav" role="navigation" aria-label="Main navigation">
      {groups.map((group) => {
        const isOpen = openGroups[group.label]
        const hasActive = group.items.some(item => pathname === item.href || pathname.startsWith(item.href + '/'))

        return (
          <div key={group.label} className="sidebar-group" style={{ marginBottom: 8 }}>
            <button
              onClick={() => toggleGroup(group.label)}
              className="sidebar-group-header"
              aria-expanded={isOpen}
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                padding: '10px 12px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: hasActive ? 'var(--navy)' : 'var(--t3)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                transition: 'color 0.15s',
              }}
            >
              <span style={{ flex: 1, textAlign: 'left' }}>{group.label}</span>
              <span className="material-symbols-outlined" style={{ 
                fontSize: 16, 
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s'
              }}>
                expand_more
              </span>
            </button>
            
            {isOpen && (
              <div className="sidebar-group-items" style={{ marginTop: 4 }}>
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className="sidebar-nav-item"
                      aria-current={isActive ? 'page' : undefined}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 9,
                        color: isActive ? 'var(--navy)' : 'var(--t2)',
                        fontSize: 14,
                        fontWeight: isActive ? 600 : 500,
                        background: isActive ? 'var(--navy-soft)' : 'transparent',
                        textDecoration: 'none',
                        transition: 'all 0.15s',
                        minHeight: 44,
                      }}
                    >
                      <MaterialIcon icon={item.icon} style={{ fontSize: 18 }} />
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {item.badge && (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 20,
                          background: item.badge === 'New' ? 'var(--green-soft)' : 'var(--amber-soft)',
                          color: item.badge === 'New' ? 'var(--green)' : 'var(--amber)',
                          fontFamily: 'DM Mono',
                        }}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}

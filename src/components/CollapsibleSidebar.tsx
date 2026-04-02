'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import MaterialIcon from '@/components/MaterialIcon'
import { NavGroup } from '@/lib/navigation'
import { cn } from '@/lib/utils'

interface CollapsibleSidebarProps {
  groups: NavGroup[]
  onNavigate?: () => void
}

export default function CollapsibleSidebar({ groups, onNavigate }: CollapsibleSidebarProps) {
  const pathname = usePathname()
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

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
    <nav className="sidebar-nav overflow-y-auto flex-1 px-2 py-3" role="navigation" aria-label="Main navigation">
      <div className="space-y-1">
        {groups.map((group) => {
          const isOpen = openGroups[group.label]
          const hasActive = group.items.some(item => pathname === item.href || pathname.startsWith(item.href + '/'))

          return (
            <div key={group.label} className="sidebar-group">
              <button
                onClick={() => toggleGroup(group.label)}
                className={cn(
                  "flex items-center w-full px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-colors duration-150 outline-none rounded-lg",
                  hasActive || isOpen ? "text-[var(--primary)]" : "text-[var(--t4)] hover:text-[var(--t2)] hover:bg-[var(--surface-container-low)]"
                )}
                aria-expanded={isOpen}
              >
                {group.icon && (
                  <MaterialIcon icon={group.icon} className="text-[16px] mr-2" />
                )}
                <span className="flex-1 text-left">{group.label}</span>
                <span className={cn(
                  "material-symbols-outlined text-[16px] transition-transform duration-200",
                  isOpen && "rotate-180"
                )}>
                  expand_more
                </span>
              </button>
              
              {isOpen && (
                <div className="mt-1 ml-2 space-y-0.5 border-l border-[var(--border)] pl-2">
                  {group.items.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all min-h-[36px] group",
                          isActive 
                            ? "bg-[var(--primary-50)] text-[var(--primary)] font-semibold" 
                            : "text-[var(--t2)] hover:bg-[var(--surface-container-low)] hover:text-[var(--t1)]"
                        )}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <MaterialIcon 
                          icon={item.icon} 
                          className={cn(
                            "text-[17px]",
                            isActive ? "text-[var(--primary)]" : "text-[var(--t3)] group-hover:text-[var(--t2)]"
                          )} 
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && (
                          <span className={cn(
                            "text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider",
                            item.badge === 'New' 
                              ? "bg-[var(--green-soft)] text-[var(--green)]" 
                              : "bg-[var(--amber-soft)] text-[var(--amber)]"
                          )}>
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
      </div>
    </nav>
  )
}
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
    <nav className="sidebar-nav overflow-y-auto flex-1 px-3 py-4" role="navigation" aria-label="Main navigation">
      <div className="space-y-4">
        {groups.map((group) => {
          const isOpen = openGroups[group.label]
          const hasActive = group.items.some(item => pathname === item.href || pathname.startsWith(item.href + '/'))

          return (
            <div key={group.label} className="sidebar-group">
              <button
                onClick={() => toggleGroup(group.label)}
                className={cn(
                  "flex items-center w-full px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors duration-150 outline-none",
                  hasActive ? "text-primary" : "text-outline hover:text-onSurface"
                )}
                aria-expanded={isOpen}
              >
                <span className="flex-1 text-left">{group.label}</span>
                <span className={cn(
                  "material-symbols-outlined text-[16px] transition-transform duration-200",
                  isOpen && "rotate-180"
                )}>
                  expand_more
                </span>
              </button>
              
              {isOpen && (
                <div className="mt-1 space-y-px">
                  {group.items.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] transition-all min-h-[40px] group",
                          isActive 
                            ? "bg-primary-50 text-primary font-semibold shadow-sm" 
                            : "text-onSurface-variant hover:bg-surface-container-low hover:text-onSurface"
                        )}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <MaterialIcon 
                          icon={item.icon} 
                          className={cn(
                            "text-[18px]",
                            isActive ? "text-primary" : "text-outline group-hover:text-onSurface"
                          )} 
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && (
                          <span className={cn(
                            "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono",
                            item.badge === 'New' 
                              ? "bg-green-soft text-green" 
                              : "bg-amber-soft text-amber"
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

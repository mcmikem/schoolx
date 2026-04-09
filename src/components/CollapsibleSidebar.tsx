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
  const path = pathname ?? ''
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [query, setQuery] = useState('')
  const [recentPages, setRecentPages] = useState<Array<{ href: string; label: string; icon: string }>>([])

  useEffect(() => {
    const initial: Record<string, boolean> = {}
    groups.forEach((group) => {
      const hasActive = group.items.some(item => path === item.href || path.startsWith(item.href + '/'))
      initial[group.label] = hasActive || group.defaultOpen || false
    })
    setOpenGroups(initial)
  }, [groups, path])

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }))
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem('assemble_recent_pages')
      if (saved) setRecentPages(JSON.parse(saved))
    } catch {
      // Ignore localStorage parsing issues
    }
  }, [])

  const normalizedQuery = query.trim().toLowerCase()

  const filteredGroups = normalizedQuery
    ? groups
        .map(group => ({
          ...group,
          items: group.items.filter(item =>
            item.label.toLowerCase().includes(normalizedQuery) ||
            group.label.toLowerCase().includes(normalizedQuery)
          ),
        }))
        .filter(group => group.items.length > 0)
    : groups

  const trackRecentPage = (href: string, label: string, icon: string) => {
    const updated = [{ href, label, icon }, ...recentPages.filter(p => p.href !== href)].slice(0, 4)
    setRecentPages(updated)
    localStorage.setItem('schoolx_recent_pages', JSON.stringify(updated))
  }

  return (
    <nav className="sidebar-nav overflow-y-auto flex-1 px-2 py-3" role="navigation" aria-label="Main navigation">
      <div className="px-2 pb-2">
        <div className="flex items-center gap-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2">
          <span className="material-symbols-outlined text-[16px] text-[var(--t4)]">search</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find page..."
            className="w-full bg-transparent border-none outline-none text-[12px] text-[var(--t1)] placeholder:text-[var(--t4)]"
            aria-label="Search navigation pages"
          />
        </div>
      </div>

      {recentPages.length > 0 && !normalizedQuery && (
        <div className="px-2 pb-2">
          <div className="text-[10px] uppercase tracking-wider font-bold text-[var(--t4)] mb-1.5">Continue where you left off</div>
          <div className="space-y-1">
            {recentPages.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] text-[var(--t2)] hover:bg-[var(--surface-container-low)] no-underline"
              >
                <MaterialIcon icon={item.icon} className="text-[15px] text-[var(--t3)]" />
                <span className="truncate">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1">
        {filteredGroups.map((group) => {
          const isOpen = openGroups[group.label]
          const hasActive = group.items.some(item => path === item.href || path.startsWith(item.href + '/'))

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
                    const isActive = path === item.href || path.startsWith(item.href + '/')
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => {
                          trackRecentPage(item.href, item.label, item.icon)
                          onNavigate?.()
                        }}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] transition-all min-h-[36px] group relative tap-effect",
                          isActive 
                            ? "bg-[var(--primary)] text-white font-semibold shadow-[var(--sh1)]" 
                            : "text-[var(--t2)] hover:bg-[var(--surface-container-low)] hover:text-[var(--t1)]"
                        )}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        {isActive && (
                           <div className="absolute left-0 w-1 h-4 bg-white rounded-r-full" />
                        )}
                        <MaterialIcon 
                          icon={item.icon} 
                          className={cn(
                            "text-[17px]",
                            isActive ? "text-white" : "text-[var(--t3)] group-hover:text-[var(--t2)]"
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
        {filteredGroups.length === 0 && normalizedQuery && (
          <div className="px-3 py-3 text-[12px] text-[var(--t3)]">
            No results for “{query}”.
            <Link href="/dashboard" onClick={onNavigate} className="block mt-2 text-[var(--navy)] no-underline font-semibold">
              Go to dashboard home
            </Link>
          </div>
        )}
        {filteredGroups.length === 0 && !normalizedQuery && (
          <div className="px-3 py-3 text-[12px] text-[var(--t3)]">
            Preparing your navigation...
          </div>
        )}
      </div>
    </nav>
  )
}

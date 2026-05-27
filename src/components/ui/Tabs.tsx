'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'

interface Tab {
  id: string
  label: string
  count?: number
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (tabId: string) => void
  className?: string
}

export function Tabs({ tabs, activeTab, onChange, className = '' }: TabsProps) {
  const id = useId()
  
  return (
    <div className={cn('flex flex-wrap sm:flex-nowrap gap-1 p-1 bg-[var(--surface-container-low)] rounded-xl', className)} role="tablist">
      {tabs.map(tab => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`panel-${id}`}
          id={`tab-${tab.id}`}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex-1 min-w-[140px] sm:min-w-0 sm:flex-none px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all text-center',
            activeTab === tab.id
              ? 'bg-[var(--surface)] text-[var(--t1)] shadow-sm'
              : 'text-[var(--t3)] hover:text-[var(--t2)]'
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn(
              'ml-2 px-1.5 py-0.5 text-xs rounded-md',
              activeTab === tab.id ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'bg-[var(--surface-container)] text-[var(--t4)]'
            )}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

interface TabPanelProps {
  children: React.ReactNode
  activeTab: string
  tabId: string
  id?: string
}

export function TabPanel({ children, activeTab, tabId, id }: TabPanelProps) {
  const panelId = id || `panel-${tabId}`
  
  return (
    <div
      role="tabpanel"
      id={panelId}
      aria-labelledby={`tab-${tabId}`}
      hidden={activeTab !== tabId}
      className={activeTab === tabId ? 'block' : 'hidden'}
    >
      {children}
    </div>
  )
}
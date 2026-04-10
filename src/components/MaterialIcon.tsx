'use client'

import React from 'react'
import * as LucideIcons from 'lucide-react'
import { LucideProps } from 'lucide-react'

// Map Material Icon names to Lucide icons
const ICON_MAP: Record<string, keyof typeof LucideIcons> = {
  dashboard: 'LayoutDashboard',
  analytics: 'BarChart3',
  school: 'School',
  students: 'Users',
  group: 'Users',
  group_add: 'UserPlus',
  how_to_reg: 'UserCheck',
  check_circle: 'CheckCircle2',
  check: 'Check',
  grade: 'FileText',
  menu_book: 'BookOpen',
  exams: 'FileEdit',
  fact_check: 'ClipboardCheck',
  uneb: 'Award',
  finance: 'Wallet',
  payments: 'CreditCard',
  account_balance_wallet: 'Wallet',
  reports: 'FileBarChart',
  assessment: 'Assessment' as any, // fallback
  description: 'FileText',
  messages: 'MessageSquare',
  chat: 'MessageCircle',
  sms: 'Send',
  campaign: 'Megaphone',
  send: 'SendHorizontal',
  timetable: 'CalendarClock',
  calendar_month: 'CalendarDays',
  calendar_today: 'Calendar',
  calendar: 'Calendar',
  staff: 'UserSquare2',
  person: 'User',
  badge: 'Badge' as any,
  discipline: 'ShieldAlert',
  warning: 'AlertTriangle',
  trends: 'TrendingUp',
  show_chart: 'LineChart',
  trending_up: 'TrendingUp',
  trending_down: 'TrendingDown',
  search: 'Search',
  notifications: 'Bell',
  bell: 'Bell',
  light_mode: 'Sun',
  download: 'Download',
  add: 'Plus',
  person_add: 'UserPlus',
  save: 'Save',
  edit: 'Edit3',
  delete: 'Trash2',
  close: 'X',
  undo: 'Undo2',
  cloud_off: 'CloudOff',
  wifi_off: 'WifiOff',
  print: 'Printer',
  upgrade: 'ArrowUpCircle',
  settings: 'Settings',
  history: 'History',
  feedback: 'MessageSquare',
  extension: 'Puzzle',
  auto_awesome: 'Sparkles',
  event_repeat: 'CalendarRange',
  health: 'Heart',
  local_hospital: 'Activity',
  transport: 'Bus',
  directions_bus: 'Bus',
  library: 'Library',
  local_library: 'Library',
  assets: 'Box',
  inventory_2: 'Archive',
  dorm: 'Bed',
  bed: 'Bed',
  volunteer_activism: 'HeartHandshake',
  star: 'Star',
  rocket_launch: 'Rocket',
  lock_clock: 'Lock',
  lock_reset: 'RotateCcw',
  block: 'Ban',
  person_off: 'UserMinus',
  schedule: 'Clock',
  location_on: 'MapPin',
  location: 'MapPin',
  chevron_right: 'ChevronRight',
  arrow_forward: 'ArrowRight',
  logout: 'LogOut',
  credit_card: 'CreditCard',
  database: 'Database',
  psychology: 'Brain',
  smart_toys: 'Bot',
  upload_file: 'FileUp',
  track_changes: 'Target',
  list_alt: 'List',
  family_restroom: 'Users',
  verified: 'Verified',
  refresh: 'RotateCw',
  sync: 'RefreshCw',
  play_arrow: 'Play',
  play_circle: 'PlayCircle',
  hourglass_top: 'Hourglass',
  hourglass_empty: 'Hourglass',
  approval: 'ShieldCheck',
  money_off: 'Banknote',
  biotech: 'Pipette',
  id_card: 'Contact2',
  military_tech: 'Medal',
}

interface MaterialIconProps {
  icon?: string
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
  size?: number | string
}

export default function MaterialIcon({ 
  icon, 
  className, 
  style, 
  children,
  size = 18
}: MaterialIconProps) {
  const iconName = (icon || children?.toString() || '').toLowerCase().trim()
  
  const lucideName = ICON_MAP[iconName]
  const IconComponent = lucideName ? (LucideIcons[lucideName] as React.ElementType) : null

  if (IconComponent) {
    return (
      <IconComponent 
        size={size}
        className={className}
        style={style}
        strokeWidth={1.8}
      />
    )
  }

  // Fallback to a default icon if mapping fails
  const HelpIcon = LucideIcons.HelpCircle
  return (
    <HelpIcon 
      size={size}
      className={className} 
      style={style}
      strokeWidth={1.8}
    />
  )
}

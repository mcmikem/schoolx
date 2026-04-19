'use client'

import React from 'react'
import * as LucideIcons from 'lucide-react'
import { LucideProps } from 'lucide-react'

// Map Material Icon names to Lucide icons
const ICON_MAP: Record<string, keyof typeof LucideIcons> = {
  // Navigation & layout
  dashboard: 'LayoutDashboard',
  home: 'Home',
  menu: 'Menu',
  expand_more: 'ChevronDown',
  expand_less: 'ChevronUp',
  chevron_right: 'ChevronRight',
  chevron_down: 'ChevronDown',
  arrow_forward: 'ArrowRight',
  arrow_back: 'ArrowLeft',
  arrow_upward: 'ArrowUp',
  arrow_downward: 'ArrowDown',
  more_vert: 'MoreVertical',
  more_horiz: 'MoreHorizontal',
  open_in_new: 'ExternalLink',
  close: 'X',

  // People & identity
  school: 'School',
  students: 'Users',
  group: 'Users',
  group_add: 'UserPlus',
  how_to_reg: 'UserCheck',
  person: 'User',
  person_add: 'UserPlus',
  person_off: 'UserMinus',
  person_outline: 'User',
  staff: 'UserSquare2',
  family_restroom: 'Users',
  female: 'UserRound',
  face: 'CircleUser',
  badge: 'Contact2',
  id_card: 'Contact2',
  military_tech: 'Medal',

  // Academics
  analytics: 'BarChart3',
  grade: 'FileText',
  menu_book: 'BookOpen',
  book: 'BookMarked',
  exams: 'FileEdit',
  fact_check: 'ClipboardCheck',
  uneb: 'Award',
  workspace_premium: 'Trophy',
  reports: 'FileBarChart',
  assessment: 'ClipboardList',
  assignment: 'ClipboardList',
  description: 'FileText',
  upload_file: 'FileUp',
  list_alt: 'List',
  track_changes: 'Target',

  // Finance
  finance: 'Wallet',
  payments: 'CreditCard',
  account_balance_wallet: 'Wallet',
  credit_card: 'CreditCard',
  money_off: 'Banknote',
  attach_money: 'DollarSign',
  local_atm: 'Banknote',
  receipt: 'Receipt',
  rule: 'Ruler',

  // Communication
  messages: 'MessageSquare',
  chat: 'MessageCircle',
  sms: 'Send',
  send: 'SendHorizontal',
  campaign: 'Megaphone',
  feedback: 'MessageSquare',
  notifications: 'Bell',
  bell: 'Bell',

  // Calendar & time
  timetable: 'CalendarClock',
  calendar_month: 'CalendarDays',
  calendar_today: 'Calendar',
  calendar: 'Calendar',
  event_repeat: 'CalendarRange',
  schedule: 'Clock',
  hourglass_top: 'Hourglass',
  hourglass_empty: 'Hourglass',

  // Actions
  add: 'Plus',
  save: 'Save',
  edit: 'Edit3',
  delete: 'Trash2',
  undo: 'Undo2',
  refresh: 'RotateCw',
  sync: 'RefreshCw',
  download: 'Download',
  print: 'Printer',
  print_connect: 'Printer',
  content_copy: 'Copy',
  filter_list: 'Filter',
  search: 'Search',
  tune: 'SlidersHorizontal',
  tag: 'Hash',
  numbers: 'Hash',
  swap_horiz: 'ArrowLeftRight',
  swap_vert: 'ArrowUpDown',
  sort: 'ArrowUpDown',
  import_export: 'ArrowUpDown',

  // Auth
  login: 'LogIn',
  logout: 'LogOut',
  visibility: 'Eye',
  visibility_off: 'EyeOff',
  lock: 'Lock',
  lock_clock: 'Lock',
  lock_reset: 'RotateCcw',
  block: 'Ban',
  verified: 'BadgeCheck',
  verified_user: 'ShieldCheck',
  approval: 'ShieldCheck',

  // Upload / cloud
  cloud_upload: 'CloudUpload',
  cloud_off: 'CloudOff',
  wifi_off: 'WifiOff',

  // Status & feedback
  check: 'Check',
  check_circle: 'CheckCircle2',
  check_box: 'CheckSquare',
  warning: 'AlertTriangle',
  discipline: 'ShieldAlert',
  info: 'Info',
  help: 'HelpCircle',
  star: 'Star',
  auto_awesome: 'Sparkles',

  // Trends & data
  trends: 'TrendingUp',
  show_chart: 'LineChart',
  trending_up: 'TrendingUp',
  trending_down: 'TrendingDown',

  // System / admin
  settings: 'Settings',
  admin_panel_settings: 'ShieldCheck',
  settings_ethernet: 'Network',
  toggle_on: 'ToggleRight',
  public: 'Globe',
  corporate_fare: 'Building2',
  troubleshoot: 'Wrench',
  database: 'Database',
  extension: 'Puzzle',
  upgrade: 'ArrowUpCircle',
  history: 'History',
  language: 'Globe',

  // Places / services
  health: 'Heart',
  local_hospital: 'Activity',
  transport: 'Bus',
  directions_bus: 'Bus',
  library: 'Library',
  local_library: 'Library',
  assets: 'Box',
  inventory: 'Package',
  inventory_2: 'Archive',
  shopping_cart: 'ShoppingCart',
  dorm: 'Bed',
  bed: 'Bed',
  location_on: 'MapPin',
  location: 'MapPin',

  // Media / files
  photo_camera: 'Camera',
  image: 'ImageIcon',
  attach_file: 'Paperclip',

  // Misc
  volunteer_activism: 'HeartHandshake',
  rocket_launch: 'Rocket',
  lightbulb: 'Lightbulb',
  psychology: 'Brain',
  smart_toys: 'Bot',
  biotech: 'Pipette',
  play_arrow: 'Play',
  play_circle: 'PlayCircle',
  person_off_2: 'UserMinus',

  // Devices (landing page install options)
  install_desktop: 'MonitorDown',
  desktop_windows: 'Monitor',
  laptop_mac: 'Laptop',
  android: 'Smartphone',
  phone_iphone: 'Smartphone',
  phone_android: 'Smartphone',
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

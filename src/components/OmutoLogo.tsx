'use client'
import { cn } from '@/lib/utils'

interface OmutoLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'white' | 'dark'
  showText?: boolean
  className?: string
}

export default function OmutoLogo({ size = 'md', variant = 'default', showText = true, className }: OmutoLogoProps) {
  const sizes = {
    sm: { icon: 32, text: 'text-lg' },
    md: { icon: 40, text: 'text-xl' },
    lg: { icon: 56, text: 'text-2xl' },
    xl: { icon: 80, text: 'text-4xl' },
  }

  const colors = {
    default: { primary: '#17325F', accent: '#2E9448', text: '#17325F' },
    white: { primary: '#ffffff', accent: '#2E9448', text: '#ffffff' },
    dark: { primary: '#17325F', accent: '#2E9448', text: '#17325F' },
  }

  const s = sizes[size]
  const c = colors[variant]

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background rounded square with Gradient */}
        <defs>
          <linearGradient id={`omuto-grad-${variant}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={c.primary} />
            <stop offset="100%" stopColor={c.accent} />
          </linearGradient>
        </defs>
        <rect width="80" height="80" rx="18" fill={`url(#omuto-grad-${variant})`} />
        
        {/* Book shape */}
        <path
          d="M20 22C20 20.8954 20.8954 20 22 20H38C39.1046 20 40 20.8954 40 22V58C40 59.1046 39.1046 60 38 60H22C20.8954 60 20 59.1046 20 58V22Z"
          fill="white"
          fillOpacity="0.9"
        />
        <path
          d="M40 22C40 20.8954 40.8954 20 42 20H58C59.1046 20 60 20.8954 60 22V58C60 59.1046 59.1046 60 58 60H42C40.8954 60 40 59.1046 40 58V22Z"
          fill="white"
          fillOpacity="0.7"
        />
        
        {/* Book spine */}
        <rect x="38" y="20" width="4" height="40" fill={c.primary} fillOpacity="0.3" />
        
        {/* Lines on pages */}
        <rect x="24" y="28" width="12" height="2" rx="1" fill={c.primary} fillOpacity="0.2" />
        <rect x="24" y="34" width="10" height="2" rx="1" fill={c.primary} fillOpacity="0.15" />
        <rect x="44" y="28" width="12" height="2" rx="1" fill={c.primary} fillOpacity="0.15" />
        <rect x="44" y="34" width="10" height="2" rx="1" fill={c.primary} fillOpacity="0.1" />
        
        {/* Star accent */}
        <path
          d="M30 52L32 48L34 52L38 53L35 56L36 60L32 58L28 60L29 56L26 53L30 52Z"
          fill={c.accent}
        />
      </svg>
      
      {showText && (
        <div className="flex flex-col">
          <span
            className={cn(s.text, "font-bold leading-tight")}
            style={{ color: c.text }}
          >
            School<span style={{ color: c.accent }}>X</span>
          </span>
          {size !== 'sm' && (
            <span className="text-[10px] text-outline font-medium tracking-wider uppercase leading-tight">
              Academic Management
            </span>
          )}
        </div>
      )}
    </div>
  )
}

'use client'

interface SchoolXLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'white' | 'dark'
  showText?: boolean
}

export default function SchoolXLogo({ size = 'md', variant = 'default', showText = true }: SchoolXLogoProps) {
  const sizes = {
    sm: { icon: 32, text: 'text-lg' },
    md: { icon: 40, text: 'text-xl' },
    lg: { icon: 56, text: 'text-2xl' },
    xl: { icon: 80, text: 'text-4xl' },
  }

  const colors = {
    default: { primary: '#6366f1', accent: '#8b5cf6', text: '#6366f1' },
    white: { primary: '#ffffff', accent: '#e0e7ff', text: '#ffffff' },
    dark: { primary: '#4f46e5', accent: '#7c3aed', text: '#4f46e5' },
  }

  const s = sizes[size]
  const c = colors[variant]

  return (
    <div className="flex items-center gap-2.5">
      <svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background circle */}
        <circle cx="40" cy="40" r="38" fill={`url(#gradient-${variant})`} />
        
        {/* Gradient definition */}
        <defs>
          <linearGradient id={`gradient-${variant}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={c.primary} />
            <stop offset="100%" stopColor={c.accent} />
          </linearGradient>
        </defs>
        
        {/* Graduation cap */}
        <g transform="translate(18, 24)">
          {/* Cap top */}
          <polygon points="22,0 44,12 22,24 0,12" fill="white" />
          
          {/* Cap base */}
          <rect x="4" y="12" width="36" height="5" fill="white" fillOpacity="0.9" rx="1" />
          
          {/* Tassel */}
          <circle cx="38" cy="14" r="4" fill="white" />
          <line x1="38" y1="14" x2="46" y2="28" stroke="white" strokeWidth="2.5" />
          <circle cx="46" cy="30" r="3" fill="white" fillOpacity="0.8" />
        </g>
        
        {/* X accent on cap */}
        <text 
          x="40" 
          y="58" 
          fontFamily="system-ui, -apple-system, sans-serif" 
          fontSize="20" 
          fontWeight="bold" 
          fill="white"
          textAnchor="middle"
        >
          X
        </text>
      </svg>
      
      {showText && (
        <div className="flex flex-col">
          <span
            className={`${s.text} font-bold leading-tight`}
            style={{ color: c.text }}
          >
            School<span style={{ color: c.accent }}>X</span>
          </span>
          {size !== 'sm' && (
            <span className="text-xs text-gray-500 leading-tight">
              School Management
            </span>
          )}
        </div>
      )}
    </div>
  )
}
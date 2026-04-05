'use client'
import { cn } from '@/lib/utils'
import Image from 'next/image'

interface OmutoLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'white' | 'dark'
  showText?: boolean
  className?: string
}

export default function SchoolXLogo({ size = 'md', variant = 'default', showText = true, className }: OmutoLogoProps) {
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
      <div className="relative" style={{ width: s.icon, height: s.icon }}>
        <Image
          src="/assemble-icon.png"
          alt="ASSEMBLE Logo"
          width={s.icon}
          height={s.icon}
          className="object-contain"
          style={{ filter: variant === 'white' ? 'brightness(0) invert(1)' : undefined }}
        />
      </div>
      
      {showText && (
        <div className="flex flex-col">
          <span
            className={cn(s.text, "font-bold leading-tight")}
            style={{ color: c.text }}
          >
            ASSEMBLE
          </span>
          {size !== 'sm' && (
            <span className="text-[10px] text-outline font-medium tracking-wider uppercase leading-tight">
              Powered by Omuto Foundation
            </span>
          )}
        </div>
      )}
    </div>
  )
}
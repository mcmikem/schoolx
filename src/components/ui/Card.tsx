'use client'

interface CardProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
}

export function Card({ children, className = '', style, onClick }: CardProps) {
  return (
    <div 
      className={`bg-white rounded-xl border border-[#e8eaed] shadow-sm ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${className}`}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`p-4 border-b border-[#e8eaed] ${className}`}>
      {children}
    </div>
  )
}

export function CardBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`p-4 ${className}`}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`font-semibold text-[#191c1d] ${className}`}>
      {children}
    </div>
  )
}

export function CardSubtitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`text-sm text-[#5c6670] ${className}`}>
      {children}
    </div>
  )
}
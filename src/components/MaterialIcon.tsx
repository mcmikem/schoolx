'use client'

interface MaterialIconProps {
  icon?: string
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
  size?: number | string
}

export default function MaterialIcon({
  icon,
  className = '',
  style,
  children,
  size = 18,
}: MaterialIconProps) {
  const iconName = icon || children?.toString() || 'help'
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{ fontSize: size, lineHeight: 1, ...style }}
      aria-hidden="true"
    >
      {iconName}
    </span>
  )
}

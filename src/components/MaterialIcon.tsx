'use client'
import { memo } from 'react'

interface MaterialIconProps {
  icon?: string
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
  size?: number | string
}

const MaterialIcon = memo(function MaterialIcon({
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
})

export default MaterialIcon

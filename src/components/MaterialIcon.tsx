export function MaterialIcon({ 
  icon, 
  className, 
  style, 
  children 
}: { 
  icon?: string
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode 
}) {
  return (
    <span 
      className={`material-symbols-outlined ${className || ''}`} 
      style={style}
    >
      {icon || children}
    </span>
  )
}
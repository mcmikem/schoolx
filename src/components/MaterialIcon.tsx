'use client'
import { memo, useEffect, useRef, useState } from 'react'

interface MaterialIconProps {
  icon?: string
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
  size?: number | string
}

/**
 * Shown when an icon name has no ligature in the bundled font.
 *
 * Any real Material Symbols glyph is one square em. A name that failed to map
 * renders as its own text -- "APARTMENTS", "school_admin", "close_grades" -- at
 * several ems wide, which is how a stale subset paints words across the UI.
 * `help` is one of the oldest names in the font and is always subset in.
 */
const FALLBACK_ICON = 'help'

/**
 * Icons wider than this many ems cannot be a single glyph, so the ligature did
 * not resolve. 2em leaves room for variation in glyph advance width while
 * staying far below the shortest real icon name ("add", "close").
 */
const MAX_GLYPH_EM = 2

function MaterialIcon({
  icon,
  className = '',
  style,
  children,
  size = 18,
}: MaterialIconProps) {
  const requested = icon || children?.toString() || 'help'
  const [resolved, setResolved] = useState(requested)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    setResolved(requested)
    const el = ref.current
    // No layout engine (jsdom, SSR): nothing to measure, so trust the name.
    if (!el || el.offsetWidth === 0) return

    const fontPx = parseFloat(String(size)) || parseFloat(getComputedStyle(el).fontSize) || 16
    if (el.offsetWidth > fontPx * MAX_GLYPH_EM) {
      setResolved(FALLBACK_ICON)
    }
  }, [requested, size])

  return (
    <span
      ref={ref}
      className={`material-symbols-outlined ${className}`}
      style={{ fontSize: size, lineHeight: 1, ...style }}
      aria-hidden="true"
    >
      {resolved}
    </span>
  )
}

export default memo(MaterialIcon)
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
 * renders as its own text -- "close_grades", "school_admin" -- at several ems
 * wide, which is how a stale subset paints words across the UI. `help` is one
 * of the oldest names in the font and is always subset in.
 */
const FALLBACK_ICON = 'help'

/**
 * Icons wider than this many ems cannot be a single glyph, so the ligature did
 * not resolve. 2em leaves room for variation in glyph advance width while
 * staying far below the shortest real icon name ("add", "close").
 */
const MAX_GLYPH_EM = 2

/** The bundled font's family name, as declared in globals.css. */
const SYMBOLS_FAMILY = 'Material Symbols Outlined'

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
    let cancelled = false

    const measure = () => {
      if (cancelled) return
      const el = ref.current
      if (!el) return

      const fontPx =
        parseFloat(getComputedStyle(el).fontSize) || parseFloat(String(size)) || 16

      // The font must be ready before width means anything.
      //
      // This check is the whole point of the guard. An unloaded font renders the
      // ligature as its own plain text, which is exactly what a missing
      // ligature looks like -- so measuring early swapped icons that were
      // perfectly fine. On a phone, where the font arrives late, that turned
      // 38% of every icon into a question mark in a circle. Worse on a 2G
      // connection, which is where the font is slowest to arrive.
      if (typeof document !== "undefined" && document.fonts?.check) {
        if (!document.fonts.check(`${fontPx}px "${SYMBOLS_FAMILY}"`)) return
      }

      // No layout engine (jsdom, SSR): nothing to measure, so trust the name.
      if (el.offsetWidth === 0) return

      setResolved(el.offsetWidth > fontPx * MAX_GLYPH_EM ? FALLBACK_ICON : requested)
    }

    setResolved(requested)
    measure()

    // The font may still be arriving. Re-measure once it has.
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(measure).catch(() => {})
    }

    return () => {
      cancelled = true
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
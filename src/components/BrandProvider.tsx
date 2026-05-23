'use client'
import { ReactNode, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'

/**
 * Helper to generate a simple monochrome palette from a base hex color.
 * It returns an object mapping Tailwind shade keys to the same base color.
 * More sophisticated shade generation could be added later (e.g., using HSL).
 */
function generateMonochromePalette(base: string) {
  const shades: Record<string, string> = {}
  const suffixes = [
    '50',
    '100',
    '200',
    '300',
    '400',
    '500',
    '600',
    '700',
    '800',
    '900',
  ]
  for (const s of suffixes) {
    // For now, assign the base color to every shade.
    // This ensures Tailwind variables resolve to a consistent brand color.
    // Future improvement: generate light/dark variations via HSL manipulation.
    shades[`--primary-${s}`] = base
  }
  return shades
}

export default function BrandProvider({ children }: { children: ReactNode }) {
  const { school } = useAuth()

  useEffect(() => {
    const root = document.documentElement
    const base = school?.primary_color || '#005ce6'
    const accent = school?.accent_color || '#f97316'

    root.style.setProperty('--primary', base)
    root.style.setProperty('--accent', accent)

    const palette = generateMonochromePalette(base)
    for (const [varName, value] of Object.entries(palette)) {
      root.style.setProperty(varName, value)
    }

    const accentPalette = generateMonochromePalette(accent)
    for (const [varName, value] of Object.entries(accentPalette)) {
      root.style.setProperty(varName.replace('--primary', '--accent'), value)
    }

    root.style.setProperty('--primary-soft', `${base}1A`)
    root.style.setProperty('--primary-dim', `${base}66`)
    root.style.setProperty('--primary-glass', `${base}33`)
    root.style.setProperty('--accent-soft', `${accent}1A`)
    root.style.setProperty('--accent-dim', `${accent}66`)
    root.style.setProperty('--accent-glass', `${accent}33`)
  }, [school?.primary_color, school?.accent_color])

  return <>{children}</>
}

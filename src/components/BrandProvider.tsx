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
    if (school?.primary_color) {
      const root = document.documentElement
      const base = school.primary_color

      // Set primary root variable
      root.style.setProperty('--primary', base)

      // Generate and set all shade variables (fallback to base color)
      const palette = generateMonochromePalette(base)
      for (const [varName, value] of Object.entries(palette)) {
        root.style.setProperty(varName, value)
      }

      // Soft version (10% opacity)
      const soft = `${base}1A`
      root.style.setProperty('--primary-soft', soft)

      // Dim version (40% opacity)
      const dim = `${base}66`
      root.style.setProperty('--primary-dim', dim)

      // Glass version (20% opacity)
      const glass = `${base}33`
      root.style.setProperty('--primary-glass', glass)
    }
  }, [school?.primary_color])

  return <>{children}</>
}

'use client'
import Link from 'next/link'
import OmutoLogo from '@/components/OmutoLogo'

export function Navbar() {
  return (
    <nav className="flex items-center justify-between px-6 py-4 bg-[var(--surface)] border-b border-[var(--border)]">
      <Link href="/" className="flex items-center">
        <OmutoLogo size="md" showText={true} />
      </Link>
      <div className="flex items-center gap-4">
        <Link href="/login" className="btn btn-ghost">Sign In</Link>
        <Link href="/register" className="btn btn-primary">Start Trial</Link>
      </div>
    </nav>
  )
}

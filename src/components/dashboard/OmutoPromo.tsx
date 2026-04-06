'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import MaterialIcon from '@/components/MaterialIcon'

const OMUTO_SERVICES = [
  {
    title: 'Omuto School Xperience',
    description: 'Full school transformation with advanced features, custom branding, and dedicated support.',
    url: 'https://omuto.org/osx.php',
    icon: 'rocket_launch',
    color: '#17325F',
    bgColor: 'rgba(23,50,95,0.08)',
    cta: 'Explore OSX',
  },
  {
    title: 'Omuto Essentials',
    description: 'Affordable school management tools for small schools. Start with the basics you need.',
    url: 'https://essentials.omuto.org',
    icon: 'star',
    color: '#2E9448',
    bgColor: 'rgba(46,148,72,0.08)',
    cta: 'View Products',
  },
  {
    title: 'Omuto Youth Center',
    description: 'Empower your students with youth programs, leadership training, and community engagement.',
    url: 'https://omuto.org/oyc.php',
    icon: 'groups',
    color: '#7c3aed',
    bgColor: 'rgba(124,58,237,0.08)',
    cta: 'Learn More',
  },
]

export default function OmutoPromo() {
  const { school, isTrialExpired } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('assemble_promo_dismissed')
    if (saved) setDismissed(true)
  }, [])

  if (!mounted || dismissed) return null

  // Only show for trial or expired accounts
  const isTrial = school?.subscription_status === 'trial' || isTrialExpired
  if (!isTrial) return null

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem('assemble_promo_dismissed', 'true')
  }

  return (
    <div className="mx-2 sm:mx-4 mt-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--navy)] flex items-center justify-center">
              <MaterialIcon icon="workspace_premium" className="text-white text-sm" />
            </div>
            <div>
              <div className="text-[12px] uppercase tracking-wider font-bold text-[var(--t4)]">Upgrade your school</div>
              <div className="text-[14px] font-semibold text-[var(--t1)]">Explore Omuto services</div>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1.5 text-[var(--t4)] hover:text-[var(--t2)] transition-colors rounded-lg hover:bg-[var(--surface-container)]"
          >
            <MaterialIcon icon="close" className="text-lg" />
          </button>
        </div>

        {/* Service Cards */}
        <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {OMUTO_SERVICES.map((service) => (
            <a
              key={service.title}
              href={service.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-xl border border-[var(--border)] p-4 hover:border-[var(--navy)]/30 hover:shadow-md transition-all"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ backgroundColor: service.bgColor }}
              >
                <MaterialIcon
                  icon={service.icon}
                  className="text-xl"
                  style={{ color: service.color }}
                />
              </div>
              <div className="font-semibold text-sm text-[var(--t1)] mb-1 group-hover:text-[var(--navy)] transition-colors">
                {service.title}
              </div>
              <div className="text-xs text-[var(--t3)] leading-relaxed mb-3">
                {service.description}
              </div>
              <div
                className="inline-flex items-center gap-1 text-xs font-semibold"
                style={{ color: service.color }}
              >
                {service.cta}
                <MaterialIcon icon="arrow_forward" className="text-sm" />
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

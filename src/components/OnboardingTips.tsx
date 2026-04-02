'use client'
import Link from 'next/link'
import MaterialIcon from '@/components/MaterialIcon'

export default function OnboardingTips({ schoolId }: { schoolId?: string }) {
  const tips = [
    {
      icon: 'school',
      title: '1. Set Up Your School',
      desc: 'Configure school name, terms, and academic year',
      link: '/dashboard/setup',
      color: 'var(--navy)',
    },
    {
      icon: 'groups',
      title: '2. Add Students',
      desc: 'Register students or import from CSV/Excel',
      link: '/dashboard/students?action=add',
      color: 'var(--green)',
    },
    {
      icon: 'payments',
      title: '3. Set Fee Structure',
      desc: 'Define tuition, development, and other fees',
      link: '/dashboard/fees',
      color: 'var(--amber)',
    },
    {
      icon: 'fact_check',
      title: '4. Mark Attendance',
      desc: 'Track daily student presence',
      link: '/dashboard/attendance',
      color: 'var(--red)',
    },
  ]

  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 16,
      padding: 20,
      marginBottom: 20,
      border: '1px solid var(--border)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: 'var(--navy-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <MaterialIcon style={{ fontSize: 20, color: 'var(--navy)' }}>rocket_launch</MaterialIcon>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>
          Quick Start Guide
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {tips.map((tip, i) => (
          <Link
            key={i}
            href={tip.link}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: 14,
              borderRadius: 12,
              background: 'var(--bg)',
              textDecoration: 'none',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-container)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'var(--bg)'}
          >
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `${tip.color}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <MaterialIcon style={{ fontSize: 18, color: tip.color }}>{tip.icon}</MaterialIcon>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 2 }}>
                {tip.title}
              </div>
              <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                {tip.desc}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
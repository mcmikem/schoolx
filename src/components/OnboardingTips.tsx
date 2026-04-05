'use client'
import Link from 'next/link'
import MaterialIcon from '@/components/MaterialIcon'

export default function OnboardingTips({ schoolId }: { schoolId?: string }) {
  const tips = [
    {
      icon: 'school',
      title: 'Set Up School',
      desc: 'Configure settings',
      link: '/dashboard/setup',
      color: 'var(--navy)',
    },
    {
      icon: 'groups',
      title: 'Add Students',
      desc: 'Register or import',
      link: '/dashboard/students?action=add',
      color: 'var(--green)',
    },
    {
      icon: 'payments',
      title: 'Set Fees',
      desc: 'Define fee structure',
      link: '/dashboard/fees',
      color: 'var(--amber)',
    },
  ]

  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      border: '1px solid var(--border)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
      }}>
        <MaterialIcon style={{ fontSize: 18, color: 'var(--navy)' }}>lightbulb</MaterialIcon>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>
          Quick Links
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {tips.map((tip, i) => (
          <Link
            key={i}
            href={tip.link}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 8,
              background: 'var(--bg)',
              textDecoration: 'none',
              fontSize: 12,
              color: 'var(--t2)',
              fontWeight: 500,
            }}
          >
            <MaterialIcon style={{ fontSize: 14, color: tip.color }}>{tip.icon}</MaterialIcon>
            {tip.title}
          </Link>
        ))}
      </div>
    </div>
  )
}
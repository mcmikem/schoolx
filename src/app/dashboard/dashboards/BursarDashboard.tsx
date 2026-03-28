'use client'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useStudents, useFeePayments, useFeeStructure } from '@/lib/hooks'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
}

export default function BursarDashboard() {
  const { school, user } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const { students } = useStudents(school?.id)
  const { payments } = useFeePayments(school?.id)
  const { feeStructure } = useFeeStructure(school?.id)

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`
    if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`
    return `${amount}`
  }

  const currentDate = new Date()
  const greeting = currentDate.getHours() < 12 ? 'Good Morning' : currentDate.getHours() < 17 ? 'Good Afternoon' : 'Good Evening'

  const totalFeesExpected = students.reduce((total, student) => {
    const classFees = feeStructure.filter(f => !f.class_id || f.class_id === student.class_id)
    const studentExpected = classFees.reduce((sum, f) => sum + Number(f.amount || 0), 0)
    return total + studentExpected
  }, 0)

  const totalFeesCollected = payments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)
  const totalArrears = Math.max(0, totalFeesExpected - totalFeesCollected)
  const collectionRate = totalFeesExpected > 0 ? Math.round((totalFeesCollected / totalFeesExpected) * 100) : 0

  const todayStr = new Date().toISOString().split('T')[0]
  const todayPayments = payments.filter((p: any) => p.payment_date === todayStr)
  const todayCollected = todayPayments.reduce((sum: number, p: any) => sum + Number(p.amount_paid || 0), 0)

  return (
    <div className="content">
      {/* PAGE HEADER */}
      <div className="page-header">
        <div>
          <div className="ph-title">{greeting}, {user?.full_name?.split(' ')[0]}</div>
          <div className="ph-sub">{school?.name} • {academicYear} Term {currentTerm}</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-ghost">
            <MaterialIcon icon="download" style={{ fontSize: '16px' }} />
            Export
          </button>
          <button className="btn btn-green">
            <MaterialIcon icon="add_card" style={{ fontSize: '16px' }} />
            Record Payment
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-accent" style={{ background: 'var(--green)' }} />
          <div className="stat-inner">
            <div className="stat-meta">
              <div className="stat-label">Total Collected</div>
              <div className="stat-icon-box" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
                <MaterialIcon icon="account_balance" style={{ fontSize: '17px' }} />
              </div>
            </div>
            <div className="stat-val" style={{ color: 'var(--green)' }}>UGX <span>{formatCurrency(totalFeesCollected)}</span></div>
            <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '4px' }}>{collectionRate}% of expected</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-accent" style={{ background: 'var(--red)' }} />
          <div className="stat-inner">
            <div className="stat-meta">
              <div className="stat-label">Total Arrears</div>
              <div className="stat-icon-box" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>
                <MaterialIcon icon="warning" style={{ fontSize: '17px' }} />
              </div>
            </div>
            <div className="stat-val" style={{ color: 'var(--red)' }}>UGX <span>{formatCurrency(totalArrears)}</span></div>
            <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '4px' }}>{students.length} students</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-accent" style={{ background: 'var(--navy)' }} />
          <div className="stat-inner">
            <div className="stat-meta">
              <div className="stat-label">Expected Total</div>
              <div className="stat-icon-box" style={{ background: 'var(--navy-soft)', color: 'var(--navy)' }}>
                <MaterialIcon icon="calculate" style={{ fontSize: '17px' }} />
              </div>
            </div>
            <div className="stat-val" style={{ color: 'var(--navy)' }}>UGX <span>{formatCurrency(totalFeesExpected)}</span></div>
            <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '4px' }}>For {students.length} students</div>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <Link href="/dashboard/fees" className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--green-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
            <MaterialIcon icon="add_card" style={{ fontSize: 20, color: 'var(--green)' }} />
          </div>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--t1)' }}>Record Payment</div>
            <div style={{ fontSize: 10, color: 'var(--t3)' }}>Add new payment</div>
          </div>
        </Link>
        <Link href="/dashboard/fees" className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--navy-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
            <MaterialIcon icon="receipt_long" style={{ fontSize: 20, color: 'var(--navy)' }} />
          </div>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--t1)' }}>Fee Structure</div>
            <div style={{ fontSize: 10, color: 'var(--t3)' }}>Manage fees</div>
          </div>
        </Link>
        <Link href="/dashboard/invoicing" className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
            <MaterialIcon icon="description" style={{ fontSize: 20, color: '#7C3AED' }} />
          </div>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--t1)' }}>Invoicing</div>
            <div style={{ fontSize: 10, color: 'var(--t3)' }}>Generate invoices</div>
          </div>
        </Link>
        <Link href="/dashboard/cashbook" className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--amber-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
            <MaterialIcon icon="book" style={{ fontSize: 20, color: 'var(--amber)' }} />
          </div>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--t1)' }}>Cashbook</div>
            <div style={{ fontSize: 10, color: 'var(--t3)' }}>View transactions</div>
          </div>
        </Link>
      </div>

      {/* COLLECTION PROGRESS */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Collection Progress - Term {currentTerm}</div>
            <div className="card-sub">Fee collection overview</div>
          </div>
          <span className="badge badge-green">{collectionRate}%</span>
        </div>
        <div className="card-body">
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(collectionRate, 100)}%`, height: '100%', background: 'var(--green)', borderRadius: 99 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '11px', color: 'var(--t3)' }}>
            <span>{formatCurrency(totalFeesCollected)} collected</span>
            <span>{formatCurrency(totalFeesExpected)} expected</span>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useStudents, useFeePayments, useFeeStructure } from '@/lib/hooks'
import MaterialIcon from '@/components/MaterialIcon'
import ErrorBoundary from '@/components/ErrorBoundary'
import { StatsGridSkeleton } from '@/components/Skeletons'

import StatCard from '@/components/dashboard/StatCard'

function BursarDashboardContent() {
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

  return (
    <div className="content">
      <div className="page-header">
        <div>
          <div className="ph-title">{greeting}, {user?.full_name?.split(' ')[0]}</div>
          <div className="ph-sub">{school?.name} • {currentDate.toLocaleDateString('en-UG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
        <div className="ph-actions">
          <Link href="/dashboard/reports" className="btn btn-ghost">
            <MaterialIcon icon="download"  />
            Export
          </Link>
          <Link href="/dashboard/fees" className="btn btn-primary">
            <MaterialIcon icon="add_card"  />
            Record Payment
          </Link>
        </div>
      </div>

      <div className="stat-grid sm:grid-cols-3">
        <StatCard label="Total Collected" value={`UGX ${formatCurrency(totalFeesCollected)}`} subValue={`${collectionRate}% of expected`} icon="account_balance" accentColor="green" />
        <StatCard label="Total Arrears" value={`UGX ${formatCurrency(totalArrears)}`} subValue={`${students.length} students`} icon="warning" accentColor="red" />
        <StatCard label="Expected Total" value={`UGX ${formatCurrency(totalFeesExpected)}`} subValue={`Term ${currentTerm}`} icon="calculate" accentColor="navy" />
      </div>

      <div className="mb-6">
        <div className="mb-3">
          <h3 className="text-sm font-bold text-[var(--t1)]">Finance Actions</h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Link href="/dashboard/fees" className="qa-item !flex-row !justify-start !p-4">
            <div className="qa-icon" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
              <MaterialIcon icon="add_card" style={{ fontSize: 20 }} />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-[var(--t1)] truncate">Record Payment</div>
              <div className="text-[10px] text-[var(--t3)] font-medium truncate">Add new entry</div>
            </div>
          </Link>
          <Link href="/dashboard/fees" className="qa-item !flex-row !justify-start !p-4">
            <div className="qa-icon" style={{ background: 'var(--navy-soft)', color: 'var(--navy)' }}>
              <MaterialIcon icon="receipt_long" style={{ fontSize: 20 }} />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-[var(--t1)] truncate">Fee Structure</div>
              <div className="text-[10px] text-[var(--t3)] font-medium truncate">Manage fees</div>
            </div>
          </Link>
          <Link href="/dashboard/invoicing" className="qa-item !flex-row !justify-start !p-4">
            <div className="qa-icon" style={{ background: 'var(--navy-soft)', color: 'var(--navy)' }}>
              <MaterialIcon icon="description" style={{ fontSize: 20 }} />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-[var(--t1)] truncate">Invoicing</div>
              <div className="text-[10px] text-[var(--t3)] font-medium truncate">Generate docs</div>
            </div>
          </Link>
          <Link href="/dashboard/cashbook" className="qa-item !flex-row !justify-start !p-4">
            <div className="qa-icon" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>
              <MaterialIcon icon="book" style={{ fontSize: 20 }} />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-[var(--t1)] truncate">Cashbook</div>
              <div className="text-[10px] text-[var(--t3)] font-medium truncate">Audit logs</div>
            </div>
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Collection Progress · Term {currentTerm}</div>
            <div className="card-sub">{academicYear} academic cycle</div>
          </div>
          <span className="badge badge-green font-mono">{collectionRate}%</span>
        </div>
        <div className="card-body">
          <div className="h-2.5 bg-[var(--bg)] rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-[var(--green)] rounded-full transition-all duration-500"
              style={{ width: `${Math.min(collectionRate, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--t3)]">
            <div className="flex flex-col">
              <span>Collected</span>
              <span className="text-[var(--t1)] text-xs mt-0.5">UGX {formatCurrency(totalFeesCollected)}</span>
            </div>
            <div className="flex flex-col text-right">
              <span>Expected</span>
              <span className="text-[var(--navy)] text-xs mt-0.5">UGX {formatCurrency(totalFeesExpected)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BursarDashboard() {
  return (
    <ErrorBoundary>
      <BursarDashboardContent />
    </ErrorBoundary>
  )
}
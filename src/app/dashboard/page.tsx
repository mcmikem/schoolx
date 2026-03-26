'use client'
import { useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useDashboardStats, useStudents, useFeePayments, useFeeStructure } from '@/lib/hooks'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

export default function DashboardPage() {
  const { school, user } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const { stats, loading: statsLoading } = useDashboardStats(school?.id)
  const { students, loading: studentsLoading } = useStudents(school?.id)
  const { payments } = useFeePayments(school?.id)
  const { feeStructure } = useFeeStructure(school?.id)

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `UGX ${(amount / 1000000).toFixed(1)}M`
    if (amount >= 1000) return `UGX ${(amount / 1000).toFixed(0)}K`
    return `UGX ${amount}`
  }

  const currentDate = new Date()
  const formattedDate = currentDate.toLocaleDateString('en-UG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const totalFeesExpected = useMemo(() => {
    return feeStructure.reduce((sum, f) => sum + Number(f.amount || 0), 0) * Math.max(students.length, 1)
  }, [feeStructure, students])

  const totalFeesCollected = useMemo(() => {
    return payments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)
  }, [payments])

  const boysCount = students.filter(s => s.gender === 'M').length
  const girlsCount = students.filter(s => s.gender === 'F').length

  return (
    <div className="space-y-8">
      {/* Header & Top Actions */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="font-headline font-bold text-3xl text-primary tracking-tight mb-2">
            Dashboard Overview
          </h2>
          <p className="text-on-surface-variant text-sm font-medium">{formattedDate}</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-outline-variant/30 text-primary font-semibold text-sm hover:bg-surface-container-low transition-all">
            <MaterialIcon icon="receipt_long" className="text-lg" />
            Generate Report
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/10">
            <MaterialIcon icon="add" className="text-lg" />
            Quick Action
          </button>
        </div>
      </header>

      {/* Summary Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Students Card */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border-t-4 border-primary relative overflow-hidden group hover:bg-surface-bright transition-colors duration-300">
          <div className="flex justify-between items-start mb-4">
            <MaterialIcon icon="group" className="text-primary bg-primary-fixed p-2 rounded-lg" style={{ fontVariationSettings: 'FILL 1' }} />
            <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant opacity-60">Total</span>
          </div>
          <p className="text-on-surface-variant text-xs font-semibold uppercase tracking-wider mb-1">Enrolled Students</p>
          <h3 className="font-headline font-extrabold text-2xl text-on-surface tracking-tight">
            {studentsLoading ? '...' : students.length}
          </h3>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex-1 h-1.5 bg-surface-container rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${students.length > 0 ? (boysCount / students.length) * 100 : 0}%` }}></div>
            </div>
            <span className="text-[11px] font-bold text-primary">{boysCount} Boys</span>
            <span className="text-[11px] font-bold text-tertiary">{girlsCount} Girls</span>
          </div>
        </div>

        {/* Attendance Card */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border-t-4 border-secondary relative overflow-hidden group hover:bg-surface-bright transition-colors duration-300">
          <div className="flex justify-between items-start mb-4">
            <MaterialIcon icon="event_available" className="text-secondary bg-secondary-container p-2 rounded-lg" style={{ fontVariationSettings: 'FILL 1' }} />
            <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant opacity-60">Today</span>
          </div>
          <p className="text-on-surface-variant text-xs font-semibold uppercase tracking-wider mb-1">Present Today</p>
          <h3 className="font-headline font-extrabold text-2xl text-on-surface tracking-tight">
            {statsLoading ? '...' : stats.presentToday}
          </h3>
          <div className="mt-4 flex items-center gap-2 text-[11px] font-bold text-secondary">
            <MaterialIcon icon="check_circle" className="text-sm" />
            <span>{students.length > 0 ? Math.round((stats.presentToday / students.length) * 100) : 0}% Attendance</span>
          </div>
        </div>

        {/* Fees Card */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border-t-4 border-tertiary-fixed-dim relative overflow-hidden group hover:bg-surface-bright transition-colors duration-300">
          <div className="flex justify-between items-start mb-4">
            <MaterialIcon icon="account_balance_wallet" className="text-tertiary bg-tertiary-fixed p-2 rounded-lg" style={{ fontVariationSettings: 'FILL 1' }} />
            <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant opacity-60">Collection</span>
          </div>
          <p className="text-on-surface-variant text-xs font-semibold uppercase tracking-wider mb-1">Fees Collected</p>
          <h3 className="font-headline font-extrabold text-2xl text-on-surface tracking-tight">
            {formatCurrency(totalFeesCollected)}
          </h3>
          <div className="mt-4 flex items-center gap-2 text-[11px] font-bold text-on-tertiary-fixed-variant">
            <MaterialIcon icon="trending_up" className="text-sm" />
            <span>{totalFeesExpected > 0 ? Math.round((totalFeesCollected / totalFeesExpected) * 100) : 0}% of Target</span>
          </div>
        </div>
      </div>

      {/* Quick Actions & Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-2 bg-surface-container-low rounded-xl p-6">
          <h3 className="font-headline font-bold text-lg text-primary mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/dashboard/attendance" className="flex flex-col items-center gap-3 p-4 bg-surface-container-lowest rounded-xl hover:bg-primary-fixed transition-colors group">
              <div className="w-12 h-12 bg-primary-container rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <MaterialIcon icon="check_circle" className="text-primary text-xl" style={{ fontVariationSettings: 'FILL 1' }} />
              </div>
              <span className="text-xs font-bold text-on-surface-variant text-center">Mark Attendance</span>
            </Link>
            <Link href="/dashboard/grades" className="flex flex-col items-center gap-3 p-4 bg-surface-container-lowest rounded-xl hover:bg-primary-fixed transition-colors group">
              <div className="w-12 h-12 bg-secondary-container rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <MaterialIcon icon="menu_book" className="text-secondary text-xl" style={{ fontVariationSettings: 'FILL 1' }} />
              </div>
              <span className="text-xs font-bold text-on-surface-variant text-center">Enter Grades</span>
            </Link>
            <Link href="/dashboard/fees" className="flex flex-col items-center gap-3 p-4 bg-surface-container-lowest rounded-xl hover:bg-primary-fixed transition-colors group">
              <div className="w-12 h-12 bg-tertiary-fixed rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <MaterialIcon icon="payments" className="text-tertiary text-xl" style={{ fontVariationSettings: 'FILL 1' }} />
              </div>
              <span className="text-xs font-bold text-on-surface-variant text-center">Record Payment</span>
            </Link>
            <Link href="/dashboard/messages" className="flex flex-col items-center gap-3 p-4 bg-surface-container-lowest rounded-xl hover:bg-primary-fixed transition-colors group">
              <div className="w-12 h-12 bg-primary-fixed rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <MaterialIcon icon="chat" className="text-on-primary-fixed text-xl" style={{ fontVariationSettings: 'FILL 1' }} />
              </div>
              <span className="text-xs font-bold text-on-surface-variant text-center">Send Message</span>
            </Link>
          </div>
        </div>

        {/* Academic Info */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10">
          <h3 className="font-headline font-bold text-primary mb-4">Academic Term</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-surface-container rounded-lg">
              <div className="flex items-center gap-3">
                <MaterialIcon icon="calendar_today" className="text-primary" />
                <span className="text-sm font-medium">Academic Year</span>
              </div>
              <span className="text-sm font-bold text-primary">{academicYear}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-container rounded-lg">
              <div className="flex items-center gap-3">
                <MaterialIcon icon="school" className="text-secondary" />
                <span className="text-sm font-medium">Current Term</span>
              </div>
              <span className="text-sm font-bold text-primary">Term {currentTerm}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-container rounded-lg">
              <div className="flex items-center gap-3">
                <MaterialIcon icon="location_on" className="text-tertiary" />
                <span className="text-sm font-medium">District</span>
              </div>
              <span className="text-sm font-bold text-primary">{school?.district || 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant/5">
        <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between">
          <h4 className="font-headline font-bold text-primary">Recent Activity</h4>
          <button className="text-xs font-bold text-primary hover:underline">View All</button>
        </div>
        <div className="divide-y divide-outline-variant/5">
          <div className="flex items-center gap-4 p-4 hover:bg-surface-bright transition-colors">
            <div className="w-10 h-10 rounded-lg bg-secondary-container flex items-center justify-center">
              <MaterialIcon icon="payments" className="text-secondary text-lg" style={{ fontVariationSettings: 'FILL 1' }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-on-surface">Payment received from Ssekitoleko Marvin</p>
              <p className="text-[11px] text-on-surface-variant">UGX 850,000 • MTN MoMo</p>
            </div>
            <span className="text-[10px] text-on-surface-variant">2h ago</span>
          </div>
          <div className="flex items-center gap-4 p-4 hover:bg-surface-bright transition-colors">
            <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center">
              <MaterialIcon icon="person_add" className="text-primary text-lg" style={{ fontVariationSettings: 'FILL 1' }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-on-surface">New student enrolled</p>
              <p className="text-[11px] text-on-surface-variant">Nakato Sarah • Grade 10</p>
            </div>
            <span className="text-[10px] text-on-surface-variant">5h ago</span>
          </div>
          <div className="flex items-center gap-4 p-4 hover:bg-surface-bright transition-colors">
            <div className="w-10 h-10 rounded-lg bg-tertiary-fixed flex items-center justify-center">
              <MaterialIcon icon="grade" className="text-tertiary text-lg" style={{ fontVariationSettings: 'FILL 1' }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-on-surface">Grades submitted</p>
              <p className="text-[11px] text-on-surface-variant">Mathematics • S.4 Science A</p>
            </div>
            <span className="text-[10px] text-on-surface-variant">1d ago</span>
          </div>
        </div>
      </div>
    </div>
  )
}
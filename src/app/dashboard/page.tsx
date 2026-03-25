'use client'
import { useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useDashboardStats, useStudents, useFeePayments, useFeeStructure } from '@/lib/hooks'

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

  const quickActions = [
    { label: 'Mark Attendance', href: '/dashboard/attendance', color: 'blue' },
    { label: 'Enter Grades', href: '/dashboard/grades', color: 'green' },
    { label: 'Record Payment', href: '/dashboard/fees', color: 'yellow' },
    { label: 'Send Message', href: '/dashboard/messages', color: 'purple' },
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome back, {user?.full_name?.split(' ')[0] || 'User'}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{formattedDate}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              {statsLoading ? (
                <div className="skeleton w-16 h-6" />
              ) : (
                <div className="stat-value">{students.length}</div>
              )}
              <div className="stat-label">Students</div>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              {statsLoading ? (
                <div className="skeleton w-16 h-6" />
              ) : (
                <div className="stat-value">{stats.presentToday}</div>
              )}
              <div className="stat-label">Present Today</div>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              {statsLoading ? (
                <div className="skeleton w-16 h-6" />
              ) : (
                <div className="stat-value">{formatCurrency(totalFeesCollected)}</div>
              )}
              <div className="stat-label">Fees Collected</div>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              {statsLoading ? (
                <div className="skeleton w-16 h-6" />
              ) : (
                <div className="stat-value">{formatCurrency(Math.max(0, totalFeesExpected - totalFeesCollected))}</div>
              )}
              <div className="stat-label">Fees Balance</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="card flex items-center gap-3 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md transition-all"
            >
              <div className={`w-10 h-10 bg-${action.color}-50 dark:bg-${action.color}-900/30 rounded-lg flex items-center justify-center`}>
                <svg className={`w-5 h-5 text-${action.color}-600 dark:text-${action.color}-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Student Summary</h2>
          {studentsLoading ? (
            <div className="space-y-3">
              <div className="skeleton w-full h-8" />
              <div className="skeleton w-full h-8" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Total Students</span>
                <span className="font-semibold text-gray-900 dark:text-white">{students.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Boys</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">{boysCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Girls</span>
                <span className="font-semibold text-pink-600 dark:text-pink-400">{girlsCount}</span>
              </div>
              {students.length > 0 && (
                <div className="mt-4">
                  <div className="flex gap-1 h-3 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-500" 
                      style={{ width: `${(boysCount / students.length) * 100}%` }}
                    />
                    <div 
                      className="bg-pink-500" 
                      style={{ width: `${(girlsCount / students.length) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>Boys {Math.round((boysCount / students.length) * 100)}%</span>
                    <span>Girls {Math.round((girlsCount / students.length) * 100)}%</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Term Information</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Academic Year</span>
              <span className="font-semibold text-gray-900 dark:text-white">{academicYear}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Current Term</span>
              <span className="font-semibold text-gray-900 dark:text-white">Term {currentTerm}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">School Code</span>
              <span className="font-semibold text-gray-900 dark:text-white">{school?.school_code || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">District</span>
              <span className="font-semibold text-gray-900 dark:text-white">{school?.district || 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

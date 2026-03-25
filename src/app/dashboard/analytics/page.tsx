'use client'
import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useStudents, useFeePayments, useFeeStructure, useClasses } from '@/lib/hooks'
import { supabase } from '@/lib/supabase'

interface HealthMetric {
  name: string
  score: number
  maxScore: number
  status: 'excellent' | 'good' | 'warning' | 'critical'
  description: string
}

export default function AnalyticsPage() {
  const { school } = useAuth()
  const { students } = useStudents(school?.id)
  const { payments } = useFeePayments(school?.id)
  const { feeStructure } = useFeeStructure(school?.id)
  const { classes } = useClasses(school?.id)

  const [grades, setGrades] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Calculate all health metrics
  const healthMetrics: HealthMetric[] = useMemo(() => {
    const metrics: HealthMetric[] = []

    // 1. Fee Collection Rate
    const totalExpected = feeStructure.reduce((sum, f) => sum + Number(f.amount || 0), 0) * Math.max(students.length, 1)
    const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)
    const feeRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0
    metrics.push({
      name: 'Fee Collection',
      score: Math.min(feeRate, 100),
      maxScore: 100,
      status: feeRate >= 80 ? 'excellent' : feeRate >= 60 ? 'good' : feeRate >= 40 ? 'warning' : 'critical',
      description: `${feeRate}% of expected fees collected`
    })

    // 2. Student Enrollment
    const boysCount = students.filter(s => s.gender === 'M').length
    const girlsCount = students.filter(s => s.gender === 'F').length
    const genderBalance = students.length > 0 ? Math.round((Math.min(boysCount, girlsCount) / Math.max(boysCount, girlsCount, 1)) * 100) : 0
    metrics.push({
      name: 'Gender Balance',
      score: genderBalance,
      maxScore: 100,
      status: genderBalance >= 45 ? 'excellent' : genderBalance >= 35 ? 'good' : genderBalance >= 25 ? 'warning' : 'critical',
      description: `Boys: ${boysCount}, Girls: ${girlsCount}`
    })

    // 3. Class Distribution
    const avgStudentsPerClass = classes.length > 0 ? Math.round(students.length / classes.length) : 0
    const classScore = avgStudentsPerClass <= 50 ? 100 : avgStudentsPerClass <= 60 ? 80 : avgStudentsPerClass <= 70 ? 60 : 40
    metrics.push({
      name: 'Class Sizes',
      score: classScore,
      maxScore: 100,
      status: classScore >= 80 ? 'excellent' : classScore >= 60 ? 'good' : classScore >= 40 ? 'warning' : 'critical',
      description: `Average ${avgStudentsPerClass} students per class`
    })

    // 4. Active Students Rate
    const activeStudents = students.filter(s => s.status === 'active').length
    const activeRate = students.length > 0 ? Math.round((activeStudents / students.length) * 100) : 0
    metrics.push({
      name: 'Student Retention',
      score: activeRate,
      maxScore: 100,
      status: activeRate >= 95 ? 'excellent' : activeRate >= 85 ? 'good' : activeRate >= 75 ? 'warning' : 'critical',
      description: `${activeRate}% students active`
    })

    return metrics
  }, [students, payments, feeStructure, classes])

  // Overall health score
  const overallScore = useMemo(() => {
    const total = healthMetrics.reduce((sum, m) => sum + m.score, 0)
    return Math.round(total / healthMetrics.length)
  }, [healthMetrics])

  const overallStatus = overallScore >= 80 ? 'Excellent' : overallScore >= 60 ? 'Good' : overallScore >= 40 ? 'Needs Attention' : 'Critical'

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'bg-green-100 text-green-700 border-green-200'
      case 'good': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'warning': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'critical': return 'bg-red-100 text-red-700 border-red-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-blue-600'
    if (score >= 40) return 'text-yellow-600'
    return 'text-red-600'
  }

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `UGX ${(amount / 1000000).toFixed(1)}M`
    if (amount >= 1000) return `UGX ${(amount / 1000).toFixed(0)}K`
    return `UGX ${amount}`
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">School Health Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of your school's performance</p>
      </div>

      {/* Overall Health Score */}
      <div className="card mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-blue-700 mb-1">Overall Health Score</div>
            <div className={`text-5xl font-bold ${getScoreColor(overallScore)}`}>{overallScore}</div>
            <div className="text-sm text-gray-600 mt-1">{overallStatus}</div>
          </div>
          <div className="w-32 h-32 relative">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="64" cy="64" r="56" fill="none" stroke="#e5e7eb" strokeWidth="12" />
              <circle
                cx="64" cy="64" r="56" fill="none"
                stroke={overallScore >= 80 ? '#22c55e' : overallScore >= 60 ? '#3b82f6' : overallScore >= 40 ? '#f59e0b' : '#ef4444'}
                strokeWidth="12"
                strokeDasharray={`${(overallScore / 100) * 352} 352`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-2xl font-bold ${getScoreColor(overallScore)}`}>{overallScore}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="stat-card">
          <div className="stat-value">{students.length}</div>
          <div className="stat-label">Total Students</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{classes.length}</div>
          <div className="stat-label">Classes</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-green-600">{formatCurrency(payments.reduce((s, p) => s + Number(p.amount_paid), 0))}</div>
          <div className="stat-label">Fees Collected</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{students.filter(s => s.gender === 'M').length}/{students.filter(s => s.gender === 'F').length}</div>
          <div className="stat-label">Boys/Girls</div>
        </div>
      </div>

      {/* Health Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {healthMetrics.map((metric, i) => (
          <div key={i} className={`card border ${getStatusColor(metric.status)}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-gray-900">{metric.name}</span>
              <span className={`badge ${getStatusColor(metric.status)}`}>{metric.status}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className={`text-3xl font-bold ${getScoreColor(metric.score)}`}>{metric.score}</div>
              <div className="flex-1">
                <div className="progress">
                  <div 
                    className={`progress-fill ${
                      metric.status === 'excellent' ? 'bg-green-500' :
                      metric.status === 'good' ? 'bg-blue-500' :
                      metric.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${metric.score}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 mt-2">{metric.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Class Performance */}
      <div className="card mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Class Distribution</h2>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Students</th>
                <th>Boys</th>
                <th>Girls</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {classes.map(cls => {
                const classStudents = students.filter(s => s.class_id === cls.id)
                const boys = classStudents.filter(s => s.gender === 'M').length
                const girls = classStudents.filter(s => s.gender === 'F').length
                const capacity = cls.max_students || 60
                const utilization = Math.round((classStudents.length / capacity) * 100)
                
                return (
                  <tr key={cls.id}>
                    <td className="font-medium">{cls.name}</td>
                    <td>{classStudents.length}</td>
                    <td className="text-blue-600">{boys}</td>
                    <td className="text-pink-600">{girls}</td>
                    <td>
                      <span className={`badge ${
                        utilization <= 80 ? 'badge-success' :
                        utilization <= 100 ? 'badge-warning' : 'badge-danger'
                      }`}>
                        {utilization}% capacity
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recommendations */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h2>
        <div className="space-y-3">
          {healthMetrics.filter(m => m.status === 'warning' || m.status === 'critical').map((metric, i) => (
            <div key={i} className="flex items-start gap-3 p-4 bg-yellow-50 rounded-lg border border-yellow-100">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <div className="font-medium text-yellow-800">{metric.name}</div>
                <div className="text-sm text-yellow-700">{metric.description}</div>
              </div>
            </div>
          ))}
          {healthMetrics.every(m => m.status === 'excellent' || m.status === 'good') && (
            <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg border border-green-100">
              <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="font-medium text-green-800">School performing well</div>
                <div className="text-sm text-green-700">All metrics are in good standing. Keep up the good work!</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

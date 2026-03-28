'use client'
import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useStudents, useFeePayments, useFeeStructure, useClasses } from '@/lib/hooks'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

interface HealthMetric {
  name: string
  score: number
  maxScore: number
  status: 'excellent' | 'good' | 'warning' | 'critical'
  description: string
}

export default function AnalyticsPage() {
  const { school } = useAuth()
  const { students = [] } = useStudents(school?.id)
  const { payments = [] } = useFeePayments(school?.id)
  const { feeStructure = [] } = useFeeStructure(school?.id)
  const { classes = [] } = useClasses(school?.id)

  const [grades, setGrades] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const healthMetrics: HealthMetric[] = useMemo(() => {
    const metrics: HealthMetric[] = []

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

    const avgStudentsPerClass = classes.length > 0 ? Math.round(students.length / classes.length) : 0
    const classScore = avgStudentsPerClass <= 50 ? 100 : avgStudentsPerClass <= 60 ? 80 : avgStudentsPerClass <= 70 ? 60 : 40
    metrics.push({
      name: 'Class Sizes',
      score: classScore,
      maxScore: 100,
      status: classScore >= 80 ? 'excellent' : classScore >= 60 ? 'good' : classScore >= 40 ? 'warning' : 'critical',
      description: `Average ${avgStudentsPerClass} students per class`
    })

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

  const overallScore = useMemo(() => {
    const total = healthMetrics.reduce((sum, m) => sum + m.score, 0)
    return Math.round(total / healthMetrics.length)
  }, [healthMetrics])

  const overallStatus = overallScore >= 80 ? 'Excellent' : overallScore >= 60 ? 'Good' : overallScore >= 40 ? 'Needs Attention' : 'Critical'

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'bg-[#e8f5e9] text-[#006e1c] border-[#006e1c]'
      case 'good': return 'bg-[#e3f2fd] text-[#002045] border-[#002045]'
      case 'warning': return 'bg-[#fff3e0] text-[#b86e00] border-[#b86e00]'
      case 'critical': return 'bg-[#fef2f2] text-[#ba1a1a] border-[#ba1a1a]'
      default: return 'bg-[#f8fafb] text-[#5c6670] border-[#e8eaed]'
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-[#006e1c]'
    if (score >= 60) return 'text-[#002045]'
    if (score >= 40) return 'text-[#b86e00]'
    return 'text-[#ba1a1a]'
  }

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'excellent': return 'from-[#e8f5e9] to-[#c8e6c9]'
      case 'good': return 'from-[#e3f2fd] to-[#bbdefb]'
      case 'warning': return 'from-[#fff3e0] to-[#ffe0b2]'
      case 'critical': return 'from-[#fef2f2] to-[#ffcdd2]'
      default: return 'from-[#f8fafb] to-[#f1f5f9]'
    }
  }

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `UGX ${(amount / 1000000).toFixed(1)}M`
    if (amount >= 1000) return `UGX ${(amount / 1000).toFixed(0)}K`
    return `UGX ${amount}`
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#002045]">School Health Dashboard</h1>
        <p className="text-[#5c6670] mt-1">Overview of your school&apos;s performance</p>
      </div>

      <div className={`bg-gradient-to-r ${getStatusBg(overallScore >= 80 ? 'excellent' : overallScore >= 60 ? 'good' : overallScore >= 40 ? 'warning' : 'critical')} rounded-2xl border border-[#e8eaed] p-6 mb-8`}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <div className="text-sm font-medium text-[#5c6670] mb-1">Overall Health Score</div>
            <div className={`text-5xl font-bold ${getScoreColor(overallScore)}`}>{overallScore}</div>
            <div className="text-sm text-[#5c6670] mt-1">{overallStatus}</div>
          </div>
          <div className="w-32 h-32 relative">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="64" cy="64" r="56" fill="none" stroke="#e8eaed" strokeWidth="12" />
              <circle
                cx="64" cy="64" r="56" fill="none"
                stroke={overallScore >= 80 ? '#006e1c' : overallScore >= 60 ? '#002045' : overallScore >= 40 ? '#b86e00' : '#ba1a1a'}
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
          <div className="text-2xl font-bold text-[#002045]">{students.length}</div>
          <div className="text-sm text-[#5c6670] mt-1">Total Students</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
          <div className="text-2xl font-bold text-[#002045]">{classes.length}</div>
          <div className="text-sm text-[#5c6670] mt-1">Classes</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
          <div className="text-2xl font-bold text-[#006e1c]">{formatCurrency(payments.reduce((s, p) => s + Number(p.amount_paid), 0))}</div>
          <div className="text-sm text-[#5c6670] mt-1">Fees Collected</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
          <div className="text-2xl font-bold text-[#002045]">{students.filter(s => s.gender === 'M').length}/{students.filter(s => s.gender === 'F').length}</div>
          <div className="text-sm text-[#5c6670] mt-1">Boys/Girls</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {healthMetrics.map((metric, i) => (
          <div key={i} className={`bg-white rounded-2xl border border-[#e8eaed] p-6 ${getStatusColor(metric.status)} bg-opacity-50`}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-[#191c1d]">{metric.name}</span>
              <span className={`px-3 py-1 rounded-lg text-xs font-medium ${getStatusColor(metric.status)}`}>{metric.status}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className={`text-3xl font-bold ${getScoreColor(metric.score)}`}>{metric.score}</div>
              <div className="flex-1">
                <div className="h-2 bg-[#e8eaed] rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      metric.status === 'excellent' ? 'bg-[#006e1c]' :
                      metric.status === 'good' ? 'bg-[#002045]' :
                      metric.status === 'warning' ? 'bg-[#b86e00]' : 'bg-[#ba1a1a]'
                    }`}
                    style={{ width: `${metric.score}%` }}
                  />
                </div>
                <p className="text-sm text-[#5c6670] mt-2">{metric.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 mb-8">
        <h2 className="text-lg font-semibold text-[#191c1d] mb-4">Class Distribution</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#f8fafb]">
              <tr>
                <th className="text-left p-4 text-sm font-semibold text-[#191c1d]">Class</th>
                <th className="text-left p-4 text-sm font-semibold text-[#191c1d]">Students</th>
                <th className="text-left p-4 text-sm font-semibold text-[#191c1d]">Boys</th>
                <th className="text-left p-4 text-sm font-semibold text-[#191c1d]">Girls</th>
                <th className="text-left p-4 text-sm font-semibold text-[#191c1d]">Status</th>
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
                  <tr key={cls.id} className="border-t border-[#e8eaed]">
                    <td className="p-4 font-medium text-[#191c1d]">{cls.name}</td>
                    <td className="p-4 text-[#191c1d]">{classStudents.length}</td>
                    <td className="p-4 text-[#002045]">{boys}</td>
                    <td className="p-4 text-[#006e1c]">{girls}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                        utilization <= 80 ? 'bg-[#e8f5e9] text-[#006e1c]' :
                        utilization <= 100 ? 'bg-[#fff3e0] text-[#b86e00]' : 'bg-[#fef2f2] text-[#ba1a1a]'
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

      <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
        <h2 className="text-lg font-semibold text-[#191c1d] mb-4">Recommendations</h2>
        <div className="space-y-3">
          {healthMetrics.filter(m => m.status === 'warning' || m.status === 'critical').map((metric, i) => (
            <div key={i} className="flex items-start gap-3 p-4 bg-[#fff3e0] rounded-xl border border-[#b86e00]/20">
              <MaterialIcon icon="warning" className="text-[#b86e00] mt-0.5" />
              <div>
                <div className="font-medium text-[#321b00]">{metric.name}</div>
                <div className="text-sm text-[#5c6670]">{metric.description}</div>
              </div>
            </div>
          ))}
          {healthMetrics.every(m => m.status === 'excellent' || m.status === 'good') && (
            <div className="flex items-start gap-3 p-4 bg-[#e8f5e9] rounded-xl border border-[#006e1c]/20">
              <MaterialIcon icon="check_circle" className="text-[#006e1c] mt-0.5" />
              <div>
                <div className="font-medium text-[#002045]">School performing well</div>
                <div className="text-sm text-[#5c6670]">All metrics are in good standing. Keep up the good work!</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
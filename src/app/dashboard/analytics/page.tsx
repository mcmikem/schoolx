'use client'
import { useAuth } from '@/lib/auth-context'
import { useAnalytics } from '@/lib/hooks'
import GlassCard from '@/components/GlassCard'
import MaterialIcon from '@/components/MaterialIcon'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

export default function AnalyticsPage() {
  const { school } = useAuth()
  const { data, loading } = useAnalytics(school?.id)

  if (loading) return <div className="p-8 text-white">Calculating insights...</div>

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Executive Insights</h1>
          <p className="text-white/60">Strategic analytics for school management</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
            <p className="text-[10px] text-green-400 font-bold uppercase">Health Score</p>
            <p className="text-xl font-bold text-white">84%</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <GlassCard className="space-y-2">
          <p className="text-xs text-white/40 font-bold uppercase">Total Students</p>
          <p className="text-3xl font-bold text-white">{data.stats.totalStudents}</p>
          <div className="flex items-center gap-1 text-green-400 text-xs">
            <MaterialIcon icon="trending_up" className="text-sm" />
            <span>+2% vs last term</span>
          </div>
        </GlassCard>
        <GlassCard className="space-y-2">
          <p className="text-xs text-white/40 font-bold uppercase">Fee Collection</p>
          <p className="text-3xl font-bold text-white">{Math.round(data.stats.feeCollectionRate)}%</p>
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-blue-500" style={{ width: `${data.stats.feeCollectionRate}%` }} />
          </div>
        </GlassCard>
        <GlassCard className="space-y-2">
          <p className="text-xs text-white/40 font-bold uppercase">Avg. Attendance</p>
          <p className="text-3xl font-bold text-white">92%</p>
          <p className="text-xs text-white/40 italic">Last 30 days</p>
        </GlassCard>
        <GlassCard className="space-y-2">
          <p className="text-xs text-white/40 font-bold uppercase">Projected Revenue</p>
          <p className="text-xl font-bold text-white">UGX {data.stats.projectedRevenue.toLocaleString()}</p>
          <p className="text-xs text-purple-400 font-bold uppercase">Term Total</p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <GlassCard>
          <h2 className="text-xl font-bold text-white mb-6">Revenue vs. Outstanding</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.revenueProjections}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill="#3b82f6" />
                  <Cell fill="rgba(255,255,255,0.05)" />
                </Pie>
                <Tooltip 
                  contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '12px', fontSize: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-8 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <p className="text-xs text-white/60">Collected</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-white/10" />
              <p className="text-xs text-white/60">Outstanding</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">At-Risk Students</h2>
            <span className="px-2 py-1 bg-red-500/20 text-red-400 text-[10px] font-bold rounded uppercase">High Priority</span>
          </div>
          <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
            {data.atRiskStudents.map((s: any) => (
              <div key={s.student_id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.08] transition-colors">
                <div>
                  <p className="text-sm font-bold text-white">{s.full_name}</p>
                  <p className="text-xs text-white/40">{s.class_name} · {s.risk_reason.replace('_', ' ')}</p>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-bold ${s.attendance_rate < 75 ? 'text-red-400' : 'text-white/60'}`}>
                    Att: {Math.round(s.attendance_rate)}%
                  </p>
                  <p className={`text-[10px] ${s.avg_score < 50 ? 'text-red-400' : 'text-white/40'}`}>
                    Avg: {Math.round(s.avg_score)}%
                  </p>
                </div>
              </div>
            ))}
            {data.atRiskStudents.length === 0 && (
              <div className="text-center py-8">
                <MaterialIcon icon="check_circle" className="text-green-400 text-3xl mb-2" />
                <p className="text-sm text-white/60">All students are meeting thresholds</p>
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <GlassCard className="lg:col-span-2">
          <h2 className="text-xl font-bold text-white mb-6">Gender Distribution per Class</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.genderDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={12} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} />
                <Tooltip 
                  contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '12px' }}
                />
                <Bar dataKey="value" fill="#8884d8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="text-xl font-bold text-white mb-6">Academic Alerts</h2>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-3 mb-2">
                <MaterialIcon icon="warning" className="text-amber-400" />
                <p className="text-sm font-bold text-white">S.4 Mathematics</p>
              </div>
              <p className="text-xs text-white/60">Average performance dropped by 12% in the latest CA assessment.</p>
            </div>
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center gap-3 mb-2">
                <MaterialIcon icon="info" className="text-blue-400" />
                <p className="text-sm font-bold text-white">Mid-Term Prep</p>
              </div>
              <p className="text-xs text-white/60">85% of exam papers have been uploaded. Deadline in 2 days.</p>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}

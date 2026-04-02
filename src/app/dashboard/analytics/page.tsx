'use client'
import { useAuth } from '@/lib/auth-context'
import { useAnalytics } from '@/lib/hooks'
import GlassCard from '@/components/GlassCard'
import MaterialIcon from '@/components/MaterialIcon'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

export default function AnalyticsPage() {
  const { school } = useAuth()
  const { data, loading } = useAnalytics(school?.id)

  if (loading) return <div className="p-8 text-on-surface flex items-center gap-3">
    <MaterialIcon icon="progress_activity" className="animate-spin text-primary" />
    <span>Calculating insights...</span>
  </div>

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-on-surface tracking-tight">Executive Insights</h1>
          <p className="text-on-surface-variant font-medium">Strategic analytics for school management</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
            <p className="text-[10px] text-green font-bold uppercase tracking-wider">Health Score</p>
            <p className="text-xl font-bold text-on-surface">84%</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <GlassCard className="space-y-2 !bg-surface-container-low/40">
          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Total Students</p>
          <p className="text-3xl font-bold text-on-surface">{data.stats.totalStudents}</p>
          <div className="flex items-center gap-1 text-green text-xs font-bold">
            <MaterialIcon icon="trending_up" className="text-sm" />
            <span>+2% vs last term</span>
          </div>
        </GlassCard>
        <GlassCard className="space-y-2 !bg-surface-container-low/40">
          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Fee Collection</p>
          <p className="text-3xl font-bold text-on-surface">{Math.round(data.stats.feeCollectionRate)}%</p>
          <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden mt-2">
            <div className="h-full bg-primary" style={{ width: `${data.stats.feeCollectionRate}%` }} />
          </div>
        </GlassCard>
        <GlassCard className="space-y-2 !bg-surface-container-low/40">
          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Avg. Attendance</p>
          <p className="text-3xl font-bold text-on-surface">92%</p>
          <p className="text-xs text-on-surface-variant italic">Last 30 days</p>
        </GlassCard>
        <GlassCard className="space-y-2 !bg-surface-container-low/40">
          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Projected Revenue</p>
          <p className="text-xl font-bold text-on-surface">UGX {data.stats.projectedRevenue.toLocaleString()}</p>
          <p className="text-[10px] text-primary font-bold uppercase">Term Total</p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <GlassCard className="!bg-surface-container-low/40">
          <h2 className="text-lg font-bold text-on-surface mb-6 flex items-center gap-2">
            <div className="w-1.5 h-6 bg-primary rounded-full" />
            Revenue vs. Outstanding
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.revenueProjections}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  <Cell fill="var(--navy)" />
                  <Cell fill="var(--outline-variant)" opacity={0.3} />
                </Pie>
                <Tooltip 
                  contentStyle={{ background: 'var(--surface-container-highest)', border: 'none', borderRadius: '12px', fontSize: '12px' }}
                  itemStyle={{ color: 'var(--on-surface)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-8 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <p className="text-xs text-on-surface-variant font-medium">Collected</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-outline-variant opacity-40" />
              <p className="text-xs text-on-surface-variant font-medium">Outstanding</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="!bg-surface-container-low/40">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
              <div className="w-1.5 h-6 bg-error rounded-full" />
              At-Risk Students
            </h2>
            <span className="px-2 py-1 bg-red-500/10 text-red text-[10px] font-bold rounded uppercase tracking-wider">High Priority</span>
          </div>
          <div className="space-y-4 max-h-64 overflow-y-auto pr-2 no-scrollbar">
            {data.atRiskStudents.map((s: any) => (
              <div key={s.student_id} className="flex items-center justify-between p-3 rounded-xl bg-surface-container border border-outline-variant/10 hover:bg-surface-bright transition-all">
                <div>
                  <p className="text-sm font-bold text-on-surface">{s.full_name}</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">{s.class_name} · {s.risk_reason.replace('_', ' ')}</p>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-bold ${s.attendance_rate < 75 ? 'text-red' : 'text-on-surface-variant'}`}>
                    Att: {Math.round(s.attendance_rate)}%
                  </p>
                  <p className={`text-[10px] font-medium ${s.avg_score < 50 ? 'text-red' : 'text-on-surface-variant'}`}>
                    Avg: {Math.round(s.avg_score)}%
                  </p>
                </div>
              </div>
            ))}
            {data.atRiskStudents.length === 0 && (
              <div className="text-center py-8">
                <MaterialIcon icon="check_circle" className="text-green text-3xl mb-2" />
                <p className="text-sm text-on-surface-variant">All students are meeting thresholds</p>
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <GlassCard className="lg:col-span-2 !bg-surface-container-low/40">
          <h2 className="text-lg font-bold text-on-surface mb-6 flex items-center gap-2">
            <div className="w-1.5 h-6 bg-primary rounded-full" />
            Gender Distribution per Class
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.genderDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" opacity={0.1} />
                <XAxis dataKey="name" stroke="var(--on-surface-variant)" fontSize={11} axisLine={false} tickLine={false} />
                <YAxis stroke="var(--on-surface-variant)" fontSize={11} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: 'var(--surface-container-highest)', opacity: 0.1 }}
                  contentStyle={{ background: 'var(--surface-container-highest)', border: 'none', borderRadius: '12px', fontSize: '12px' }}
                />
                <Bar dataKey="value" fill="var(--navy)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="!bg-surface-container-low/40">
          <h2 className="text-lg font-bold text-on-surface mb-6 flex items-center gap-2">
            <div className="w-1.5 h-6 bg-amber rounded-full" />
            Academic Alerts
          </h2>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2 mb-2">
                <MaterialIcon icon="warning" className="text-amber text-lg" />
                <p className="text-sm font-bold text-on-surface">S.4 Mathematics</p>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">Average performance dropped by 12% in the latest assessment.</p>
            </div>
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <MaterialIcon icon="info" className="text-primary text-lg" />
                <p className="text-sm font-bold text-on-surface">Mid-Term Prep</p>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">85% of exam papers have been uploaded. Deadline in 2 days.</p>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}

'use client'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAnalytics } from '@/lib/hooks'
import {
  Users,
  UserCheck,
  GraduationCap,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Calendar,
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Zap,
  Target
} from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from 'recharts'

export default function AnalyticsPage() {
  const { school } = useAuth()
  const { data, loading } = useAnalytics(school?.id)
  const [selectedRange, setSelectedRange] = useState('This Term')

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Loader2 className="w-12 h-12 animate-spin text-primary-800" />
        <p className="mt-4 text-gray-500 font-bold">Aggregating performance insights...</p>
      </div>
    )
  }

  return (
    <div className="space-y-12 pb-24 animate-fade-in relative z-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <div className="flex items-center gap-3 mb-3">
             <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
               <Target className="w-4 h-4 text-white fill-white" />
             </div>
             <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[4px]">Performance Intelligence</span>
          </div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight text-glow">School Analytics</h1>
          <p className="text-gray-400 font-bold mt-2 text-base max-w-lg">Advanced insights into your school's academic and operational performance index.</p>
        </div>
        <div className="bg-white/40 backdrop-blur-md rounded-2xl border border-white/40 shadow-xl shadow-gray-200/50 px-6 py-4 flex items-center gap-4 group hover:bg-white transition-all duration-500">
          <Calendar className="w-5 h-5 text-gray-400 group-hover:text-primary-800 transition-smooth" />
          <select 
            value={selectedRange}
            onChange={(e) => setSelectedRange(e.target.value)}
            className="bg-transparent border-none p-0 text-sm font-black text-gray-700 focus:ring-0 outline-none cursor-pointer pr-10"
          >
            <option>This Term</option>
            <option>Last Term</option>
            <option>Full Year 2026</option>
          </select>
        </div>
      </div>

      {/* Extreme Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {[
          { label: 'Total Scholars', value: data.stats.totalStudents, icon: Users, bg: 'bg-primary-50/50', iconBg: 'bg-primary-800', textColor: 'text-primary-800', shadow: 'shadow-primary-500/20' },
          { label: 'Avg Attendance', value: `${data.stats.avgAttendance || 0}%`, icon: UserCheck, bg: 'bg-emerald-50/50', iconBg: 'bg-emerald-500', textColor: 'text-emerald-700', shadow: 'shadow-emerald-500/20' },
          { label: 'Academic GPA', value: `${data.stats.avgGrade || 0}%`, icon: GraduationCap, bg: 'bg-indigo-50/50', iconBg: 'bg-indigo-600', textColor: 'text-indigo-700', shadow: 'shadow-indigo-500/20' },
          { label: 'Collection Rate', value: `${data.stats.feeCollectionRate || 0}%`, icon: TrendingUp, bg: 'bg-amber-50/50', iconBg: 'bg-amber-500', textColor: 'text-amber-700', shadow: 'shadow-amber-500/20' },
        ].map((stat, i) => (
          <div key={i} className={`relative group overflow-hidden ${stat.bg} backdrop-blur-md rounded-[48px] p-8 border border-white/60 shadow-xl shadow-gray-200/20 hover:shadow-2xl transition-all duration-500`}>
            <div className="flex items-center justify-between mb-8 text-center">
               <div className={`w-14 h-14 ${stat.iconBg} rounded-2xl flex items-center justify-center shadow-lg ${stat.shadow} group-hover:rotate-12 transition-all duration-500`}>
                 <stat.icon className="w-7 h-7 text-white" />
               </div>
               <Activity className={`w-5 h-5 opacity-20 group-hover:opacity-100 transition-smooth ${stat.textColor}`} />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mb-2">{stat.label}</p>
              <h3 className="text-3xl font-black text-gray-900 tracking-tight">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Main Insights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Glowing Attendance Distribution */}
        <div className="bg-white/70 backdrop-blur-xl rounded-[56px] p-10 border border-white/60 shadow-2xl shadow-gray-200/20">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-2xl font-black text-gray-900 leading-tight">Attendance Pulse</h3>
              <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mt-1">7-Day operational participation index</p>
            </div>
            <div className="flex gap-4">
               <div className="flex items-center gap-2 group cursor-help">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-emerald-500 transition-smooth">Present</span>
               </div>
               <div className="flex items-center gap-2 group cursor-help">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-red-400 transition-smooth">Absent</span>
               </div>
            </div>
          </div>
          <div className="h-80 w-full lg:pr-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.attendanceTrends} barGap={12}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} dy={10} />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.05)', padding: '15px' }}
                />
                <Bar dataKey="present" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} barSize={32} />
                <Bar dataKey="late" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                <Bar dataKey="absent" stackId="a" fill="#ef4444" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* High-Fidelity Demographic Analysis */}
        <div className="bg-white/70 backdrop-blur-xl rounded-[56px] p-10 border border-white/60 shadow-2xl shadow-gray-200/20">
           <div className="mb-10 text-center">
              <h3 className="text-2xl font-black text-gray-900 leading-tight">Demographic Insights</h3>
              <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mt-1 text-center">Classroom Diversity & Population Distribution</p>
            </div>
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="relative w-full h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.genderDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={115}
                    paddingAngle={6}
                    dataKey="value"
                    stroke="none"
                  >
                    {data.genderDistribution.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                 <span className="text-gray-300 text-[10px] font-black uppercase tracking-[5px] mb-1">Census</span>
                 <span className="text-4xl font-black text-gray-900 tracking-tighter">{data.stats.totalStudents}</span>
              </div>
            </div>
            <div className="space-y-8 w-full md:w-64">
              {data.genderDistribution.map((item: {name: string, value: number, color: string}, i: number) => (
                <div key={i} className="group">
                  <div className="flex items-center justify-between text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3">
                    <div className="flex items-center gap-3">
                       <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                       <span className="group-hover:text-gray-900 transition-smooth">{item.name}</span>
                    </div>
                    <span className="text-gray-900">
                      {data.stats.totalStudents > 0 ? Math.round((item.value / data.stats.totalStudents) * 100) : 0}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                    <div className="h-full rounded-full transition-all duration-1000 shadow-sm" style={{ width: `${data.stats.totalStudents > 0 ? (item.value / data.stats.totalStudents) * 100 : 0}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Glowing Academic Performance Area */}
        <div className="bg-white/70 backdrop-blur-xl rounded-[56px] p-10 border border-white/60 shadow-2xl shadow-gray-200/20">
           <div className="mb-10 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-gray-900 leading-tight">Academic Momentum</h3>
                <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mt-1">GPA performance across classroom cycles</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-primary-800 flex items-center justify-center shadow-lg shadow-primary-500/20">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
            </div>
          <div className="h-80 w-full lg:pr-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.classPerformance}>
                <defs>
                  <linearGradient id="colorAvgV3" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5D2FFB" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#5D2FFB" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="class" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.05)', padding: '15px' }}
                />
                <Area type="monotone" dataKey="avg" stroke="#5D2FFB" strokeWidth={5} fillOpacity={1} fill="url(#colorAvgV3)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Analytics Bento */}
        <div className="bg-white/70 backdrop-blur-xl rounded-[56px] p-10 border border-white/60 shadow-2xl shadow-gray-200/20">
           <div className="mb-10 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-gray-900 leading-tight">Revenue Stream</h3>
                <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mt-1">Monthly collection deltas vs targets</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
          <div className="h-80 w-full lg:pr-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.feeCollection} barGap={12}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} dy={10} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }}
                  tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`}
                />
                <Tooltip 
                  formatter={(v) => `UGX ${((v as number) / 1000000).toFixed(1)}M`}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.05)', padding: '15px' }}
                />
                <Bar dataKey="expected" name="Expected" fill="#f1f5f9" radius={[8, 8, 0, 0]} barSize={24} />
                <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[8, 8, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Extreme Subject Proficiency Board */}
      <div className="bg-white/70 backdrop-blur-xl rounded-[56px] p-10 border border-white/60 shadow-2xl shadow-gray-200/20">
        <div className="flex items-center justify-between mb-12">
           <div>
             <h3 className="text-2xl font-black text-gray-900 leading-tight">Subject Proficiency Board</h3>
             <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mt-1">Cross-discipline academic performance index</p>
           </div>
           <div className="w-14 h-14 bg-indigo-50 rounded-[24px] flex items-center justify-center text-indigo-600 shadow-sm">
             <Filter className="w-6 h-6" />
           </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {data.subjectPerformance.sort((a: any, b: any) => b.avg - a.avg).map((s: any, i: number) => (
            <div key={i} className="relative bg-white/40 backdrop-blur-md rounded-[32px] p-8 border border-white/80 hover:border-primary-200 transition-all duration-500 group hover:-translate-y-2 hover:shadow-2xl shadow-gray-200/10 overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <span className={`text-[9px] font-black px-3 py-1.5 rounded-xl uppercase tracking-[1px] shadow-sm ${
                  s.avg >= 80 ? 'bg-emerald-500 text-white' :
                  s.avg >= 60 ? 'bg-primary-800 text-white' :
                  'bg-red-500 text-white'
                }`}>
                  {s.avg >= 80 ? 'Elite' : s.avg >= 60 ? 'Stable' : 'Critical'}
                </span>
                <span className="text-xs font-black text-gray-200 group-hover:text-primary-800 transition-smooth">RANK #{i + 1}</span>
              </div>
              <h4 className="text-lg font-black text-gray-900 group-hover:text-primary-800 transition-smooth mb-1">{s.subject}</h4>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6">Subject Average</p>
              
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-4xl font-black text-gray-900 tracking-tighter">{s.avg}%</span>
                <div className={`w-2 h-2 rounded-full ${s.avg >= 80 ? 'bg-emerald-500 animate-pulse' : s.avg >= 60 ? 'bg-primary-800' : 'bg-red-500'}`} />
              </div>

              <div className="h-2 w-full bg-gray-50 rounded-full overflow-hidden border border-gray-100 p-0.5">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 shadow-sm ${
                    s.avg >= 80 ? 'bg-emerald-500' : s.avg >= 60 ? 'bg-primary-800' : 'bg-red-500'
                  }`} 
                  style={{ width: `${s.avg}%` }} 
                />
              </div>
              
              {/* Abstract Decorative Decal */}
              <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-primary-800 opacity-[0.02] rounded-full blur-3xl group-hover:scale-150 transition-all duration-700 pointer-events-none" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

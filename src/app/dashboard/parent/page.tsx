'use client'
import {
  BookOpen,
  CreditCard,
  UserCheck,
  GraduationCap,
  Bell,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  Shield,
  Activity,
  Zap,
  Star
} from 'lucide-react'
import BackgroundBlobs from '@/components/BackgroundBlobs'

const child = {
  name: 'Sarah Nakato',
  class: 'P.5A',
  studentNumber: 'STU00001',
  school: "St. Mary's Primary School",
}

const recentAttendance = [
  { date: 'Mar 22', status: 'present' },
  { date: 'Mar 21', status: 'present' },
  { date: 'Mar 20', status: 'absent' },
  { date: 'Mar 19', status: 'present' },
  { date: 'Mar 18', status: 'late' },
  { date: 'Mar 17', status: 'present' },
  { date: 'Mar 16', status: 'present' },
]

const feeStatus = { totalFee: 250000, totalPaid: 150000, balance: 100000 }

const recentGrades = [
  { subject: 'Mathematics', ca: 72, exam: 65, grade: 'C4' },
  { subject: 'English', ca: 82, exam: 78, grade: 'D2' },
  { subject: 'Science', ca: 88, exam: 85, grade: 'D1' },
  { subject: 'Social Studies', ca: 65, exam: 58, grade: 'C5' },
]

const notifications = [
  { type: 'fee', message: 'Fee balance: UGX 100,000 remaining', time: '2h ago' },
  { type: 'attendance', message: 'Sarah was absent on March 20th', time: '2d ago' },
  { type: 'grade', message: 'Term 1 exam results available', time: '5d ago' },
]

export default function ParentPortal() {
  return (
    <div className="min-h-screen bg-gray-50/30 relative overflow-hidden pb-20">
      <BackgroundBlobs />
      
      {/* Premium Glass Header */}
      <div className="bg-primary-900/90 backdrop-blur-xl text-white p-8 relative z-10 shadow-2xl">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/10">
              <BookOpen className="w-6 h-6 text-primary-200" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[3px] opacity-60 mb-1">Scholar Monitoring</div>
              <div className="font-black text-sm tracking-tight">{child.school}</div>
            </div>
          </div>
          <div className="text-right">
             <div className="text-[10px] font-black uppercase tracking-[3px] opacity-60 mb-1">Parent Portal</div>
             <div className="text-sm font-black">{child.name}</div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-8 relative z-10">
        {/* Scholar Identity Card */}
        <div className="bg-white/70 backdrop-blur-xl rounded-[40px] border border-white shadow-2xl shadow-gray-200/20 p-8 flex items-center gap-6 group hover:scale-[1.02] transition-all duration-500">
          <div className="w-20 h-20 bg-primary-50 rounded-[28px] flex items-center justify-center border border-primary-100 shadow-inner group-hover:rotate-6 transition-all duration-500">
             <span className="text-2xl font-black text-primary-800">SN</span>
          </div>
          <div>
            <div className="text-[10px] font-black text-primary-800 uppercase tracking-[4px] mb-1">Active Scholar</div>
            <div className="text-2xl font-black text-gray-900 tracking-tight">{child.name}</div>
            <div className="flex items-center gap-3 mt-1.5">
               <span className="text-xs font-black text-gray-400 uppercase tracking-widest">{child.class}</span>
               <span className="w-1 h-1 rounded-full bg-gray-200" />
               <span className="text-xs font-black text-gray-400 font-mono uppercase tracking-widest">{child.studentNumber}</span>
            </div>
          </div>
        </div>

        {/* Vital Metrics Grid */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Attendance', value: '55/60', icon: UserCheck, color: 'text-emerald-500', bg: 'bg-emerald-50' },
            { label: 'Average', value: '75.6%', icon: GraduationCap, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: 'Financial', value: '100K', icon: CreditCard, color: 'text-amber-500', bg: 'bg-amber-50' },
          ].map((stat, i) => (
            <div key={i} className="bg-white/70 backdrop-blur-xl rounded-[32px] border border-white shadow-xl shadow-gray-100/10 p-6 text-center group hover:scale-105 transition-all duration-500">
              <stat.icon className={`w-6 h-6 ${stat.color} mx-auto mb-3 transition-all group-hover:rotate-12`} />
              <div className="text-lg font-black text-gray-900 tracking-tight">{stat.value}</div>
              <div className="text-[9px] font-black text-gray-400 uppercase tracking-[2px] mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Financial Flow Card */}
        <div className="bg-white/70 backdrop-blur-xl rounded-[40px] border border-white shadow-2xl shadow-gray-200/20 p-10">
          <div className="flex items-center justify-between mb-8">
             <h2 className="text-lg font-black text-gray-900 tracking-tight uppercase tracking-[3px]">Financial Pulse</h2>
             <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                <Activity className="w-5 h-5 text-emerald-500 animate-pulse" />
             </div>
          </div>
          <div className="mb-8">
            <div className="flex justify-between text-[11px] font-black text-gray-400 uppercase tracking-[2px] mb-3">
              <span>Paid: UGX {feeStatus.totalPaid.toLocaleString()}</span>
              <span>Total: UGX {feeStatus.totalFee.toLocaleString()}</span>
            </div>
            <div className="h-4 bg-gray-100/50 rounded-full overflow-hidden p-1 shadow-inner">
              <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full shadow-lg shadow-emerald-500/20" style={{ width: `${(feeStatus.totalPaid / feeStatus.totalFee) * 100}%` }} />
            </div>
          </div>
          <div className="flex items-center justify-between">
             <div className="flex flex-col">
                <span className="text-[10px] font-black text-gray-300 uppercase tracking-[2px]">Unresolved Balance</span>
                <span className="text-2xl font-black text-red-500 tracking-tight">UGX {feeStatus.balance.toLocaleString()}</span>
             </div>
             <button className="h-14 px-8 bg-primary-800 text-white rounded-2xl font-black text-xs uppercase tracking-[3px] hover:bg-black transition-all shadow-xl shadow-primary-500/20 active:scale-95">
                Commit Payment
             </button>
          </div>
        </div>

        {/* Attendance Matrix */}
        <div className="bg-white/70 backdrop-blur-xl rounded-[40px] border border-white shadow-2xl shadow-gray-200/20 p-10">
          <h2 className="text-lg font-black text-gray-900 tracking-tight uppercase tracking-[3px] mb-8">Attendance History</h2>
          <div className="flex gap-2">
            {recentAttendance.map((day, i) => (
              <div key={i} className="flex-1 text-center group cursor-pointer">
                <div className={`w-full h-12 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 shadow-sm ${
                  day.status === 'present' ? 'bg-emerald-50 border border-emerald-100' : day.status === 'absent' ? 'bg-red-50 border border-red-100' : 'bg-amber-50 border border-amber-100'
                }`}>
                  {day.status === 'present' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> :
                   day.status === 'absent' ? <XCircle className="w-5 h-5 text-red-600" /> :
                   <Clock className="w-5 h-5 text-amber-600" />}
                </div>
                <div className="text-[9px] font-black text-gray-400 mt-2 uppercase tracking-widest">{day.date}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scholastic Achievements */}
        <div className="bg-white/70 backdrop-blur-xl rounded-[40px] border border-white shadow-2xl shadow-gray-200/20 p-10">
          <div className="flex items-center justify-between mb-8">
             <h2 className="text-lg font-black text-gray-900 tracking-tight uppercase tracking-[3px]">Latest Grades</h2>
             <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-indigo-600 fill-indigo-600" />
             </div>
          </div>
          <div className="space-y-4">
            {recentGrades.map((grade, i) => (
              <div key={i} className="flex items-center justify-between p-5 bg-white/50 rounded-3xl border border-gray-50 group hover:border-primary-100 hover:bg-white transition-all duration-500">
                <div className="font-black text-sm text-gray-900 tracking-tight group-hover:text-primary-800 transition-smooth">{grade.subject}</div>
                <div className="flex items-center gap-5">
                  <div className="flex flex-col text-right">
                     <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Assessment</span>
                     <span className="text-xs font-black text-gray-500">CA: {grade.ca}</span>
                  </div>
                  <div className="flex flex-col text-right">
                     <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Protocol</span>
                     <span className="text-xs font-black text-gray-500">Exam: {grade.exam}</span>
                  </div>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shadow-xl shadow-gray-200/20 ${grade.grade.startsWith('D') ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : grade.grade.startsWith('C') ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                    {grade.grade}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Global Notifications */}
        <div className="bg-white/70 backdrop-blur-xl rounded-[40px] border border-white shadow-2xl shadow-gray-200/20 p-10">
          <div className="flex items-center justify-between mb-8">
             <h2 className="text-lg font-black text-gray-900 tracking-tight uppercase tracking-[3px]">Protocol Alerts</h2>
             <Bell className="w-6 h-6 text-gray-300 group-hover:text-primary-800 transition-all" />
          </div>
          <div className="space-y-5">
            {notifications.map((notif, i) => (
              <div key={i} className="flex items-start gap-5 p-5 bg-white/40 rounded-3xl border border-gray-50 group hover:border-primary-100 transition-all">
                <div className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 shadow-lg ${notif.type === 'fee' ? 'bg-amber-500 shadow-amber-500/20' : notif.type === 'attendance' ? 'bg-red-500 shadow-red-500/20' : 'bg-indigo-500 shadow-indigo-500/20'}`} />
                <div className="flex-1">
                   <p className="text-sm font-black text-gray-700 tracking-tight leading-relaxed">{notif.message}</p>
                   <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mt-1.5">{notif.time}</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                   <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

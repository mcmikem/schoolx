'use client'
import { useState } from 'react'
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Star, Target, Zap, Clock, MapPin, Bell, ArrowUpRight, Activity } from 'lucide-react'

const events = [
  { date: '2026-03-15', title: 'End of Term 1 Exams Begin', type: 'exam' },
  { date: '2026-03-22', title: 'Parent-Teacher Meeting', type: 'meeting' },
  { date: '2026-03-28', title: 'Report Card Distribution', type: 'academic' },
  { date: '2026-04-05', title: 'Term 2 Opens', type: 'term' },
  { date: '2026-04-10', title: 'Sports Day', type: 'event' },
  { date: '2026-05-01', title: 'Labour Day - Holiday', type: 'holiday' },
]

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const typeColors: Record<string, { bg: string, text: string, glow: string }> = {
  exam: { bg: 'bg-red-50/50', text: 'text-red-700', glow: 'shadow-red-500/20' },
  meeting: { bg: 'bg-blue-50/50', text: 'text-blue-700', glow: 'shadow-blue-500/20' },
  holiday: { bg: 'bg-emerald-50/50', text: 'text-emerald-700', glow: 'shadow-emerald-500/20' },
  academic: { bg: 'bg-purple-50/50', text: 'text-purple-700', glow: 'shadow-purple-500/20' },
  term: { bg: 'bg-amber-50/50', text: 'text-amber-700', glow: 'shadow-amber-500/20' },
  event: { bg: 'bg-indigo-50/50', text: 'text-indigo-700', glow: 'shadow-indigo-500/20' },
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(2)
  const currentYear = 2026

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const firstDay = new Date(currentYear, currentMonth, 1).getDay()

  return (
    <div className="space-y-12 pb-24 animate-fade-in relative z-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <div className="flex items-center gap-3 mb-3">
             <div className="w-8 h-8 rounded-lg bg-primary-800 flex items-center justify-center shadow-lg shadow-primary-500/20">
               <CalendarIcon className="w-4 h-4 text-white fill-white" />
             </div>
             <span className="text-[10px] font-black text-primary-800 uppercase tracking-[4px]">Institutional Timeline</span>
          </div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Scholastic Calendar</h1>
          <p className="text-gray-400 font-bold mt-2 text-base max-w-lg">Manage weekly protocols, academic milestones, and temporal events.</p>
        </div>
        <button className="h-14 px-8 bg-primary-800 text-white rounded-2xl font-black text-xs uppercase tracking-[2px] flex items-center gap-3 hover:bg-black transition-all shadow-xl shadow-primary-800/30 active:scale-95">
          <Plus className="w-5 h-5" /> Schedule Protocol
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Supreme Calendar Matrix */}
        <div className="lg:col-span-2 bg-white/70 backdrop-blur-xl rounded-[64px] border border-white/60 shadow-2xl shadow-gray-200/20 p-10">
          <div className="flex items-center justify-between mb-12">
             <div className="flex items-center gap-4">
                <button 
                  onClick={() => setCurrentMonth(Math.max(0, currentMonth - 1))} 
                  className="w-12 h-12 bg-white border border-gray-100 rounded-2xl flex items-center justify-center text-gray-400 hover:text-primary-800 shadow-xl shadow-gray-200/5 hover:shadow-2xl transition-all active:scale-95"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="px-6 py-3 bg-gray-50/50 rounded-2xl border border-gray-100">
                   <h2 className="text-xl font-black text-gray-900 tracking-tight">{months[currentMonth]} {currentYear}</h2>
                </div>
                <button 
                  onClick={() => setCurrentMonth(Math.min(11, currentMonth + 1))} 
                  className="w-12 h-12 bg-white border border-gray-100 rounded-2xl flex items-center justify-center text-gray-400 hover:text-primary-800 shadow-xl shadow-gray-200/5 hover:shadow-2xl transition-all active:scale-95"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
             </div>
             <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-primary-800 shadow-[0_0_8px_rgba(31,41,55,0.3)] animate-pulse" />
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Temporal Sync Ready</span>
             </div>
          </div>

          <div className="grid grid-cols-7 gap-4 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="text-center text-[11px] font-black text-gray-400 uppercase tracking-[3px] py-4">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-4">
            {Array.from({ length: firstDay }, (_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayEvents = events.filter((e) => e.date === dateStr)
              const isToday = day === 22 && currentMonth === 2
              return (
                <div key={day} className={`min-h-[120px] p-4 rounded-[32px] border transition-all duration-500 overflow-hidden group ${isToday ? 'bg-primary-800 border-primary-700 shadow-2xl shadow-primary-500/30' : 'bg-white/50 border-gray-50 hover:bg-white hover:border-white hover:shadow-xl'}`}>
                  <div className={`text-base font-black ${isToday ? 'text-white' : 'text-gray-400 group-hover:text-primary-800'} transition-smooth`}>{day}</div>
                  <div className="mt-3 space-y-1.5">
                    {dayEvents.map((evt: any, i) => (
                      <div key={i} className={`text-[9px] px-3 py-1.5 rounded-xl truncate font-black uppercase tracking-widest shadow-sm ${isToday ? 'bg-white/10 text-white' : `${typeColors[evt.type]?.bg} ${typeColors[evt.type]?.text} ${typeColors[evt.type]?.glow}`}`}>
                        {evt.title}
                      </div>
                    ))}
                  </div>
                  {isToday && (
                    <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-white/10 rounded-full blur-xl animate-pulse" />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Upcoming Protocols Panel */}
        <div className="space-y-8 lg:col-span-1">
          <div className="bg-white/70 backdrop-blur-xl rounded-[48px] border border-white/60 shadow-2xl shadow-gray-200/20 p-10">
            <div className="flex items-center gap-4 mb-10">
               <div className="w-12 h-12 bg-primary-50 rounded-2xl flex items-center justify-center text-primary-800 shadow-xl shadow-gray-200/10">
                  <Star className="w-6 h-6 fill-primary-800" />
               </div>
               <h2 className="text-2xl font-black text-gray-900 tracking-tight">Upcoming</h2>
            </div>
            
            <div className="space-y-6">
              {events.map((event, i) => (
                <div key={i} className="relative group p-6 bg-white/50 border border-transparent hover:border-white hover:bg-white rounded-[32px] transition-all duration-500 hover:shadow-2xl">
                   <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-all">
                      <ArrowUpRight className="w-5 h-5 text-gray-300" />
                   </div>
                   <div className="flex items-center gap-3 mb-3">
                      <Clock className="w-4 h-4 text-primary-200" />
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono italic">{event.date}</span>
                   </div>
                   <h3 className="text-base font-black text-gray-900 group-hover:text-primary-800 transition-smooth">{event.title}</h3>
                   <div className="mt-4 flex items-center gap-2">
                       <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[2px] shadow-sm border ${typeColors[event.type]?.bg} ${typeColors[event.type]?.text} ${typeColors[event.type]?.glow}`}>
                          {event.type} Protocol
                       </span>
                   </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-primary-800 rounded-[48px] p-10 text-white relative overflow-hidden group shadow-2xl shadow-primary-500/30">
             <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-all duration-[2000ms]" />
             <Activity className="w-10 h-10 text-white/30 mb-8" />
             <h3 className="text-2xl font-black tracking-tight mb-3">Institutional Efficiency</h3>
             <p className="text-primary-100/70 font-bold text-sm leading-relaxed mb-8">Maintain a high-fidelity record of all academic cycles and operational protocols.</p>
             <button className="w-full h-16 bg-white rounded-2xl text-primary-800 font-black text-xs uppercase tracking-widest hover:bg-primary-50 transition-all shadow-xl">Audit Matrix</button>
          </div>
        </div>
      </div>
    </div>
  )
}


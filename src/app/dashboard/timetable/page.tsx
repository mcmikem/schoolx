'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useClasses, useSubjects, useTimetable } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { 
  Plus, 
  Trash2, 
  Clock, 
  BookOpen, 
  User as UserIcon, 
  Calendar, 
  Loader2, 
  X,
  ChevronRight,
  Download,
  Printer,
  Zap,
  Star,
  Activity
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

const DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
]
const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'
]

export default function TimetablePage() {
  const { school } = useAuth()
  const toast = useToast()
  const { classes, loading: classesLoading } = useClasses(school?.id)
  const { subjects } = useSubjects(school?.id)
  const [selectedClass, setSelectedClass] = useState('')
  const { timetable, loading: timetableLoading, saveEntry, deleteEntry } = useTimetable(selectedClass)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<Record<string, unknown> | null>(null)
  const [teachers, setTeachers] = useState<Array<{id: string, full_name: string}>>([])

  useEffect(() => {
    if (classes.length > 0 && !selectedClass) {
      setSelectedClass(classes[0].id)
    }
  }, [classes, selectedClass])

  useEffect(() => {
    async function fetchTeachers() {
      if (!school?.id) return
      const { data } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('school_id', school.id)
        .eq('role', 'teacher')
      setTeachers(data || [])
    }
    fetchTeachers()
  }, [school?.id])

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const entry = {
      id: editingEntry?.id as string | undefined,
      class_id: selectedClass,
      subject_id: formData.get('subject_id') as string,
      teacher_id: formData.get('teacher_id') as string || undefined,
      day_of_week: Number(formData.get('day_of_week')),
      start_time: formData.get('start_time') as string,
      end_time: formData.get('end_time') as string,
    }

    try {
      await saveEntry(entry)
      toast.success('Timetable entry saved!')
      setIsModalOpen(false)
      setEditingEntry(null)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      toast.error(errorMessage)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schedule entry?')) return
    try {
      await deleteEntry(id)
      toast.success('Entry deleted')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      toast.error(errorMessage)
    }
  }

  if (classesLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Loader2 className="w-12 h-12 animate-spin text-primary-800" />
        <p className="mt-4 text-gray-400 font-bold uppercase tracking-widest text-xs">Syncing Scholastic Matrix...</p>
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
               <Calendar className="w-4 h-4 text-white fill-white" />
             </div>
             <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[4px]">Operational Matrix</span>
          </div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Scholastic Routine</h1>
          <p className="text-gray-400 font-bold mt-2 text-base max-w-lg">Orchestrate weekly subject cycles and institutional teacher allocations.</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              setEditingEntry(null)
              setIsModalOpen(true)
            }}
            className="h-14 px-8 bg-primary-800 text-white rounded-2xl font-black text-xs uppercase tracking-[2px] flex items-center gap-3 hover:bg-black transition-all shadow-xl shadow-primary-800/30 active:scale-95"
          >
            <Plus className="w-5 h-5" /> Assign Slot
          </button>
          <button className="w-14 h-14 bg-white/40 backdrop-blur-md border border-white/40 rounded-2xl flex items-center justify-center text-gray-400 hover:text-primary-800 transition-all shadow-xl shadow-gray-200/20">
            <Printer className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Extreme Glass Class Selector */}
      <div className="bg-white/40 backdrop-blur-md rounded-[48px] border border-white/60 shadow-2xl shadow-gray-200/20 p-10 flex flex-col md:flex-row gap-8 items-center justify-between">
        <div className="flex items-center gap-6">
           <div className="w-16 h-16 bg-white border border-white/60 rounded-[28px] flex items-center justify-center shadow-xl shadow-gray-200/10">
              <Zap className="w-8 h-8 text-indigo-600 fill-indigo-600" />
           </div>
           <div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight leading-tight">Routine Preview</h2>
              <p className="text-gray-400 font-bold text-sm mt-1 uppercase tracking-widest leading-none italic">Live Scholastic Cycle Integration</p>
           </div>
        </div>
        <div className="w-full md:w-80 group">
           <div className="relative">
             <div className="absolute left-6 top-1/2 -translate-y-1/2 pointer-events-none">
                <span className="text-gray-300 font-black text-[10px] uppercase tracking-widest">Active Level</span>
             </div>
             <select 
               value={selectedClass} 
               onChange={(e) => setSelectedClass(e.target.value)}
               className="w-full h-16 bg-white border border-white/60 rounded-[24px] pl-28 pr-12 text-sm font-black text-gray-700 appearance-none focus:ring-4 focus:ring-primary-100 outline-none transition-all shadow-sm cursor-pointer"
             >
               {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
             </select>
             <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 rotate-90" />
           </div>
        </div>
      </div>

      {/* Supreme Timetable Matrix */}
      <div className="bg-white/70 backdrop-blur-xl rounded-[64px] border border-white/60 shadow-2xl shadow-gray-200/20 overflow-hidden">
        {timetableLoading ? (
          <div className="p-32 flex flex-col items-center justify-center">
             <Loader2 className="w-12 h-12 animate-spin text-primary-800 mb-6" />
             <p className="text-gray-300 font-black uppercase tracking-[5px]">Synchronizing Temporal Data...</p>
          </div>
        ) : (
          <div className="overflow-x-auto p-4 lg:p-10">
            <table className="w-full border-separate border-spacing-4">
              <thead>
                <tr>
                  <th className="p-6 w-32"></th>
                  {DAYS.map(day => (
                    <th key={day.value} className="p-6 text-[11px] font-black text-gray-400 uppercase tracking-[3px] text-center">
                      {day.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((time, idx) => (
                  <tr key={time}>
                    <td className="p-6 text-center">
                      <div className="flex flex-col items-center gap-1">
                         <span className="text-sm font-black text-gray-900 font-mono italic">{time}</span>
                         <div className="w-1 h-1 rounded-full bg-primary-100" />
                      </div>
                    </td>
                    {DAYS.map(day => {
                      const entry = timetable.find((t: {day_of_week: number, start_time: string}) => t.day_of_week === day.value && t.start_time.startsWith(time))
                      return (
                        <td key={`${day.value}-${time}`} className="p-0 min-w-[200px]">
                          {entry ? (
                            <div className="bg-white/80 group hover:bg-primary-800 rounded-[32px] p-8 border border-white shadow-xl hover:shadow-2xl hover:shadow-primary-500/20 transition-all duration-500 relative overflow-hidden animate-in zoom-in-95 duration-500">
                               <div className="absolute -top-4 -right-4 w-12 h-12 bg-primary-50/50 rounded-full group-hover:bg-primary-700/50 transition-all duration-500" />
                               
                               <button 
                                 onClick={() => handleDelete(entry.id)}
                                 className="absolute top-4 right-4 p-2.5 text-red-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all duration-300 z-10"
                               >
                                 <Trash2 className="w-5 h-5" />
                               </button>

                               <div className="flex items-center gap-3 mb-4">
                                  <div className="w-10 h-10 rounded-xl bg-primary-50 group-hover:bg-white/10 flex items-center justify-center transition-all duration-500">
                                     <BookOpen className="w-5 h-5 text-primary-800 group-hover:text-white" />
                                  </div>
                                  <span className="text-sm font-black text-gray-900 group-hover:text-white uppercase tracking-tight truncate">{(entry as {subjects?: {name?: string}}).subjects?.name}</span>
                               </div>

                               <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-white/5 flex items-center justify-center transition-all duration-500">
                                     <UserIcon className="w-4 h-4 text-gray-400 group-hover:text-primary-200" />
                                  </div>
                                  <span className="text-[11px] font-bold text-gray-500 group-hover:text-primary-100 truncate">{(entry as {teachers?: {full_name?: string}}).teachers?.full_name || 'No Assignee'}</span>
                               </div>

                               <div className="mt-6 flex items-center justify-between">
                                  <span className="text-[9px] font-black text-primary-400 group-hover:text-white bg-gray-50 group-hover:bg-white/10 px-3 py-1.5 rounded-full border border-gray-100 group-hover:border-white/10 transition-all duration-500">
                                    {entry.start_time} - {entry.end_time}
                                  </span>
                               </div>
                            </div>
                          ) : (
                            <button 
                              onClick={() => {
                                setEditingEntry({ day_of_week: day.value, start_time: time })
                                setIsModalOpen(true)
                              }}
                              className="w-full h-40 bg-gray-50/30 border-4 border-dashed border-gray-100/50 rounded-[32px] flex flex-col items-center justify-center text-gray-200 hover:bg-white hover:border-primary-100 hover:text-primary-200 hover:shadow-xl transition-all duration-500 group"
                            >
                               <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-200 flex items-center justify-center mb-3 group-hover:border-primary-100 group-hover:rotate-90 transition-all duration-500">
                                  <Plus className="w-6 h-6" />
                               </div>
                               <span className="text-[10px] font-black uppercase tracking-[3px] opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500">Assign Protocol</span>
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="p-10 border-t border-gray-50 flex items-center justify-between">
           <p className="text-[10px] font-black text-gray-300 uppercase tracking-[4px]">Temporal Operational Matrix V2.4</p>
           <div className="flex gap-4">
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-primary-800" />
                 <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Session</span>
              </div>
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-indigo-200" />
                 <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Protocol Buffer</span>
              </div>
           </div>
        </div>
      </div>

      {/* Extreme Glass Modal - Add/Edit Entry */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-10">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-xl animate-in fade-in duration-500" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white/90 backdrop-blur-md w-full max-w-lg rounded-[64px] shadow-2xl border border-white/40 overflow-hidden animate-in zoom-in slide-in-from-bottom-20 duration-500">
            <div className="p-12 md:p-16">
              <div className="flex items-center justify-between mb-12">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                     <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                     <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[4px]">Temporal Allocation</span>
                  </div>
                  <h2 className="text-4xl font-black text-gray-900 tracking-tight">Schedule Assignment</h2>
                  <p className="text-gray-400 font-bold text-base mt-2">Allocate a scholastic subject to a specific temporal slot.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="w-16 h-16 bg-white/50 hover:bg-white rounded-[28px] flex items-center justify-center text-gray-400 hover:text-gray-900 transition-all shadow-xl shadow-gray-200/20">
                  <X className="w-8 h-8" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-10">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-[2px] pl-1">Target Day</label>
                    <div className="relative">
                      <select name="day_of_week" defaultValue={editingEntry?.day_of_week as string | number | undefined} className="w-full h-16 bg-white border border-gray-100 rounded-[24px] px-8 text-sm font-black text-gray-700 focus:ring-4 focus:ring-indigo-100 appearance-none cursor-pointer outline-none transition-all shadow-sm">
                        {DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                      <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 rotate-90" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-[2px] pl-1">Initiation Time</label>
                    <input type="time" name="start_time" defaultValue={editingEntry?.start_time as string | undefined} required className="w-full h-16 bg-white border border-gray-100 rounded-[24px] px-8 text-sm font-black text-gray-700 focus:ring-4 focus:ring-indigo-100 outline-none transition-all shadow-sm" />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-[2px] pl-1">Scholastic Subject</label>
                  <div className="relative">
                    <select name="subject_id" defaultValue={editingEntry?.subject_id as string | undefined} required className="w-full h-16 bg-white border border-gray-100 rounded-[24px] px-8 text-sm font-black text-gray-700 focus:ring-4 focus:ring-indigo-100 appearance-none cursor-pointer outline-none transition-all shadow-sm">
                      <option value="">Search Subject Matrix...</option>
                      {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 rotate-90" />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-[2px] pl-1">Authority Assignee</label>
                  <div className="relative">
                    <select name="teacher_id" defaultValue={editingEntry?.teacher_id as string | undefined} className="w-full h-16 bg-white border border-gray-100 rounded-[24px] px-8 text-sm font-black text-gray-700 focus:ring-4 focus:ring-indigo-100 appearance-none cursor-pointer outline-none transition-all shadow-sm">
                      <option value="">Search Teacher Roster...</option>
                      {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                    </select>
                    <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 rotate-90" />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-[2px] pl-1">Termination Time</label>
                  <input type="time" name="end_time" defaultValue={editingEntry?.end_time as string | undefined} required className="w-full h-16 bg-white border border-gray-100 rounded-[24px] px-8 text-sm font-black text-gray-700 focus:ring-4 focus:ring-indigo-100 outline-none transition-all shadow-sm" />
                </div>

                <div className="flex gap-6 pt-6">
                   <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 h-16 rounded-[24px] text-xs font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-smooth">Abort Protocol</button>
                   <button type="submit" className="flex-[2] h-16 bg-primary-800 text-white rounded-[24px] font-black text-xs uppercase tracking-[3px] flex items-center justify-center gap-4 hover:bg-black transition-all shadow-2xl shadow-primary-500/30 active:scale-95">
                      <Star className="w-5 h-5" /> Commit Slot
                   </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

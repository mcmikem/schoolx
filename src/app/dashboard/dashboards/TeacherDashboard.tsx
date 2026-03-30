'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useStudents, useClasses, useSubjects } from '@/lib/hooks'
import { 
  Bell, Moon, Building2, Users, BookOpen, Calendar, 
  Plus, UserCheck, PenTool, FileText, ClipboardList,
  Home, GraduationCap
} from 'lucide-react'

export default function TeacherDashboard() {
  const pathname = usePathname()
  const { school, user } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const { students } = useStudents(school?.id)
  const { classes } = useClasses(school?.id)
  const { subjects } = useSubjects(school?.id)

  const currentDate = new Date()
  const greeting = currentDate.getHours() < 12 ? 'Good Morning' : currentDate.getHours() < 17 ? 'Good Afternoon' : 'Good Evening'

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  const myClasses = classes.slice(0, 6)
  const mySubjects = subjects.slice(0, 6)

  const getStudentCountForClass = (classId: string) => {
    return students.filter(s => s.class_id === classId).length
  }

  const navItems = [
    { href: '/dashboard', icon: Home, label: 'Home', active: pathname === '/dashboard' },
    { href: '/dashboard/attendance', icon: UserCheck, label: 'My Classes' },
    { href: '/dashboard/grades', icon: BookOpen, label: 'Subjects' },
    { href: '/dashboard/profile', icon: GraduationCap, label: 'Profile' },
  ]

  return (
    <div className="min-h-screen bg-slate-100" style={{ maxWidth: 430, margin: '0 auto' }}>
      {/* TOPBAR */}
      <div className="bg-white px-5 pt-12 pb-4 border-b border-slate-200 flex justify-between items-start sticky top-0 z-50 shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-[#1A3A6B] leading-tight" style={{ letterSpacing: '-0.3px' }}>
            Dashboard<br />Overview
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-1">{formatDate(currentDate)}</p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <button className="w-9 h-9 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center relative">
            <Bell className="w-4 h-4 text-slate-500" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-white"></span>
          </button>
          <button className="w-9 h-9 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center">
            <Moon className="w-4 h-4 text-slate-500" />
          </button>
          <button className="h-9 bg-[#1A3A6B] rounded-full flex items-center gap-1.5 px-3 pl-1.5 shadow-md">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-xs font-extrabold text-white">{user?.full_name?.charAt(0) || 'T'}</span>
            </div>
            <span className="text-sm font-bold text-white">{user?.full_name?.split(' ')[0] || 'Teacher'}</span>
          </button>
        </div>
      </div>

      {/* BODY */}
      <div className="p-4 pb-28 flex flex-col gap-4">
        {/* GREETING CARD */}
        <div className="bg-[#1A3A6B] rounded-2xl p-4.5 shadow-lg relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5"></div>
          <div className="absolute -bottom-10 left-5 w-24 h-24 rounded-full bg-white/4"></div>
          
          <div className="flex justify-between items-start relative z-10">
            <div>
              <h2 className="text-lg font-extrabold text-white leading-tight">{greeting}, {user?.full_name?.split(' ')[0]}</h2>
              <p className="text-xs text-white/60 mt-1 font-medium">{school?.name}</p>
            </div>
            <div className="bg-white/12 rounded-lg px-2.5 py-1.5 text-right">
              <p className="text-xs font-bold text-white/85">{academicYear}</p>
              <p className="text-xs font-bold text-white/85">Term {currentTerm}</p>
            </div>
          </div>

          {/* STATS */}
          <div className="grid grid-cols-3 gap-2 mt-4 relative z-10">
            <div className="bg-white/10 rounded-xl p-2.5 text-center border border-white/8">
              <div className="flex justify-center mb-1">
                <Building2 className="w-4 h-4 text-amber-300" />
              </div>
              <div className="text-xl font-extrabold text-white">{myClasses.length}</div>
              <div className="text-[9.5px] text-white/55 font-semibold mt-0.5 uppercase tracking-wide">My Classes</div>
            </div>
            <div className="bg-white/10 rounded-xl p-2.5 text-center border border-white/8">
              <div className="flex justify-center mb-1">
                <BookOpen className="w-4 h-4 text-violet-300" />
              </div>
              <div className="text-xl font-extrabold text-white">{mySubjects.length}</div>
              <div className="text-[9.5px] text-white/55 font-semibold mt-0.5 uppercase tracking-wide">Subjects</div>
            </div>
            <div className="bg-white/10 rounded-xl p-2.5 text-center border border-white/8">
              <div className="flex justify-center mb-1">
                <Users className="w-4 h-4 text-blue-300" />
              </div>
              <div className="text-xl font-extrabold text-white">{students.length}</div>
              <div className="text-[9.5px] text-white/55 font-semibold mt-0.5 uppercase tracking-wide">Students</div>
            </div>
          </div>
        </div>

        {/* QUICK BTNS */}
        <div className="grid grid-cols-2 gap-2.5">
          <Link href="/dashboard/timetable" className="flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 bg-white shadow-sm text-sm font-bold text-slate-900">
            <Calendar className="w-4 h-4" />
            My Schedule
          </Link>
          <Link href="/dashboard/grades" className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1A3A6B] shadow-md text-sm font-bold text-white">
            <Plus className="w-4 h-4" />
            Quick Entry
          </Link>
        </div>

        {/* QUICK ACTIONS */}
        <div>
          <div className="flex justify-between items-center mb-2.5">
            <h3 className="text-sm font-extrabold text-slate-900">Quick Actions</h3>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
            <Link href="/dashboard/attendance" className="flex-shrink-0 bg-white border border-slate-200 rounded-2xl p-3 flex flex-col gap-2 shadow-sm w-24 active:scale-95 transition-transform">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#FEF3C7' }}>
                <UserCheck className="w-4.5 h-4.5 text-amber-600" />
              </div>
              <div className="text-xs font-bold text-slate-900 leading-tight">Take Attendance</div>
              <div className="text-[10px] text-slate-500 -mt-0.5 font-medium">Daily register</div>
            </Link>
            <Link href="/dashboard/grades" className="flex-shrink-0 bg-white border border-slate-200 rounded-2xl p-3 flex flex-col gap-2 shadow-sm w-24 active:scale-95 transition-transform">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#EDE9FE' }}>
                <PenTool className="w-4.5 h-4.5 text-violet-600" />
              </div>
              <div className="text-xs font-bold text-slate-900 leading-tight">Enter Grades</div>
              <div className="text-[10px] text-slate-500 -mt-0.5 font-medium">Marks entry</div>
            </Link>
            <Link href="/dashboard/homework" className="flex-shrink-0 bg-white border border-slate-200 rounded-2xl p-3 flex flex-col gap-2 shadow-sm w-24 active:scale-95 transition-transform">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#DCFCE7' }}>
                <FileText className="w-4.5 h-4.5 text-green-600" />
              </div>
              <div className="text-xs font-bold text-slate-900 leading-tight">Assign Homework</div>
              <div className="text-[10px] text-slate-500 -mt-0.5 font-medium">Create assignment</div>
            </Link>
            <Link href="/dashboard/lesson-plans" className="flex-shrink-0 bg-white border border-slate-200 rounded-2xl p-3 flex flex-col gap-2 shadow-sm w-24 active:scale-95 transition-transform">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#FEFCE8' }}>
                <ClipboardList className="w-4.5 h-4.5 text-yellow-600" />
              </div>
              <div className="text-xs font-bold text-slate-900 leading-tight">Lesson Plans</div>
              <div className="text-[10px] text-slate-500 -mt-0.5 font-medium">Plan lessons</div>
            </Link>
          </div>
        </div>

        {/* CLASSES & SUBJECTS */}
        <div className="grid grid-cols-2 gap-3">
          {/* CLASSES */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm">
            <h3 className="text-sm font-extrabold text-slate-900">My Classes</h3>
            <p className="text-[10.5px] text-slate-500 mt-0.5 mb-3 font-medium">{myClasses.length} classes assigned</p>
            <div className="h-px bg-slate-200 mb-3"></div>
            <div className="grid grid-cols-2 gap-1.5">
              {myClasses.map((cls: any) => (
                <Link key={cls.id} href={`/dashboard/grades?class=${cls.id}`} className="border border-slate-200 rounded-xl p-2 text-center active:bg-slate-100 transition-colors">
                  <div className="flex justify-center mb-1">
                    <Building2 className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div className="text-[10.5px] font-bold text-slate-900">{cls.name}</div>
                  <div className="text-[9px] text-slate-500 mt-0.5 font-medium">{getStudentCountForClass(cls.id)} students</div>
                </Link>
              ))}
            </div>
          </div>

          {/* SUBJECTS */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm">
            <h3 className="text-sm font-extrabold text-slate-900">My Subjects</h3>
            <p className="text-[10.5px] text-slate-500 mt-0.5 mb-3 font-medium">{mySubjects.length} subjects assigned</p>
            <div className="h-px bg-slate-200 mb-3"></div>
            <div className="grid grid-cols-2 gap-1.5">
              {mySubjects.map((subject: any) => (
                <Link key={subject.id} href={`/dashboard/grades?subject=${subject.id}`} className="border border-slate-200 rounded-xl p-2 text-center active:bg-slate-100 transition-colors">
                  <div className="flex justify-center mb-1">
                    <BookOpen className="w-3.5 h-3.5 text-violet-600" />
                  </div>
                  <div className="text-[10.5px] font-bold text-slate-900">{subject.name}</div>
                  <div className="text-[9px] text-slate-500 mt-0.5 font-medium">{subject.code}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM NAV */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full bg-white border-t border-slate-200 flex py-2.5 px-1 shadow-lg z-100" style={{ maxWidth: 430 }}>
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = item.active
          return (
            <Link key={item.href} href={item.href} className="flex-1 flex flex-col items-center gap-0.5 py-1 px-0.5 rounded-xl">
              <Icon className={`w-5 h-5 ${isActive ? 'text-[#1D4ED8]' : 'text-slate-400'}`} />
              <span className={`text-[9.5px] font-semibold ${isActive ? 'text-[#1D4ED8] font-extrabold' : 'text-slate-500'}`}>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

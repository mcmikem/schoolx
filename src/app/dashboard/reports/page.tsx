'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useStudents, useClasses } from '@/lib/hooks'
import { getUNEBGrade, getUNEBDivision } from '@/lib/grading'
import { 
  Search, 
  Printer, 
  Download, 
  FileText, 
  LayoutDashboard, 
  Filter, 
  ChevronRight, 
  Award, 
  Loader2, 
  User,
  Zap,
  Target,
  Trophy,
  Activity
} from 'lucide-react'
import ReportCard from '@/components/reports/ReportCard'
import type { ReportCard as ReportCardType } from '@/types'
import { supabase } from '@/lib/supabase'

export default function ReportsPage() {
  const { school } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const { students, loading: studentsLoading } = useStudents(school?.id)
  const { classes } = useClasses(school?.id)
  
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [reportData, setReportData] = useState<ReportCardType | null>(null)
  const [meritList, setMeritList] = useState<Array<{
    pos: number
    id: string
    name: string
    avg: number
    grade: string
    division: string
  }>>([])
  const [loadingReport, setLoadingReport] = useState(false)
  const [loadingMerit, setLoadingMerit] = useState(false)

  const filteredStudents = students.filter(s => {
    const matchesSearch = `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         s.student_number?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesClass = selectedClass === '' || s.class_id === selectedClass
    return matchesSearch && matchesClass
  })

  const fetchStudentReport = useCallback(async (studentId: string) => {
    try {
      setLoadingReport(true)
      const student = students.find(s => s.id === studentId)
      if (!student) return

      const { data: grades } = await supabase
        .from('grades')
        .select('*, subjects(name, code)')
        .eq('student_id', studentId)
        .eq('term', currentTerm)
        .eq('academic_year', academicYear)

      const { data: attendance } = await supabase
        .from('attendance')
        .select('status')
        .eq('student_id', studentId)

      // Group grades by subject
      const subjectGrades: Record<string, {name: string, code: string, scores: Record<string, number>}> = {}
      grades?.forEach(g => {
        const subjectName = (g.subjects as {name: string, code: string})?.name || 'Unknown'
        const subjectCode = (g.subjects as {name: string, code: string})?.code || ''
        if (!subjectGrades[subjectName]) {
          subjectGrades[subjectName] = { name: subjectName, code: subjectCode, scores: {} }
        }
        subjectGrades[subjectName].scores[g.assessment_type] = Number(g.score || 0)
      })

      const subjects = Object.values(subjectGrades).map(sg => {
        const ca1 = sg.scores['ca1'] || 0
        const ca2 = sg.scores['ca2'] || 0
        const ca3 = sg.scores['ca3'] || 0
        const ca4 = sg.scores['ca4'] || 0
        const project = sg.scores['project'] || 0
        const exam = sg.scores['exam'] || 0
        const caAvg = (ca1 + ca2 + ca3 + ca4 + project) / 5
        const final = (caAvg * 0.8) + (exam * 0.2)
        return {
          name: sg.name,
          code: sg.code,
          ca1,
          ca2,
          ca3,
          ca4,
          project,
          exam,
          totalCA: caAvg,
          finalScore: final,
          grade: getUNEBGrade(final)
        }
      })

      const avgScore = subjects.length > 0 ? subjects.reduce((acc, s) => acc + s.finalScore, 0) / subjects.length : 0

      // Calculate actual attendance total from records
      const totalAttendanceDays = attendance?.length || 0
      const presentDays = attendance?.filter(a => a.status === 'present').length || 0
      const absentDays = attendance?.filter(a => a.status === 'absent').length || 0
      const lateDays = attendance?.filter(a => a.status === 'late').length || 0

      setReportData({
        student: {
          first_name: student.first_name,
          last_name: student.last_name,
          student_number: student.student_number || 'N/A',
          gender: student.gender,
          classes: student.classes
        },
        school: {
          name: school?.name || 'Omuto School',
          district: school?.district || 'Uganda',
        },
        term: currentTerm,
        academicYear: academicYear,
        subjects,
        attendance: {
          total: totalAttendanceDays || 90,
          present: presentDays,
          absent: absentDays,
          late: lateDays,
        },
        overall: {
          average: Math.round(avgScore),
          grade: getUNEBGrade(avgScore),
          division: getUNEBDivision(avgScore)
        }
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingReport(false)
    }
  }, [students, school])

  useEffect(() => {
    async function fetchMeritList() {
      if (!selectedClass || !school?.id) return
      try {
        setLoadingMerit(true)
        const { data: grades } = await supabase
          .from('grades')
          .select('student_id, score, students!inner(first_name, last_name, class_id)')
          .eq('students.class_id', selectedClass)

        const studentAgg: any = {}
        grades?.forEach((g: any) => {
          const studentInfo = Array.isArray(g.students) ? g.students[0] : g.students
          if (!studentAgg[g.student_id]) studentAgg[g.student_id] = { name: `${studentInfo?.first_name || ''} ${studentInfo?.last_name || ''}`.trim(), total: 0, count: 0 }
          studentAgg[g.student_id].total += g.score
          studentAgg[g.student_id].count++
        })

        const ranked = Object.keys(studentAgg).map(id => {
          const avg = Math.round(studentAgg[id].total / studentAgg[id].count)
          return {
            id,
            name: studentAgg[id].name,
            avg,
            grade: getUNEBGrade(avg),
            division: getUNEBDivision(avg)
          }
        }).sort((a, b) => b.avg - a.avg).map((s, i) => ({ ...s, pos: i + 1 }))

        setMeritList(ranked)
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingMerit(false)
      }
    }
    fetchMeritList()
  }, [selectedClass, school?.id])

  return (
    <div className="space-y-12 pb-24 animate-fade-in relative z-10">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <div className="flex items-center gap-3 mb-3">
             <div className="w-8 h-8 rounded-lg bg-primary-800 flex items-center justify-center shadow-lg shadow-primary-500/20">
               <FileText className="w-4 h-4 text-white fill-white" />
             </div>
             <span className="text-[10px] font-black text-primary-800 uppercase tracking-[4px]">Scholastic Records</span>
          </div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Reports & Merit Lists</h1>
          <p className="text-gray-400 font-bold mt-2 text-base max-w-lg">Generate UNEB-aligned digital report cards and class-wide merit rankings.</p>
        </div>
      </div>

      {/* Advanced Glass Filter Bar */}
      <div className="bg-white/40 backdrop-blur-md rounded-[48px] border border-white/60 shadow-2xl shadow-gray-200/20 p-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] pl-1">Target Scholar</label>
            <div className="relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary-800 transition-smooth" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ID or Name..."
                className="w-full pl-12 pr-6 py-4 bg-white/60 border border-white/60 rounded-[20px] text-sm font-black focus:bg-white focus:ring-4 focus:ring-primary-100 outline-none transition-smooth shadow-sm"
              />
            </div>
          </div>
          
          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] pl-1">Classroom</label>
            <select 
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full bg-white/60 border border-white/60 rounded-[20px] py-4 px-6 text-sm font-black text-gray-700 focus:ring-4 focus:ring-primary-100 outline-none appearance-none cursor-pointer shadow-sm"
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] pl-1">Term Cycle</label>
            <select 
              value={currentTerm}
              disabled
              className="w-full bg-white/60 border border-white/60 rounded-[20px] py-4 px-6 text-sm font-black text-gray-700 focus:ring-4 focus:ring-primary-100 outline-none appearance-none cursor-pointer shadow-sm"
            >
              <option value="1">Term {currentTerm} - {academicYear}</option>
            </select>
          </div>

          <div className="pt-7">
             <button className="w-full h-[56px] bg-gray-900 text-white rounded-[20px] font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-gray-900/20 active:scale-95">
               Refresh Data
             </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Scholar Selector Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white/70 backdrop-blur-xl rounded-[56px] border border-white/60 shadow-2xl shadow-gray-200/20 flex flex-col h-[700px] overflow-hidden">
            <div className="p-8 border-b border-white/20">
              <h3 className="text-lg font-black text-gray-900 tracking-tight">Scholar Roster</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{filteredStudents.length} Profiles Found</p>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {studentsLoading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary-800" /></div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-20">
                   <User className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                   <p className="text-xs font-black text-gray-300 uppercase tracking-widest">No profiles detected</p>
                </div>
              ) : (
                filteredStudents.map(student => (
                  <button
                    key={student.id}
                    onClick={() => {
                      setSelectedStudentId(student.id)
                      fetchStudentReport(student.id)
                    }}
                    className={`w-full flex items-center gap-5 p-5 rounded-[28px] transition-all duration-300 text-left group ${
                      selectedStudentId === student.id 
                        ? 'bg-primary-800 text-white shadow-xl shadow-primary-500/30 -translate-y-1' 
                        : 'hover:bg-white/60 border border-transparent'
                    }`}
                  >
                    <div className={`w-14 h-14 rounded-2xl overflow-hidden shadow-sm flex-shrink-0 transition-transform duration-500 ${selectedStudentId === student.id ? 'scale-110' : 'group-hover:scale-105'}`}>
                       <img src={`https://ui-avatars.com/api/?name=${student.first_name}+${student.last_name}&background=random&color=fff&bold=true`} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-[15px] font-black leading-tight truncate ${selectedStudentId === student.id ? 'text-white' : 'text-gray-900'}`}>
                        {student.first_name} {student.last_name}
                      </p>
                      <p className={`text-[10px] font-bold uppercase tracking-tight mt-1 ${selectedStudentId === student.id ? 'text-primary-100' : 'text-gray-400'}`}>
                        {student.classes?.name || 'Class Unassigned'}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Report Viewport */}
        <div className="lg:col-span-8 flex flex-col gap-8">
           {loadingReport ? (
             <div className="bg-white/70 backdrop-blur-xl rounded-[56px] border border-white/60 shadow-2xl shadow-gray-200/20 p-24 flex flex-col items-center justify-center h-full">
                <Loader2 className="w-14 h-14 animate-spin text-primary-800 mb-6" />
                <h3 className="text-xl font-black text-gray-900">Synchronizing Data</h3>
                <p className="text-gray-400 font-bold uppercase tracking-[3px] text-xs mt-2">Computing academic metrics...</p>
             </div>
           ) : reportData ? (
             <div className="bg-white/40 backdrop-blur-md rounded-[56px] p-10 md:p-14 border border-white/60 shadow-2xl shadow-gray-200/20 flex flex-col items-center">
                <div className="flex items-center justify-between w-full mb-10">
                   <div className="flex items-center gap-4">
                      <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Digital Preview Active</span>
                   </div>
                   <div className="flex gap-4">
                      <button className="p-4 bg-white rounded-2xl text-gray-400 hover:text-primary-800 transition-smooth shadow-sm border border-gray-100"><Printer className="w-6 h-6" /></button>
                      <button className="px-8 py-4 bg-primary-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary-500/20 hover:bg-black transition-all active:scale-95">Finalize & Export</button>
                   </div>
                </div>
                
                <div className="shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] transform hover:scale-[1.01] transition-all duration-700 w-full overflow-hidden rounded-3xl">
                   <ReportCard report={reportData} />
                </div>
                
                <div className="mt-12 flex items-center gap-3">
                   <Zap className="w-4 h-4 text-primary-300" />
                   <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.4em]">Integrated Intelligence Output</p>
                </div>
             </div>
           ) : (
             <div className="bg-white/70 backdrop-blur-xl rounded-[56px] border border-white/60 shadow-2xl shadow-gray-200/20 p-24 flex flex-col items-center justify-center h-full text-center">
                <div className="w-24 h-24 bg-primary-50 rounded-[40px] flex items-center justify-center mb-8 shadow-inner shadow-primary-100/50">
                  <Activity className="w-12 h-12 text-primary-200" />
                </div>
                <h3 className="text-3xl font-black text-gray-900 tracking-tight">Awaiting Input</h3>
                <p className="text-gray-400 font-bold mt-3 max-w-sm text-base">Select a scholar from the roster to generate a high-fidelity digital report card.</p>
             </div>
           )}
        </div>
      </div>

      {/* Extreme Merit Ranking Board */}
      {selectedClass && (
        <div className="bg-white/70 backdrop-blur-xl rounded-[72px] border border-white/60 shadow-2xl shadow-gray-200/20 overflow-hidden animate-in fade-in slide-in-from-bottom-10 duration-700">
          <div className="p-12 border-b border-white/20 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="flex items-center gap-6">
               <div className="w-16 h-16 bg-primary-800 rounded-[28px] flex items-center justify-center shadow-2xl shadow-primary-500/30">
                  <Trophy className="w-8 h-8 text-white" />
               </div>
               <div>
                  <h2 className="text-3xl font-black text-gray-900 tracking-tight">
                    {classes.find(c => c.id === selectedClass)?.name} Merit Index
                  </h2>
                  <div className="flex items-center gap-4 mt-1">
                    <p className="text-primary-600 font-black text-xs uppercase tracking-[3px]">Academic Cycle 2026/01</p>
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-200" />
                    <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">{meritList.length} SCHOLARS RANKED</p>
                  </div>
               </div>
            </div>
             <button className="bg-white border border-gray-100 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-900 hover:bg-gray-50 transition-smooth shadow-xl shadow-gray-200/20 flex items-center gap-3">
              <Download className="w-5 h-5 text-primary-800" /> Download Full Index
            </button>
          </div>

          <div className="overflow-x-auto p-4 lg:p-10">
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="px-8 py-8 text-[11px] font-black text-gray-400 uppercase tracking-[3px]">Ranking</th>
                  <th className="px-4 py-8 text-[11px] font-black text-gray-400 uppercase tracking-[3px]">Scholastic Profile</th>
                  <th className="px-4 py-8 text-[11px] font-black text-gray-400 uppercase tracking-[3px] text-center">GPA Index</th>
                  <th className="px-4 py-8 text-[11px] font-black text-gray-400 uppercase tracking-[3px] text-center">Peak Grade</th>
                  <th className="px-8 py-8 text-[11px] font-black text-gray-400 uppercase tracking-[3px] text-center">System Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loadingMerit ? (
                  <tr><td colSpan={5} className="py-24 text-center"><Loader2 className="w-10 h-10 animate-spin text-primary-800 mx-auto" /></td></tr>
                ) : meritList.length === 0 ? (
                  <tr><td colSpan={5} className="py-24 text-center text-gray-300 font-black uppercase tracking-[5px]">Data synchronization required.</td></tr>
                ) : (
                  meritList.map((s) => (
                    <tr key={s.id} className="group hover:bg-white/80 transition-smooth">
                      <td className="px-8 py-8">
                        <div className={`w-12 h-12 rounded-[18px] flex items-center justify-center text-sm font-black shadow-xl transition-all duration-500 group-hover:scale-110 ${
                          s.pos === 1 ? 'bg-amber-100 text-amber-700 shadow-amber-500/20' : 
                          s.pos === 2 ? 'bg-gray-100 text-gray-600 shadow-gray-500/10' :
                          s.pos === 3 ? 'bg-orange-100 text-orange-700 shadow-orange-500/20' :
                          'bg-white text-gray-400 border border-gray-100'
                        }`}>
                          {s.pos}
                        </div>
                      </td>
                      <td className="px-4 py-8 font-black text-gray-900 text-lg group-hover:text-primary-800 transition-smooth">{s.name}</td>
                      <td className="px-4 py-8 text-center">
                         <div className="flex flex-col items-center">
                            <span className="text-2xl font-black text-gray-900 tracking-tighter">{s.avg}%</span>
                            <div className="w-12 h-1 bg-gray-100 rounded-full mt-2 overflow-hidden">
                               <div className="h-full bg-primary-800 rounded-full" style={{ width: `${s.avg}%` }} />
                            </div>
                         </div>
                      </td>
                      <td className="px-4 py-8 text-center">
                        <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-br from-primary-800 to-indigo-600">{s.grade}</span>
                      </td>
                      <td className="px-8 py-8 text-center">
                        <span className={`inline-block px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[2px] shadow-lg transition-all duration-500 group-hover:px-10 ${
                          s.division === 'Division I' ? 'bg-emerald-500 text-white shadow-emerald-500/30' :
                          s.division === 'Division II' ? 'bg-primary-800 text-white shadow-primary-500/30' :
                          'bg-amber-400 text-white shadow-amber-500/30'
                        }`}>
                          {s.division}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

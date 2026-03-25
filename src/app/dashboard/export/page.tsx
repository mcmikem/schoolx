'use client'
import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useStudents, useClasses } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

export default function ExportPage() {
  const { school } = useAuth()
  const toast = useToast()
  const { students } = useStudents(school?.id)
  const { classes } = useClasses(school?.id)
  const [selectedClass, setSelectedClass] = useState('all')
  const [exportType, setExportType] = useState<'students' | 'uneb' | 'grades' | 'attendance' | 'fees'>('students')
  const [exporting, setExporting] = useState(false)

  const filteredStudents = useMemo(() => {
    if (selectedClass === 'all') return students
    return students.filter(s => s.class_id === selectedClass)
  }, [students, selectedClass])

  const exportToExcel = async () => {
    setExporting(true)
    try {
      const XLSX = await import('xlsx')

      let data: any[] = []
      let filename = ''

      switch (exportType) {
        case 'students':
          data = filteredStudents.map(s => ({
            'First Name': s.first_name,
            'Last Name': s.last_name,
            'Gender': s.gender === 'M' ? 'Male' : 'Female',
            'Student Number': s.student_number || '',
            'Class': s.classes?.name || '',
            'Parent Name': s.parent_name || '',
            'Parent Phone': s.parent_phone || '',
            'Parent Phone 2': s.parent_phone2 || '',
            'Date of Birth': s.date_of_birth || '',
            'Status': s.status || 'active',
          }))
          filename = 'students_export.xlsx'
          break

        case 'uneb':
          data = filteredStudents.map(s => ({
            'Index Number': s.ple_index_number || '',
            'Student Number': s.student_number || '',
            'First Name': s.first_name,
            'Last Name': s.last_name,
            'Gender': s.gender === 'M' ? 'Male' : 'Female',
            'Date of Birth': s.date_of_birth || '',
            'Class': s.classes?.name || '',
            'School Code': school?.school_code || '',
          }))
          filename = 'uneb_candidate_list.xlsx'
          break

        case 'grades':
          const { data: grades } = await supabase
            .from('grades')
            .select('*, students(first_name, last_name, student_number), subjects(name, code)')
            .eq('class_id', selectedClass !== 'all' ? selectedClass : undefined)
          
          data = grades?.map(g => ({
            'Student Name': `${g.students?.first_name} ${g.students?.last_name}`,
            'Student Number': g.students?.student_number || '',
            'Subject': g.subjects?.name || '',
            'Assessment': g.assessment_type,
            'Score': g.score,
            'Term': g.term,
            'Year': g.academic_year,
          })) || []
          filename = 'grades_export.xlsx'
          break

        case 'attendance':
          const { data: attendance } = await supabase
            .from('attendance')
            .select('*, students(first_name, last_name, student_number)')
            .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          
          data = attendance?.map(a => ({
            'Student Name': `${a.students?.first_name} ${a.students?.last_name}`,
            'Student Number': a.students?.student_number || '',
            'Date': a.date,
            'Status': a.status,
          })) || []
          filename = 'attendance_export.xlsx'
          break

        case 'fees':
          const { data: payments } = await supabase
            .from('fee_payments')
            .select('*, students(first_name, last_name, student_number)')
          
          data = payments?.map(p => ({
            'Student Name': `${p.students?.first_name} ${p.students?.last_name}`,
            'Student Number': p.students?.student_number || '',
            'Amount': p.amount_paid,
            'Method': p.payment_method,
            'Reference': p.payment_reference || '',
            'Date': p.payment_date,
          })) || []
          filename = 'fees_export.xlsx'
          break
      }

      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Data')
      XLSX.writeFile(wb, filename)

      toast.success('Export downloaded successfully')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Export Data</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Export school data to Excel</p>
      </div>

      <div className="card max-w-2xl">
        <div className="space-y-6">
          {/* Export Type */}
          <div>
            <label className="label">What do you want to export?</label>
            <select 
              value={exportType} 
              onChange={(e) => setExportType(e.target.value as any)}
              className="input"
            >
              <option value="students">Student List</option>
              <option value="uneb">UNEB Candidate List</option>
              <option value="grades">Grades</option>
              <option value="attendance">Attendance Records</option>
              <option value="fees">Fee Payments</option>
            </select>
          </div>

          {/* Class Filter */}
          <div>
            <label className="label">Class</label>
            <select 
              value={selectedClass} 
              onChange={(e) => setSelectedClass(e.target.value)}
              className="input"
            >
              <option value="all">All Classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Preview */}
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {exportType === 'students' && `${filteredStudents.length} students will be exported`}
              {exportType === 'uneb' && `${filteredStudents.filter(s => s.ple_index_number).length} students with PLE index numbers`}
              {exportType === 'grades' && 'All grade records for selected class'}
              {exportType === 'attendance' && 'Last 30 days attendance records'}
              {exportType === 'fees' && 'All fee payment records'}
            </div>
          </div>

          {/* Export Button */}
          <button 
            onClick={exportToExcel} 
            disabled={exporting}
            className="btn btn-primary w-full"
          >
            {exporting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Exporting...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Excel File
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Export Tips */}
      <div className="card mt-6 max-w-2xl">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Export Tips</h2>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-green-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span><strong>UNEB Export:</strong> Use this to fill UNEB registration forms. Make sure students have PLE index numbers.</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-green-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span><strong>Student List:</strong> Export all student records including parent contacts.</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-green-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span><strong>Grades:</strong> Export all grade records for analysis or backup.</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-green-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span><strong>Fees:</strong> Export payment records for accounting or audits.</span>
          </li>
        </ul>
      </div>
    </div>
  )
}

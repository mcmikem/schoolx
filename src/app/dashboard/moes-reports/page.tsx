'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'
import MaterialIcon from '@/components/MaterialIcon'

export default function MOESReportsPage() {
  const { school } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  
  const [loading, setLoading] = useState(false)
  const [reportType, setReportType] = useState('headcount')
  const [exporting, setExporting] = useState(false)
  const [reportData, setReportData] = useState<any>(null)

  const generateReport = async () => {
    setLoading(true)
    try {
      // Get all students
      const { data: students } = await supabase
        .from('students')
        .select('*, classes(level, name)')
        .eq('school_id', school?.id)

      // Get all staff
      const { data: staff } = await supabase
        .from('users')
        .select('*')
        .eq('school_id', school?.id)

      // Get classes
      const { data: classes } = await supabase
        .from('classes')
        .select('*')
        .eq('school_id', school?.id)

      const maleStudents = students?.filter(s => s.gender === 'M').length || 0
      const femaleStudents = students?.filter(s => s.gender === 'F').length || 0
      const totalStudents = maleStudents + femaleStudents

      const maleStaff = staff?.filter(s => s.gender === 'M').length || 0
      const femaleStaff = staff?.filter(s => s.gender === 'F').length || 0
      const totalStaff = maleStaff + femaleStaff

      // Build report data
      const data: any = {
        school: {
          name: school?.name || '',
          code: school?.school_code || '',
          district: school?.district || '',
          type: (school as any)?.school_type || '',
          ownership: (school as any)?.ownership || '',
        },
        academicYear,
        term: currentTerm,
        dateGenerated: new Date().toISOString(),
        summary: {
          totalStudents,
          maleStudents,
          femaleStudents,
          totalStaff,
          maleStaff,
          femaleStaff,
          totalClasses: classes?.length || 0,
        },
        byClass: classes?.map(c => {
          const classStudents = students?.filter(s => s.class_id === c.id) || []
          return {
            class: c.name,
            level: c.level,
            male: classStudents.filter(s => s.gender === 'M').length,
            female: classStudents.filter(s => s.gender === 'F').length,
            total: classStudents.length
          }
        }) || []
      }

      setReportData(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const exportToExcel = () => {
    if (!reportData) return

    setExporting(true)
    try {
      const wb = XLSX.utils.book_new()

      // Summary Sheet
      const summaryData = [
        ['MOES EMIS REPORT - HEADCOUNT'],
        [''],
        ['School Name', reportData.school.name],
        ['School Code', reportData.school.code],
        ['District', reportData.school.district],
        ['School Type', reportData.school.type],
        ['Ownership', reportData.school.ownership],
        ['Academic Year', reportData.academicYear],
        ['Term', reportData.term],
        [''],
        ['SUMMARY'],
        ['Total Students', reportData.summary.totalStudents],
        ['Male Students', reportData.summary.maleStudents],
        ['Female Students', reportData.summary.femaleStudents],
        ['Total Staff', reportData.summary.totalStaff],
        ['Male Staff', reportData.summary.maleStaff],
        ['Female Staff', reportData.summary.femaleStaff],
        ['Total Classes', reportData.summary.totalClasses],
      ]
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
      XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

      // By Class Sheet
      const classData = [['Class', 'Level', 'Male', 'Female', 'Total']]
      reportData.byClass.forEach((c: any) => {
        classData.push([c.class, c.level, c.male, c.female, c.total])
      })
      const classSheet = XLSX.utils.aoa_to_sheet(classData)
      XLSX.utils.book_append_sheet(wb, classSheet, 'By Class')

      // Save
      XLSX.writeFile(wb, `MOES_EMIS_${school?.school_code}_${academicYear}_T${currentTerm}.xlsx`)
    } catch (err) {
      console.error(err)
    } finally {
      setExporting(false)
    }
  }

  const exportToJSON = () => {
    if (!reportData) return
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `MOES_EMIS_${school?.school_code}_${academicYear}_T${currentTerm}.json`
    a.click()
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">MOES EMIS Reports</h1>
        <p className="text-[#5c6670] mt-1">Generate reports for Ministry of Education & Sports</p>
      </div>

      {/* Controls */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Report Type</label>
              <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="input">
                <option value="headcount">Student Headcount</option>
                <option value="staff">Staff Returns</option>
                <option value="facility">Facility Inventory</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Academic Year</label>
              <input value={academicYear} disabled className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">&nbsp;</label>
              <button onClick={generateReport} disabled={loading} className="btn btn-primary w-full">
                {loading ? 'Generating...' : 'Generate Report'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Report Preview */}
      {reportData && (
        <>
          <div className="card mb-4">
            <div className="card-header">
              <div className="card-title">Report Preview</div>
              <div className="flex gap-2">
                <button onClick={exportToExcel} disabled={exporting} className="btn btn-sm bg-green-600 text-white">
                  <MaterialIcon icon="download" style={{ fontSize: 16 }} />
                  Export Excel
                </button>
                <button onClick={exportToJSON} className="btn btn-sm bg-blue-600 text-white">
                  <MaterialIcon icon="code" style={{ fontSize: 16 }} />
                  Export JSON
                </button>
              </div>
            </div>
            <div className="card-body">
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-[#002045]">{reportData.summary.totalStudents}</div>
                  <div className="text-sm text-[#5c6670]">Total Students</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{reportData.summary.maleStudents}</div>
                  <div className="text-sm text-[#5c6670]">Male</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-pink-600">{reportData.summary.femaleStudents}</div>
                  <div className="text-sm text-[#5c6670]">Female</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{reportData.summary.totalClasses}</div>
                  <div className="text-sm text-[#5c6670]">Classes</div>
                </div>
              </div>

              {/* By Class Table */}
              <h3 className="font-bold mb-3">Students by Class</h3>
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Class</th>
                      <th>Level</th>
                      <th>Male</th>
                      <th>Female</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.byClass.map((c: any, idx: number) => (
                      <tr key={idx}>
                        <td>{c.class}</td>
                        <td>{c.level}</td>
                        <td>{c.male}</td>
                        <td>{c.female}</td>
                        <td className="font-bold">{c.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Submit to DEO */}
          <div className="card">
            <div className="card-body">
              <h3 className="font-bold mb-3">Submit to District Education Officer</h3>
              <p className="text-sm text-[#5c6670] mb-4">
                This report can be submitted to your District Education Officer (DEO) for official records.
              </p>
              <button className="btn btn-primary">
                <MaterialIcon icon="send" style={{ fontSize: 18 }} />
                Submit Report to DEO
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

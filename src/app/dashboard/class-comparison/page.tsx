'use client'
import { useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useStudents, useClasses } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import MaterialIcon from '@/components/MaterialIcon'

export default function ClassComparisonPage() {
  const { school } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const toast = useToast()
  const { students } = useStudents(school?.id)
  const { classes } = useClasses(school?.id)

  // Calculate class statistics
  const classStats = useMemo(() => {
    return classes.map(cls => {
      const classStudents = students.filter(s => s.class_id === cls.id)
      const boys = classStudents.filter(s => s.gender === 'M').length
      const girls = classStudents.filter(s => s.gender === 'F').length

      return {
        id: cls.id,
        name: cls.name,
        total: classStudents.length,
        boys,
        girls,
        genderRatio: classStudents.length > 0 ? Math.round((girls / classStudents.length) * 100) : 0,
      }
    }).sort((a, b) => b.total - a.total)
  }, [classes, students])

  const totals = useMemo(() => ({
    students: classStats.reduce((sum, c) => sum + c.total, 0),
    boys: classStats.reduce((sum, c) => sum + c.boys, 0),
    girls: classStats.reduce((sum, c) => sum + c.girls, 0),
  }), [classStats])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Class Comparison</h1>
        <p className="text-[#5c6670] mt-1">Compare performance across classes</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
          <div className="stat-value">{totals.students}</div>
          <div className="stat-label">Total Students</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
          <div className="stat-value text-blue-600">{totals.boys}</div>
          <div className="stat-label">Boys</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
          <div className="stat-value text-pink-600">{totals.girls}</div>
          <div className="stat-label">Girls</div>
        </div>
      </div>

      {/* Class Comparison Table */}
      <div className="table-wrapper">
        <table className="table">
          <thead className="bg-[#f8fafb]">
            <tr>
              <th>Class</th>
              <th>Total</th>
              <th>Boys</th>
              <th>Girls</th>
              <th>Gender Ratio</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {classStats.map((cls) => (
              <tr key={cls.id}>
                <td className="font-medium text-[#002045]">{cls.name}</td>
                <td>{cls.total}</td>
                <td className="text-blue-600">{cls.boys}</td>
                <td className="text-pink-600">{cls.girls}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-pink-500 rounded-full" 
                        style={{ width: `${cls.genderRatio}%` }}
                      />
                    </div>
                    <span className="text-sm text-[#5c6670]">{cls.genderRatio}%</span>
                  </div>
                </td>
                <td>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    cls.total > 50 ? 'bg-[#fff3e0] text-[#e65100]' : cls.total > 30 ? 'bg-[#e3f2fd] text-[#1565c0]' : 'bg-[#e8f5e9] text-[#006e1c]'
                  }`}>
                    {cls.total > 50 ? 'Large' : cls.total > 30 ? 'Medium' : 'Small'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Info */}
      <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 mt-6 max-w-2xl">
        <h2 className="font-semibold text-[#002045] mb-4">About Class Comparison</h2>
        <ul className="space-y-2 text-sm text-[#5c6670]">
          <li>Compare student enrollment across classes</li>
          <li>Identify overcrowded or underpopulated classes</li>
          <li>Track gender balance by class</li>
          <li>Help with resource allocation decisions</li>
        </ul>
      </div>
    </div>
  )
}

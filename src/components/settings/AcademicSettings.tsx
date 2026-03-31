'use client'

import { useAcademic } from '@/lib/academic-context'
import MaterialIcon from '@/components/MaterialIcon'

export default function AcademicSettings() {
  const { academicYear, currentTerm, setAcademicYear, setCurrentTerm } = useAcademic()

  return (
    <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 max-w-2xl mt-6">
      <h2 className="text-lg font-semibold text-[#191c1d] mb-6 flex items-center gap-2">
        <MaterialIcon icon="calendar_month" className="text-primary" />
        Academic Configuration
      </h2>
      <p className="text-sm text-on-surface-variant mb-6">
        Set the active academic year and term for the entire school. This controls all dashboards, fee reports, and grade books.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="text-sm font-medium text-[#191c1d] mb-2 block">Active Academic Year</label>
          <select 
            value={academicYear} 
            onChange={(e) => setAcademicYear(e.target.value)}
            className="input w-full"
          >
            {Array.from({length: 5}).map((_, i) => {
              const year = new Date().getFullYear() - 2 + i;
              return <option key={year} value={year.toString()}>{year}</option>
            })}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-[#191c1d] mb-2 block">Current Term</label>
          <select 
            value={currentTerm}
            onChange={(e) => setCurrentTerm(Number(e.target.value) as 1|2|3)}
            className="input w-full"
          >
            <option value={1}>Term 1</option>
            <option value={2}>Term 2</option>
            <option value={3}>Term 3</option>
          </select>
        </div>
      </div>
    </div>
  )
}
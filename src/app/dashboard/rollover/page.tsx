'use client'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useStudents, useClasses } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
}

export default function RolloverPage() {
  const { school } = useAuth()
  const { academicYear, currentTerm } = useAcademic()
  const toast = useToast()
  const { students } = useStudents(school?.id)
  const { classes } = useClasses(school?.id)
  
  const [newAcademicYear, setNewAcademicYear] = useState(String(Number(academicYear) + 1))
  const [promoting, setPromoting] = useState(false)
  const [rolloverType, setRolloverType] = useState<'term' | 'year'>('term')
  const [step, setStep] = useState(1)

  const handleTermRollover = async () => {
    if (!school?.id) return
    
    try {
      setPromoting(true)
      
      // Update academic context (in real app, this would be in database)
      localStorage.setItem('current_term', String(currentTerm < 3 ? currentTerm + 1 : 1))
      if (currentTerm === 3) {
        localStorage.setItem('academic_year', newAcademicYear)
      }

      toast.success(currentTerm < 3 ? `Term ${currentTerm + 1} started` : `New academic year ${newAcademicYear} started`)
      window.location.reload()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to rollover')
    } finally {
      setPromoting(false)
    }
  }

  const handleYearRollover = async () => {
    if (!school?.id) return

    try {
      setPromoting(true)

      // Archive current year data (mark completed students)
      const { data: currentClasses } = await supabase
        .from('classes')
        .select('id, name, level')
        .eq('school_id', school.id)
        .eq('academic_year', academicYear)

      // Mark P.7 and S.6 students as completed
      const graduatingStudents = students.filter(s => {
        const className = s.classes?.name || ''
        return className.includes('P.7') || className.includes('S.6')
      })

      for (const student of graduatingStudents) {
        await supabase
          .from('students')
          .update({ status: 'completed' })
          .eq('id', student.id)
      }

      // Create new classes for next year
      if (currentClasses) {
        for (const cls of currentClasses) {
          // Skip graduating classes
          if (cls.name.includes('P.7') || cls.name.includes('S.6')) continue

          // Promote class name (e.g., P.5 -> P.6)
          const level = cls.level
          const nameParts = cls.name.match(/([A-Z]\.)(\d+)/)
          if (nameParts) {
            const prefix = nameParts[1]
            const num = parseInt(nameParts[2])
            const newName = `${prefix}${num + 1}`

            await supabase.from('classes').insert({
              school_id: school.id,
              name: newName,
              level,
              academic_year: newAcademicYear,
              max_students: 60,
            })
          }
        }

        // Create P.1 and S.1 for new students
        await supabase.from('classes').insert({
          school_id: school.id,
          name: 'P.1',
          level: 'primary',
          academic_year: newAcademicYear,
          max_students: 60,
        })
      }

      // Update academic year
      localStorage.setItem('academic_year', newAcademicYear)
      localStorage.setItem('current_term', '1')

      toast.success(`Academic year ${newAcademicYear} setup complete`)
      setStep(4)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to rollover')
    } finally {
      setPromoting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Academic Rollover</h1>
        <p className="text-[#5c6670] mt-1">End of term or year transition</p>
      </div>

      {/* Current Status */}
      <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 mb-6 max-w-2xl">
        <h2 className="font-semibold text-[#002045] mb-4">Current Status</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-[#5c6670]">Academic Year</div>
            <div className="text-xl font-bold text-[#002045]">{academicYear}</div>
          </div>
          <div>
            <div className="text-sm text-[#5c6670]">Current Term</div>
            <div className="text-xl font-bold text-[#002045]">Term {currentTerm}</div>
          </div>
          <div>
            <div className="text-sm text-[#5c6670]">Active Students</div>
            <div className="text-xl font-bold text-[#002045]">{students.filter(s => s.status === 'active').length}</div>
          </div>
          <div>
            <div className="text-sm text-[#5c6670]">Classes</div>
            <div className="text-xl font-bold text-[#002045]">{classes.length}</div>
          </div>
        </div>
      </div>

      {/* Rollover Options */}
      <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 max-w-2xl">
        <h2 className="font-semibold text-[#002045] mb-4">Rollover Options</h2>
        
        <div className="space-y-4">
          {/* Term Rollover */}
          <div 
            onClick={() => setRolloverType('term')}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
              rolloverType === 'term' 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200'
            }`}
          >
            <div className="font-medium text-[#002045]">
              {currentTerm < 3 ? `Move to Term ${currentTerm + 1}` : 'Start New Academic Year'}
            </div>
            <div className="text-sm text-[#5c6670] mt-1">
              {currentTerm < 3 
                ? `Continue to next term within ${academicYear}`
                : `Start fresh for ${Number(academicYear) + 1}`
              }
            </div>
          </div>

          {/* Year Rollover */}
          <div 
            onClick={() => setRolloverType('year')}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
              rolloverType === 'year' 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200'
            }`}
          >
            <div className="font-medium text-[#002045]">Full Year Rollover</div>
            <div className="text-sm text-[#5c6670] mt-1">
              Promote students, graduate P.7/S.6, create new classes
            </div>
          </div>

          {rolloverType === 'year' && (
            <div className="mt-4">
              <label className="label">New Academic Year</label>
              <input
                type="text"
                value={newAcademicYear}
                onChange={(e) => setNewAcademicYear(e.target.value)}
                className="input"
                placeholder="2027"
              />
            </div>
          )}

          <div className="pt-4">
            <button 
              onClick={rolloverType === 'term' ? handleTermRollover : handleYearRollover}
              disabled={promoting}
              className="btn btn-primary w-full"
            >
              {promoting ? 'Processing...' : rolloverType === 'term' ? 'Start Next Term' : 'Start Year Rollover'}
            </button>
          </div>
        </div>
      </div>

      {/* Warning */}
      <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 mt-6 max-w-2xl bg-yellow-50">
        <h2 className="font-semibold text-yellow-800 mb-2">Important</h2>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>Make sure all grades are entered before rollover</li>
          <li>Print report cards before starting new term</li>
          <li>Year rollover will promote all students automatically</li>
          <li>P.7 and S.6 students will be marked as graduated</li>
        </ul>
      </div>
    </div>
  )
}

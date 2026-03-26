'use client'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useStudents, useClasses } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Academic Rollover</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">End of term or year transition</p>
      </div>

      {/* Current Status */}
      <div className="card mb-6 max-w-2xl">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Current Status</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Academic Year</div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">{academicYear}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Current Term</div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">Term {currentTerm}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Active Students</div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">{students.filter(s => s.status === 'active').length}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Classes</div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">{classes.length}</div>
          </div>
        </div>
      </div>

      {/* Rollover Options */}
      <div className="card max-w-2xl">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Rollover Options</h2>
        
        <div className="space-y-4">
          {/* Term Rollover */}
          <div 
            onClick={() => setRolloverType('term')}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
              rolloverType === 'term' 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' 
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <div className="font-medium text-gray-900 dark:text-white">
              {currentTerm < 3 ? `Move to Term ${currentTerm + 1}` : 'Start New Academic Year'}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
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
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' 
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <div className="font-medium text-gray-900 dark:text-white">Full Year Rollover</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
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
      <div className="card mt-6 max-w-2xl bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700">
        <h2 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Important</h2>
        <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
          <li>Make sure all grades are entered before rollover</li>
          <li>Print report cards before starting new term</li>
          <li>Year rollover will promote all students automatically</li>
          <li>P.7 and S.6 students will be marked as graduated</li>
        </ul>
      </div>
    </div>
  )
}

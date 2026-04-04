'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useStudents, useClasses } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import MaterialIcon from '@/components/MaterialIcon'
import { buildRolloverPreview, getNextClassName } from '@/lib/operations'
import { logAuditEventWithOfflineSupport } from '@/lib/audit'

export default function RolloverPage() {
  const router = useRouter()
  const { school } = useAuth()
  const { academicYear, currentTerm, setAcademicYear, setCurrentTerm } = useAcademic()
  const toast = useToast()
  const { students } = useStudents(school?.id)
  const { classes: allSchoolClasses } = useClasses(school?.id)
  
  const [newAcademicYear, setNewAcademicYear] = useState(String(Number(academicYear) + 1))
  const [promoting, setPromoting] = useState(false)
  const [rolloverType, setRolloverType] = useState<'term' | 'year'>('term')
  const [wizardOptions, setWizardOptions] = useState({
    archiveGrades: true,
    carryForwardBalances: true,
    resetOpeningBalances: false,
    archiveSummary: true,
  })
  const preview = buildRolloverPreview({
    academicYear,
    currentTerm,
    nextAcademicYear: newAcademicYear,
    schoolType: school?.school_type || 'primary',
    students,
    classes: allSchoolClasses,
  })

  const handleTermRollover = async () => {
    if (!school?.id) return
    
    try {
      setPromoting(true)
      
      if (currentTerm < 3) {
        await setCurrentTerm((currentTerm + 1) as 1 | 2 | 3)
        toast.success(`Term ${currentTerm + 1} started`)
      } else {
        await setAcademicYear(newAcademicYear)
        await setCurrentTerm(1)
        toast.success(`New academic year ${newAcademicYear} started`)
      }

      router.push('/dashboard')
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

      // 1. Mark P.7 and S.6 students as completed
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

      // 2. Get current year classes to clone/promote
      const currentYearClasses = allSchoolClasses.filter(c => c.academic_year === academicYear)
      const newClassesMap = new Map<string, string>()

      for (const cls of currentYearClasses) {
        // Skip graduating classes
        if (cls.name.includes('P.7') || cls.name.includes('S.6')) continue

        const nextName = getNextClassName(cls.name)
        
        const { data: newClass, error: classError } = await supabase.from('classes').insert({
          school_id: school.id,
          name: nextName,
          level: cls.level,
          academic_year: newAcademicYear,
          max_students: cls.max_students || 60,
          stream: cls.stream
        }).select().single()

        if (classError) throw classError
        if (newClass) newClassesMap.set(nextName, newClass.id)
      }

      // 3. Create entry-level classes if they don't exist (P.1, S.1)
      const entryClasses = school.school_type === 'secondary' ? ['S.1'] : (school.school_type === 'primary' ? ['P.1'] : ['P.1', 'S.1'])
      for (const name of entryClasses) {
        if (!newClassesMap.has(name)) {
          const { data: entryClass } = await supabase.from('classes').insert({
            school_id: school.id,
            name,
            level: name.includes('P') ? 'primary' : 'secondary',
            academic_year: newAcademicYear,
            max_students: 60
          }).select().single()
          if (entryClass) newClassesMap.set(name, entryClass.id)
        }
      }

      // 4. Promote Students (Batch update class_id)
      const activeStudents = students.filter(s => s.status === 'active' && s.class_id)
      for (const student of activeStudents) {
        const currentClassName = student.classes?.name || ''
        if (currentClassName.includes('P.7') || currentClassName.includes('S.6')) continue

        const nextClassName = getNextClassName(currentClassName)
        const nextClassId = newClassesMap.get(nextClassName)

        if (nextClassId) {
          await supabase.from('students').update({ class_id: nextClassId }).eq('id', student.id)
        }
      }

      // 5. Update global academic state
      if (wizardOptions.resetOpeningBalances) {
        await supabase
          .from('students')
          .update({ opening_balance: 0 })
          .eq('school_id', school.id)
          .in('status', ['active', 'completed'])
      }

      if (wizardOptions.archiveSummary) {
        await supabase.from('school_settings').upsert({
          school_id: school.id,
          key: 'last_rollover_summary',
          value: JSON.stringify({
            completed_at: new Date().toISOString(),
            from_year: academicYear,
            to_year: newAcademicYear,
            graduated_students: preview.graduatingStudentIds.length,
            promoted_students: preview.promotableStudentIds.length,
            carry_forward_balances: wizardOptions.carryForwardBalances,
            reset_opening_balances: wizardOptions.resetOpeningBalances,
            archive_grades: wizardOptions.archiveGrades,
          })
        }, { onConflict: 'school_id,key' })
      }

      await setAcademicYear(newAcademicYear)
      await setCurrentTerm(1)
      await logAuditEventWithOfflineSupport(
        true,
        school.id,
        'system',
        'Rollover Wizard',
        'update',
        'academic_rollover',
        `Executed year rollover ${academicYear} -> ${newAcademicYear}`,
        undefined,
        {
          currentTerm,
          academicYear,
        },
        {
          nextAcademicYear: newAcademicYear,
          options: wizardOptions,
          graduatingStudents: preview.graduatingStudentIds.length,
          promotedStudents: preview.promotableStudentIds.length,
        }
      )

      toast.success(`Academic year ${newAcademicYear} setup complete`)
      router.push('/dashboard')
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
            <div className="text-xl font-bold text-[#002045]">{allSchoolClasses.length}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 mb-6 max-w-2xl">
        <h2 className="font-semibold text-[#002045] mb-4">Rollover Preview</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-[#5c6670]">Promotions queued</div>
            <div className="text-xl font-bold text-[#002045]">{preview.promotableStudentIds.length}</div>
          </div>
          <div>
            <div className="text-[#5c6670]">Graduations queued</div>
            <div className="text-xl font-bold text-[#002045]">{preview.graduatingStudentIds.length}</div>
          </div>
          <div>
            <div className="text-[#5c6670]">Classes to clone</div>
            <div className="text-xl font-bold text-[#002045]">{preview.clonedClasses.length}</div>
          </div>
          <div>
            <div className="text-[#5c6670]">Entry classes to create</div>
            <div className="text-xl font-bold text-[#002045]">{preview.entryClassNames.length}</div>
          </div>
        </div>
        {preview.warnings.length > 0 && (
          <div className="mt-4 rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
            {preview.warnings.map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </div>
        )}
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
            <div className="mt-4 space-y-4">
              <div>
                <label className="label">New Academic Year</label>
                <input
                  type="text"
                  value={newAcademicYear}
                  onChange={(e) => setNewAcademicYear(e.target.value)}
                  className="input"
                  placeholder="2027"
                />
              </div>

              <div className="rounded-lg border border-[#e8eaed] p-4 space-y-3">
                <div className="font-medium text-[#002045]">Wizard Options</div>
                <label className="flex items-center gap-3 text-sm text-[#002045]">
                  <input
                    type="checkbox"
                    checked={wizardOptions.archiveGrades}
                    onChange={(e) => setWizardOptions(prev => ({ ...prev, archiveGrades: e.target.checked }))}
                  />
                  Archive current-year grading summary
                </label>
                <label className="flex items-center gap-3 text-sm text-[#002045]">
                  <input
                    type="checkbox"
                    checked={wizardOptions.carryForwardBalances}
                    onChange={(e) => setWizardOptions(prev => ({
                      ...prev,
                      carryForwardBalances: e.target.checked,
                      resetOpeningBalances: e.target.checked ? false : prev.resetOpeningBalances,
                    }))}
                  />
                  Carry forward fee balances into next year
                </label>
                <label className="flex items-center gap-3 text-sm text-[#002045]">
                  <input
                    type="checkbox"
                    checked={wizardOptions.resetOpeningBalances}
                    disabled={wizardOptions.carryForwardBalances}
                    onChange={(e) => setWizardOptions(prev => ({ ...prev, resetOpeningBalances: e.target.checked }))}
                  />
                  Reset student opening balances to zero
                </label>
                <label className="flex items-center gap-3 text-sm text-[#002045]">
                  <input
                    type="checkbox"
                    checked={wizardOptions.archiveSummary}
                    onChange={(e) => setWizardOptions(prev => ({ ...prev, archiveSummary: e.target.checked }))}
                  />
                  Save rollover summary to school settings
                </label>
              </div>
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

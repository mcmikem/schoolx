'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

const steps = [
  { id: 1, title: 'Academic Year' },
  { id: 2, title: 'Classes' },
  { id: 3, title: 'Subjects' },
  { id: 4, title: 'Finish' },
]

const defaultClasses = {
  primary: ['P.1', 'P.2', 'P.3', 'P.4', 'P.5', 'P.6', 'P.7'],
  secondary: ['S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6'],
}

const defaultSubjects = {
  primary: [
    'English Language', 'Mathematics', 'Integrated Science', 'Social Studies',
    'Religious Education', 'Local Language', 'Kiswahili', 'CAPE'
  ],
  secondary: [
    'English Language', 'Mathematics', 'Physics', 'Chemistry', 'Biology',
    'History', 'Geography', 'Economics', 'Literature'
  ],
}

export default function SetupWizardPage() {
  const router = useRouter()
  const { user, school } = useAuth()
  const toast = useToast()
  const [currentStep, setCurrentStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    academicYear: new Date().getFullYear().toString(),
    schoolType: 'primary' as 'primary' | 'secondary',
    classes: defaultClasses.primary,
    streams: {} as Record<string, string[]>,
    subjects: defaultSubjects.primary,
  })

  const updateForm = (field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSchoolTypeChange = (type: 'primary' | 'secondary') => {
    setForm((prev) => ({
      ...prev,
      schoolType: type,
      classes: defaultClasses[type],
      subjects: defaultSubjects[type],
    }))
  }

  const addClass = () => {
    const newClass = `P.${form.classes.length + 1}`
    updateForm('classes', [...form.classes, newClass])
  }

  const removeClass = (index: number) => {
    updateForm('classes', form.classes.filter((_, i) => i !== index))
  }

  const toggleSubject = (subject: string) => {
    if (form.subjects.includes(subject)) {
      updateForm('subjects', form.subjects.filter((s) => s !== subject))
    } else {
      updateForm('subjects', [...form.subjects, subject])
    }
  }

  const handleSave = async () => {
    if (!user?.school_id) {
      toast.error('No school associated with your account')
      return
    }

    setSaving(true)
    try {
      // Create classes
      for (const className of form.classes) {
        const { error } = await supabase.from('classes').insert({
          school_id: user.school_id,
          name: className,
          level: form.schoolType,
          academic_year: form.academicYear,
          max_students: 50,
        })
        if (error) throw error
      }

      // Create subjects
      for (const subject of form.subjects) {
        const { error } = await supabase.from('subjects').insert({
          school_id: user.school_id,
          name: subject,
          code: subject.substring(0, 3).toUpperCase(),
          level: form.schoolType,
          is_compulsory: true,
        })
        if (error) throw error
      }

      toast.success('Setup completed successfully!')
      router.push('/dashboard')
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save setup'
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">School Setup</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Configure your school's academic structure</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep >= step.id 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
            }`}>
              {currentStep > step.id ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : step.id}
            </div>
            {i < steps.length - 1 && (
              <div className={`w-12 h-1 ${currentStep > step.id ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="card max-w-2xl">
        {currentStep === 1 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Academic Year</h2>
            <div>
              <label className="label">Academic Year</label>
              <input
                type="text"
                value={form.academicYear}
                onChange={(e) => updateForm('academicYear', e.target.value)}
                className="input"
                placeholder="e.g. 2026"
              />
            </div>
            <div>
              <label className="label">School Type</label>
              <div className="flex gap-4">
                <button
                  onClick={() => handleSchoolTypeChange('primary')}
                  className={`flex-1 p-4 rounded-lg border-2 text-left ${
                    form.schoolType === 'primary' 
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30' 
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="font-medium text-gray-900 dark:text-white">Primary School</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">P.1 to P.7</div>
                </button>
                <button
                  onClick={() => handleSchoolTypeChange('secondary')}
                  className={`flex-1 p-4 rounded-lg border-2 text-left ${
                    form.schoolType === 'secondary' 
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30' 
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="font-medium text-gray-900 dark:text-white">Secondary School</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">S.1 to S.6</div>
                </button>
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Classes</h2>
              <button onClick={addClass} className="btn btn-secondary btn-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Class
              </button>
            </div>
            <div className="space-y-2">
              {form.classes.map((cls, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="font-medium text-gray-900 dark:text-white">{cls}</span>
                  <button onClick={() => removeClass(i)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Subjects</h2>
            <div className="grid grid-cols-2 gap-2">
              {form.subjects.map((subject, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{subject}</span>
                  <button onClick={() => toggleSubject(subject)} className="text-red-500 hover:text-red-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <div>
              <label className="label">Add Subject</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Subject name"
                  className="input flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const input = e.target as HTMLInputElement
                      if (input.value.trim()) {
                        toggleSubject(input.value.trim())
                        input.value = ''
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Setup Complete</h2>
            <p className="text-gray-500 dark:text-gray-400">
              Your school is configured with {form.classes.length} classes and {form.subjects.length} subjects for {form.academicYear}.
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
          {currentStep > 1 && (
            <button onClick={() => setCurrentStep(currentStep - 1)} className="btn btn-secondary">
              Back
            </button>
          )}
          {currentStep < 4 ? (
            <button onClick={() => setCurrentStep(currentStep + 1)} className="btn btn-primary flex-1">
              Next
            </button>
          ) : (
            <button onClick={handleSave} disabled={saving} className="btn btn-primary flex-1">
              {saving ? 'Saving...' : 'Complete Setup'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

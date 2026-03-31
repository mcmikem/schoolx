'use client'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

interface Step {
  id: string
  title: string
  description: string
  icon: string
}

const steps: Step[] = [
  {
    id: 'welcome',
    title: 'Welcome to SchoolX',
    description: 'Let\'s set up your school in 3 easy steps',
    icon: 'waving_hand',
  },
  {
    id: 'classes',
    title: 'Create Your Classes',
    description: 'Add the classes you teach at your school',
    icon: 'school',
  },
  {
    id: 'students',
    title: 'Add Your First Students',
    description: 'You can import from CSV or add them one by one',
    icon: 'group',
  },
]

const defaultClasses = [
  { name: 'P.1', level: 'primary' },
  { name: 'P.2', level: 'primary' },
  { name: 'P.3', level: 'primary' },
  { name: 'P.4', level: 'primary' },
  { name: 'P.5', level: 'primary' },
  { name: 'P.6', level: 'primary' },
  { name: 'P.7', level: 'primary' },
]

export default function SetupWizard({ onComplete }: { onComplete: () => void }) {
  const { school, user } = useAuth()
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedClasses, setSelectedClasses] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleClassToggle = (className: string) => {
    setSelectedClasses(prev => 
      prev.includes(className) 
        ? prev.filter(c => c !== className)
        : [...prev, className]
    )
  }

  const handleSelectAll = () => {
    setSelectedClasses(defaultClasses.map(c => c.name))
  }

  const handleCreateClasses = async () => {
    if (!school?.id || !supabase) {
      setError('Cannot create classes - no school or database connection')
      return
    }

    if (selectedClasses.length === 0) {
      setError('Please select at least one class')
      return
    }

    setLoading(true)
    setError('')

    try {
      const classesToCreate = defaultClasses
        .filter(c => selectedClasses.includes(c.name))
        .map(c => ({
          school_id: school.id,
          name: c.name,
          level: c.level,
          academic_year: new Date().getFullYear().toString(),
          max_students: 50,
        }))

      const { error: insertError } = await supabase
        .from('classes')
        .insert(classesToCreate)

      if (insertError) throw insertError

      // Move to next step
      setCurrentStep(2)
    } catch (err: any) {
      setError(err.message || 'Failed to create classes')
    } finally {
      setLoading(false)
    }
  }

  const handleFinish = () => {
    // Mark setup as complete in localStorage
    localStorage.setItem('schoolx_setup_complete', 'true')
    onComplete()
  }

  return (
    <div style={{ 
      position: 'fixed', 
      inset: 0, 
      background: 'rgba(0,0,0,0.7)', 
      zIndex: 200, 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: 16
    }}>
      <div style={{ 
        background: 'var(--surface)', 
        borderRadius: 20, 
        padding: 32, 
        maxWidth: 500, 
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        {/* Progress */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {steps.map((step, i) => (
            <div 
              key={step.id}
              style={{ 
                flex: 1, 
                height: 4, 
                borderRadius: 2,
                background: i <= currentStep ? 'var(--navy)' : 'var(--border)',
                transition: 'background 0.3s'
              }}
            />
          ))}
        </div>

        {error && (
          <div style={{ 
            padding: 12, 
            background: 'var(--red-soft)', 
            color: 'var(--red)', 
            borderRadius: 8, 
            marginBottom: 16,
            fontSize: 14 
          }}>
            {error}
          </div>
        )}

        {/* Step 1: Welcome */}
        {currentStep === 0 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              width: 80, 
              height: 80, 
              borderRadius: '50%', 
              background: 'var(--navy-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--navy)' }}>
                {steps[0].icon}
              </span>
            </div>
            
            <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--t1)', marginBottom: 8 }}>
              {steps[0].title}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--t3)', marginBottom: 8 }}>
              {school?.name || 'Your School'}
            </p>
            <p style={{ fontSize: 14, color: 'var(--t2)', marginBottom: 32 }}>
              {steps[0].description}
            </p>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <div style={{ 
                background: 'var(--bg)', 
                padding: 16, 
                borderRadius: 12,
                flex: '1 1 120px',
                textAlign: 'center'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--navy)', display: 'block', marginBottom: 8 }}>
                  group
                </span>
                <p style={{ fontSize: 12, color: 'var(--t2)' }}>Manage Students</p>
              </div>
              <div style={{ 
                background: 'var(--bg)', 
                padding: 16, 
                borderRadius: 12,
                flex: '1 1 120px',
                textAlign: 'center'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--navy)', display: 'block', marginBottom: 8 }}>
                  payments
                </span>
                <p style={{ fontSize: 12, color: 'var(--t2)' }}>Track Fees</p>
              </div>
              <div style={{ 
                background: 'var(--bg)', 
                padding: 16, 
                borderRadius: 12,
                flex: '1 1 120px',
                textAlign: 'center'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--navy)', display: 'block', marginBottom: 8 }}>
                  menu_book
                </span>
                <p style={{ fontSize: 12, color: 'var(--t2)' }}>Record Grades</p>
              </div>
            </div>

            <button 
              onClick={() => setCurrentStep(1)}
              style={{
                marginTop: 32,
                width: '100%',
                padding: '14px 20px',
                background: 'var(--navy)',
                color: 'white',
                border: 'none',
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                minHeight: 48,
              }}
            >
              Get Started
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
            </button>
          </div>
        )}

        {/* Step 2: Create Classes */}
        {currentStep === 1 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--navy)', marginBottom: 12, display: 'block' }}>
                {steps[1].icon}
              </span>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 8 }}>
                {steps[1].title}
              </h2>
              <p style={{ fontSize: 14, color: 'var(--t2)' }}>
                {steps[1].description}
              </p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <button
                onClick={handleSelectAll}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--navy)',
                  cursor: 'pointer',
                  fontSize: 13,
                  textDecoration: 'underline',
                }}
              >
                Select All Primary Classes
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8, marginBottom: 24 }}>
              {defaultClasses.map(cls => (
                <button
                  key={cls.name}
                  onClick={() => handleClassToggle(cls.name)}
                  style={{
                    padding: '12px 8px',
                    background: selectedClasses.includes(cls.name) ? 'var(--navy)' : 'var(--bg)',
                    color: selectedClasses.includes(cls.name) ? 'white' : 'var(--t1)',
                    border: `1px solid ${selectedClasses.includes(cls.name) ? 'var(--navy)' : 'var(--border)'}`,
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    minHeight: 48,
                    transition: 'all 0.15s',
                  }}
                >
                  {cls.name}
                </button>
              ))}
            </div>

            <p style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 24 }}>
              Selected: {selectedClasses.length} classes
            </p>

            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                onClick={() => setCurrentStep(0)}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  fontSize: 14,
                  cursor: 'pointer',
                  minHeight: 48,
                }}
              >
                Back
              </button>
              <button 
                onClick={handleCreateClasses}
                disabled={loading || selectedClasses.length === 0}
                style={{
                  flex: 2,
                  padding: '12px 16px',
                  background: 'var(--navy)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading || selectedClasses.length === 0 ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  minHeight: 48,
                }}
              >
                {loading ? 'Creating...' : `Create ${selectedClasses.length} Classes`}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Students */}
        {currentStep === 2 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              width: 80, 
              height: 80, 
              borderRadius: '50%', 
              background: 'var(--green-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--green)' }}>
                check_circle
              </span>
            </div>
            
            <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--t1)', marginBottom: 8 }}>
              Great Start!
            </h2>
            <p style={{ fontSize: 14, color: 'var(--t2)', marginBottom: 24 }}>
              Your classes have been created. You're ready to start managing your school.
            </p>

            <div style={{ 
              background: 'var(--bg)', 
              padding: 16, 
              borderRadius: 12,
              marginBottom: 24
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)', marginBottom: 8 }}>
                What's next?
              </h3>
              <ul style={{ fontSize: 13, color: 'var(--t2)', textAlign: 'left', paddingLeft: 20, margin: 0, lineHeight: 1.8 }}>
                <li>Add students to your classes</li>
                <li>Take daily attendance</li>
                <li>Record fee payments</li>
                <li>Enter student grades</li>
              </ul>
            </div>

            <button 
              onClick={handleFinish}
              style={{
                width: '100%',
                padding: '14px 20px',
                background: 'var(--navy)',
                color: 'white',
                border: 'none',
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                minHeight: 48,
              }}
            >
              Go to Dashboard
            </button>
            
            <button 
              onClick={handleFinish}
              style={{
                marginTop: 12,
                background: 'none',
                border: 'none',
                color: 'var(--t3)',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              I'll add students later
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

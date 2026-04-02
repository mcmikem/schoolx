'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import OmutoLogo from '@/components/OmutoLogo'

function MaterialIcon({ icon, className, children }: { icon: string; className?: string; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`}>{icon || children}</span>
}

const DISTRICTS = [
  'Kampala', 'Wakiso', 'Mukono', 'Jinja', 'Mbale', 'Gulu', 'Lira',
  'Masaka', 'Mbarara', 'Fort Portal', 'Kabale', 'Soroti', 'Arua',
  'Hoima', 'Masindi', 'Tororo', 'Busia', 'Iganga', 'Kamuli', 'Apac',
  'Entebbe', 'Kasese', 'Kitgum', 'Moroto',
]

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Clear any demo data on register page load
  useEffect(() => {
    localStorage.removeItem('demo_user')
    localStorage.removeItem('demo_school')
  }, [])

  const [form, setForm] = useState({
    schoolName: '',
    district: '',
    subcounty: '',
    schoolType: 'primary' as 'primary' | 'secondary' | 'combined',
    ownership: 'private' as 'private' | 'government' | 'government_aided',
    phone: '',
    email: '',
    adminName: '',
    adminPhone: '',
    password: '',
    confirmPassword: '',
  })

  const updateForm = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)
      
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName: form.schoolName,
          district: form.district,
          subcounty: form.subcounty,
          schoolType: form.schoolType,
          ownership: form.ownership,
          phone: form.phone || null,
          email: form.email || null,
          adminName: form.adminName,
          adminPhone: form.adminPhone,
          password: form.password,
        }),
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)

      const data = await response.json()
      console.log('Registration response:', response.status, data)

      if (!response.ok) {
        setError(data.error || `Registration failed (${response.status})`)
        return
      }

      await new Promise(resolve => setTimeout(resolve, 1000))

      const normalizedPhone = form.adminPhone.replace(/[^0-9]/g, '')
      const email = `${normalizedPhone}@omuto.sms`
      
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: form.password,
      })

      if (signInError) {
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        const { error: retryError } = await supabase.auth.signInWithPassword({
          email,
          password: form.password,
        })
        
        if (retryError) {
          setError('Account created! Please go to login page and sign in.')
          setLoading(false)
          return
        }
      }

      // Set loading to false BEFORE navigation to avoid hanging spinner on redirect
      setLoading(false)
      
      // Navigate to dashboard
      router.push('/dashboard')
    } catch (err: unknown) {
      setLoading(false) // Ensure loading is cleared on error
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Registration timed out. Profile creation may still be in progress. Try logging in shortly.')
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Registration failed. Please try again.'
        setError(errorMessage)
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafb] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="flex justify-center">
          <OmutoLogo size="lg" />
        </div>
        
        <h2 className="mt-6 text-center text-2xl font-bold text-[#002045]">
          Register your school
        </h2>
        <p className="mt-2 text-center text-sm text-[#5c6670]">
          Step {step} of 3 - 30 days free trial
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg px-4">
        <div className="flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-[#002045]' : 'bg-[#e8eaed]'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white rounded-2xl border border-[#e8eaed] py-8 px-6 sm:px-10 shadow-sm">
          {error && (
            <div className="mb-4 p-3 bg-[#fef2f2] border border-[#ba1a1a]/20 rounded-xl text-sm text-[#ba1a1a]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">School Name</label>
                  <input
                    type="text"
                    placeholder="e.g. St. Mary Primary School"
                    value={form.schoolName}
                    onChange={(e) => updateForm('schoolName', e.target.value)}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">School Type</label>
                  <select
                    value={form.schoolType}
                    onChange={(e) => updateForm('schoolType', e.target.value)}
                    className="input"
                  >
                    <option value="primary">Primary School</option>
                    <option value="secondary">Secondary School</option>
                    <option value="combined">Combined (Primary and Secondary)</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Ownership</label>
                  <select
                    value={form.ownership}
                    onChange={(e) => updateForm('ownership', e.target.value)}
                    className="input"
                  >
                    <option value="private">Private</option>
                    <option value="government">Government</option>
                    <option value="government_aided">Government Aided</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn btn-primary w-full"
                >
                  <MaterialIcon icon="arrow_forward" className="text-lg" />
                  Next: Location
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">District</label>
                  <select
                    value={form.district}
                    onChange={(e) => updateForm('district', e.target.value)}
                    className="input"
                    required
                  >
                    <option value="">Select district</option>
                    {DISTRICTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Sub-county</label>
                  <input
                    type="text"
                    placeholder="e.g. Central Division"
                    value={form.subcounty}
                    onChange={(e) => updateForm('subcounty', e.target.value)}
                    className="input"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[#191c1d] mb-2 block">School Phone (Optional)</label>
                    <input
                      type="tel"
                      placeholder="0700000000"
                      value={form.phone}
                      onChange={(e) => updateForm('phone', e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#191c1d] mb-2 block">School Email (Optional)</label>
                    <input
                      type="email"
                      placeholder="school@email.com"
                      value={form.email}
                      onChange={(e) => updateForm('email', e.target.value)}
                      className="input"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="btn btn-secondary flex-1"
                  >
                    <MaterialIcon icon="arrow_back" className="text-lg" />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="btn btn-primary flex-1"
                  >
                    <MaterialIcon icon="arrow_forward" className="text-lg" />
                    Next: Account
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Your Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. John Mukasa"
                    value={form.adminName}
                    onChange={(e) => updateForm('adminName', e.target.value)}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Your Phone Number (Login ID)</label>
                  <input
                    type="tel"
                    placeholder="e.g. 0700000000"
                    value={form.adminPhone}
                    onChange={(e) => updateForm('adminPhone', e.target.value)}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Password</label>
                  <input
                    type="password"
                    placeholder="Min 6 characters"
                    value={form.password}
                    onChange={(e) => updateForm('password', e.target.value)}
                    className="input"
                    required
                    minLength={6}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Confirm Password</label>
                  <input
                    type="password"
                    placeholder="Enter password again"
                    value={form.confirmPassword}
                    onChange={(e) => updateForm('confirmPassword', e.target.value)}
                    className="input"
                    required
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="btn btn-secondary flex-1"
                  >
                    <MaterialIcon icon="arrow_back" className="text-lg" />
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary flex-1"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <MaterialIcon icon="progress_activity" className="animate-spin" />
                        Creating...
                      </span>
                    ) : (
                      <>
                        <MaterialIcon icon="check" className="text-lg" />
                        Create Account
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-[#5c6670]">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-[#002045] hover:text-[#006e1c]">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
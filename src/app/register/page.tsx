'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

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
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName: form.schoolName,
          district: form.district,
          subcounty: form.subcounty,
          schoolType: form.schoolType,
          ownership: form.ownership,
          phone: form.phone || undefined,
          email: form.email || undefined,
          adminName: form.adminName,
          adminPhone: form.adminPhone,
          password: form.password,
        }),
      })

      const result = await response.json()

      if (!result.success) {
        setError(result.error || 'Registration failed')
        setLoading(false)
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

      router.push('/dashboard')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Registration failed. Please try again.'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-lg">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">O</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">OmutoSMS</span>
          </div>
        </div>
        
        <h2 className="mt-6 text-center text-2xl font-bold text-gray-900">
          Register your school
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Step {step} of 3 - 30 days free trial
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg px-4">
        <div className="flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="card py-8 px-6 sm:px-10">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Step 1: School Information */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <label className="label">School Name</label>
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
                  <label className="label">School Type</label>
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
                  <label className="label">Ownership</label>
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
                  Next: Location
                </button>
              </div>
            )}

            {/* Step 2: Location */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <label className="label">District</label>
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
                  <label className="label">Sub-county</label>
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
                    <label className="label">School Phone (Optional)</label>
                    <input
                      type="tel"
                      placeholder="0700000000"
                      value={form.phone}
                      onChange={(e) => updateForm('phone', e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">School Email (Optional)</label>
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
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="btn btn-primary flex-1"
                  >
                    Next: Account
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Admin Account */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <label className="label">Your Full Name</label>
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
                  <label className="label">Your Phone Number (Login ID)</label>
                  <input
                    type="tel"
                    placeholder="e.g. 0700000000"
                    value={form.adminPhone}
                    onChange={(e) => updateForm('adminPhone', e.target.value)}
                    className="input"
                    required
                  />
                  <p className="helper-text">You will use this phone number to log in</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Password</label>
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
                    <label className="label">Confirm Password</label>
                    <input
                      type="password"
                      placeholder="Confirm password"
                      value={form.confirmPassword}
                      onChange={(e) => updateForm('confirmPassword', e.target.value)}
                      className="input"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="btn btn-secondary flex-1"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary flex-1"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Creating...
                      </span>
                    ) : (
                      'Create Account'
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-700">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

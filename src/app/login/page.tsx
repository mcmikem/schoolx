'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import Link from 'next/link'
import OmutoLogo from '@/components/OmutoLogo'

const DEMO_KEY = 'omuto_demo_v1'

function encryptDemoData(data: object): string {
  try {
    return btoa(JSON.stringify(data))
  } catch {
    return ''
  }
}

function MaterialIcon({ icon, className, children }: { icon: string; className?: string; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`}>{icon || children}</span>
}

export default function LoginPage() {
  const router = useRouter()
  const toast = useToast()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const demoAccounts = [
    { role: 'Headmaster', phone: '0700000001', password: 'demo1234', label: 'Headmaster (Full Access)' },
    { role: 'Teacher', phone: '0700000002', password: 'demo1234', label: 'Teacher' },
    { role: 'Bursar', phone: '0700000003', password: 'demo1234', label: 'Bursar (Fees Only)' },
    { role: 'Dean', phone: '0700000004', password: 'demo1234', label: 'Dean of Studies' },
  ]

  const handleDemoLogin = (demo: typeof demoAccounts[0]) => {
    setPhone(demo.phone)
    setPassword(demo.password)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!phone.trim() || !password.trim()) {
      toast.error('Please enter your phone number and password')
      return
    }

    setLoading(true)

    const demoUsers: Record<string, { role: string; name: string; school_id: string }> = {
      '0700000001': { role: 'headmaster', name: 'John Headmaster', school_id: 'demo-school' },
      '0700000002': { role: 'teacher', name: 'Mary Teacher', school_id: 'demo-school' },
      '0700000003': { role: 'bursar', name: 'James Bursar', school_id: 'demo-school' },
      '0700000004': { role: 'dean_of_studies', name: 'Sarah Dean', school_id: 'demo-school' },
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '')
    
    // Clear any previous demo data before login
    localStorage.removeItem(DEMO_KEY)
    
    // DEMO LOGIN - always use local demo mode
    if (password === 'demo1234' && demoUsers[cleanPhone]) {
      const demoUser = demoUsers[cleanPhone]
      const demoSchoolData = {
        id: '00000000-0000-0000-0000-000000000001',
        name: "St. Mary's Primary School (Demo)",
        school_code: 'DEMO001',
        district: 'Kampala',
        school_type: 'primary',
        ownership: 'private',
        primary_color: '#17325F',
        subscription_plan: 'premium',
        subscription_status: 'active',
      }
      const demoData = encryptDemoData({ demoUser, demoSchool: demoSchoolData })
      localStorage.setItem(DEMO_KEY, demoData)
      toast.success(`Welcome, ${demoUser.name} (Demo Mode)`)
      router.push('/dashboard')
      router.refresh()
      setLoading(false)
      return
    }

    // Normal login - Supabase auth (not available in demo)
    try {
      toast.error('Supabase not configured. Please use demo account.')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong'
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafb] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <OmutoLogo size="lg" />
        </div>
        
        <h2 className="mt-6 text-center text-2xl font-bold text-[#002045]">
          Sign in to your account
        </h2>
        <p className="mt-2 text-center text-sm text-[#5c6670]">
          Enter your phone number and password
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white rounded-2xl border border-[#e8eaed] py-8 px-6 sm:px-10 shadow-sm">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="phone" className="text-sm font-medium text-[#191c1d] mb-2 block">
                Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                placeholder="e.g. 0700000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="text-sm font-medium text-[#191c1d] mb-2 block">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5c6670] hover:text-[#002045]"
                >
                  <MaterialIcon icon={showPassword ? 'visibility_off' : 'visibility'} className="text-xl" />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <MaterialIcon icon="progress_activity" className="animate-spin" />
                  Signing in...
                </span>
              ) : (
                <>
                  <MaterialIcon icon="login" className="text-lg" />
                  Sign In
                </>
              )}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#e8eaed]" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white text-[#5c6670]">Demo Accounts</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((demo) => (
                <button
                  key={demo.phone}
                  type="button"
                  onClick={() => handleDemoLogin(demo)}
                  className="btn btn-secondary text-xs py-2"
                >
                  {demo.role}
                </button>
              ))}
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-[#5c6670]">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="font-semibold text-[#002045] hover:text-[#006e1c]">
                Register your school
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
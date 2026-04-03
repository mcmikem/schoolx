'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import Link from 'next/link'
import AuthShell from '@/components/layout/AuthShell'
import MaterialIcon from '@/components/MaterialIcon'

const DEMO_KEY = 'omuto_demo_v1'

function encryptDemoData(data: object): string {
  try {
    return btoa(JSON.stringify(data))
  } catch {
    return ''
  }
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
    
    localStorage.removeItem(DEMO_KEY)
    
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

    try {
      if (!supabase) {
        toast.error('Supabase not configured. Please use demo account.')
        setLoading(false)
        return
      }

      const email = `${cleanPhone}@omuto.sms`

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        if (authError.message.includes('Invalid login credentials')) {
          toast.error('Wrong phone number or password. Please try again.')
        } else {
          toast.error(authError.message)
        }
        return
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role, school_id, full_name')
        .eq('auth_id', data.user.id)
        .single()

      if (userError) {
        toast.error('Account exists but profile not found. Contact support.')
        return
      }

      toast.success(`Welcome back, ${userData.full_name?.split(' ')[0] || 'User'}`)

      if (userData.role === 'super_admin') {
        router.push('/dashboard/schools')
      } else if (userData.role === 'parent') {
        router.push('/dashboard/parent')
      } else {
        router.push('/dashboard')
      }

      router.refresh()
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Sign in" subtitle="Enter your phone number and password">
      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <label className="text-sm font-medium text-[var(--t1)] mb-2 block">
            Phone Number
          </label>
          <input
            type="tel"
            placeholder="e.g. 0700000000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input w-full"
            required
          />
        </div>

        <div>
          <label className="text-sm font-medium text-[var(--t1)] mb-2 block">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input w-full pr-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--t3)] hover:text-[var(--t1)]"
            >
              <MaterialIcon icon={showPassword ? 'visibility_off' : 'visibility'} className="text-lg" />
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[var(--border)]" /></div>
          <div className="relative flex justify-center text-xs"><span className="px-2 bg-[var(--surface)] text-[var(--t4)] uppercase tracking-wider font-semibold">Demo Accounts</span></div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {demoAccounts.map((demo) => (
            <button key={demo.phone} type="button" onClick={() => handleDemoLogin(demo)} className="btn btn-ghost text-xs py-2">
              {demo.role}
            </button>
          ))}
        </div>

        <p className="text-center text-sm text-[var(--t3)] mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-bold text-[var(--navy)] hover:text-[var(--green)]">
            Register your school
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}

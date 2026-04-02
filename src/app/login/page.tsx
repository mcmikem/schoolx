'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import Link from 'next/link'
import OmutoLogo from '@/components/OmutoLogo'

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
    localStorage.removeItem('demo_user')
    localStorage.removeItem('demo_school')
    
    if (password === 'demo1234' && demoUsers[cleanPhone]) {
      // Check if demo school exists, if not create it
      if (!supabase) {
        // No supabase - use local demo mode
        const demoUser = demoUsers[cleanPhone]
        localStorage.setItem('demo_user', JSON.stringify(demoUser))
        localStorage.setItem('demo_school', JSON.stringify({ id: 'demo-school', name: "St. Mary's Primary School" }))
        toast.success(`Welcome, ${demoUser.name} (Demo Mode - Offline)`)
        router.push('/dashboard')
        router.refresh()
        setLoading(false)
        return
      }
      
      // Try to get or create demo school in Supabase
      const DEMO_SCHOOL_ID = '00000000-0000-0000-0000-000000000001'
      
      try {
        const { data: existingDemoSchool } = await supabase
          .from('schools')
          .select('id, name')
          .eq('id', DEMO_SCHOOL_ID)
          .single()
        
        let demoSchool = existingDemoSchool
        
        if (!demoSchool) {
          console.log('Creating demo school...')
          // Create demo school with all required fields
          const { data: newSchool, error: schoolError } = await supabase
            .from('schools')
            .insert({
              id: DEMO_SCHOOL_ID,
              name: "St. Mary's Primary School (Demo)",
              school_code: 'DEMO001',
              district: 'Kampala',
              subcounty: 'Kampala Central',
              parish: 'Kampala',
              village: 'Kampala',
              school_type: 'primary',
              ownership: 'private',
              phone: '+256700000000',
              email: 'demo@stmartin.edu.ug',
              primary_color: '#17325F',
              subscription_plan: 'premium',
              subscription_status: 'active',
            })
            .select('id, name')
            .single()
          
          if (schoolError) {
            console.error('School creation error:', schoolError)
          }
          
          if (newSchool) {
            demoSchool = newSchool
            console.log('Demo school created:', demoSchool)
          }
          
          // Seed demo classes (upsert to handle re-login)
          const demoClasses = [
            { school_id: DEMO_SCHOOL_ID, name: 'P.1', level: 'primary', academic_year: '2026', max_students: 40 },
            { school_id: DEMO_SCHOOL_ID, name: 'P.2', level: 'primary', academic_year: '2026', max_students: 40 },
            { school_id: DEMO_SCHOOL_ID, name: 'P.3', level: 'primary', academic_year: '2026', max_students: 40 },
            { school_id: DEMO_SCHOOL_ID, name: 'P.4', level: 'primary', academic_year: '2026', max_students: 40 },
            { school_id: DEMO_SCHOOL_ID, name: 'P.5', level: 'primary', academic_year: '2026', max_students: 40 },
            { school_id: DEMO_SCHOOL_ID, name: 'P.6', level: 'primary', academic_year: '2026', max_students: 40 },
            { school_id: DEMO_SCHOOL_ID, name: 'P.7', level: 'primary', academic_year: '2026', max_students: 40 },
          ]
          await supabase.from('classes').upsert(demoClasses, { onConflict: 'school_id,name,academic_year' })
          
          // Seed demo subjects (upsert to handle re-login)
          const demoSubjects = [
            { school_id: DEMO_SCHOOL_ID, name: 'English Language', code: 'ENG', level: 'primary', is_compulsory: true },
            { school_id: DEMO_SCHOOL_ID, name: 'Mathematics', code: 'MATH', level: 'primary', is_compulsory: true },
            { school_id: DEMO_SCHOOL_ID, name: 'Integrated Science', code: 'SCI', level: 'primary', is_compulsory: true },
            { school_id: DEMO_SCHOOL_ID, name: 'Social Studies', code: 'SST', level: 'primary', is_compulsory: true },
            { school_id: DEMO_SCHOOL_ID, name: 'Religious Education', code: 'RE', level: 'primary', is_compulsory: false },
          ]
          await supabase.from('subjects').upsert(demoSubjects, { onConflict: 'school_id,code,academic_year' })
          
          // Get class IDs for seeding
          const { data: classIds } = await supabase.from('classes').select('id').eq('school_id', DEMO_SCHOOL_ID)
          console.log('Classes found:', classIds?.length || 0)
          
          if (classIds && classIds.length > 0) {
            // Seed 200 students across classes
            const firstNames = ['Sarah', 'Grace', 'Betty', 'Esther', 'Florence', 'Mary', 'Agnes', 'Jane', 'Ruth', 'Mercy', 'John', 'Joseph', 'David', 'Francis', 'Patrick', 'Paul', 'Samuel', 'Daniel', 'Robert', 'Charles']
            const lastNames = ['Nakato', 'Namugala', 'Auma', 'Nalwoga', 'Akello', 'Nakamya', 'Nabirye', 'Nansubuga', 'Nalwadda', 'Nabukeera', 'Kato', 'Wasswa', 'Okelo', 'Mukasa', 'Ssenyonjo', 'Lule', 'Kaggwa', 'Semanda', 'Lumu', 'Mugisha']
            const students = []
            for (let i = 0; i < 200; i++) {
              students.push({
                school_id: DEMO_SCHOOL_ID,
                student_number: `DEMO${String(i+1).padStart(4,'0')}`,
                first_name: firstNames[i % firstNames.length],
                last_name: lastNames[Math.floor(Math.random() * lastNames.length)],
                gender: i % 2 === 0 ? 'M' : 'F',
                class_id: classIds[i % classIds.length].id,
                status: 'active',
                date_of_birth: `201${Math.floor(Math.random() * 6)}-0${Math.floor(Math.random() * 9)+1}-15`,
                parent_name: `Parent of ${lastNames[i % lastNames.length]}`,
                parent_phone: `07${Math.floor(Math.random() * 90000000 + 10000000)}`
              })
            }
            const { error: studentError } = await supabase.from('students').upsert(students, { onConflict: 'school_id,student_number' })
            console.log('Students seeded, error:', studentError)
            
            // Seed fee structure
            const feeStructures = [
              { school_id: DEMO_SCHOOL_ID, name: 'Tuition Fee', amount: 350000, term: 1, academic_year: '2026' },
              { school_id: DEMO_SCHOOL_ID, name: 'Development Fee', amount: 50000, term: 1, academic_year: '2026' },
              { school_id: DEMO_SCHOOL_ID, name: 'Lunch Program', amount: 120000, term: 1, academic_year: '2026' },
              { school_id: DEMO_SCHOOL_ID, name: 'Transport', amount: 80000, term: 1, academic_year: '2026' },
            ]
            const { error: feeError } = await supabase.from('fee_structure').upsert(feeStructures, { onConflict: 'school_id,name,term,academic_year' })
            console.log('Fee structure seeded, error:', feeError)
            
            // Get fee ID and student IDs for payments
            const { data: feeData } = await supabase.from('fee_structure').select('id').eq('school_id', DEMO_SCHOOL_ID).limit(1).single()
            const { data: studentData } = await supabase.from('students').select('id, class_id').eq('school_id', DEMO_SCHOOL_ID)
            console.log('Students in DB:', studentData?.length || 0, 'Fee:', feeData?.id)
            
            if (feeData && studentData && studentData.length > 0) {
              // Seed some payments (50% full, 20% partial)
              const payments = []
              for (let i = 0; i < studentData.length; i++) {
                const rand = Math.random()
                if (rand < 0.5) {
                  payments.push({ student_id: studentData[i].id, fee_id: feeData.id, amount_paid: 500000, payment_method: 'mobile_money', payment_date: '2026-02-15', payment_reference: `PAY${i+1}` })
                } else if (rand < 0.7) {
                  payments.push({ student_id: studentData[i].id, fee_id: feeData.id, amount_paid: 200000, payment_method: 'cash', payment_date: '2026-02-20', payment_reference: `PAY${i+1}` })
                }
              }
              if (payments.length > 0) {
                const { error: paymentError } = await supabase.from('fee_payments').upsert(payments, { onConflict: 'student_id,fee_id,payment_reference' })
                console.log('Payments seeded:', payments.length, 'error:', paymentError)
              }
            
              // Seed attendance for last 7 days
              const today = new Date()
              const attendance = []
              for (let day = 0; day < 7; day++) {
                const date = new Date(today)
                date.setDate(today.getDate() - day)
                if (date.getDay() === 0) continue
                for (const student of studentData) {
                  const status = Math.random() < 0.1 ? 'absent' : (Math.random() < 0.05 ? 'late' : 'present')
                  attendance.push({ student_id: student.id, class_id: student.class_id, date: date.toISOString().split('T')[0], status })
                }
              }
              const { error: attendError } = await supabase.from('attendance').upsert(attendance, { onConflict: 'student_id,date' })
              console.log('Attendance records:', attendance.length, 'error:', attendError)
            }
            
            // Seed staff
            const staff = [
              { school_id: DEMO_SCHOOL_ID, full_name: 'Mr. Kato James', role: 'headmaster', phone: '0772000001', email: 'jkato@demo.school', status: 'active' },
              { school_id: DEMO_SCHOOL_ID, full_name: 'Mrs. Nakato Sarah', role: 'teacher', phone: '0772000002', email: 'snakato@demo.school', status: 'active' },
              { school_id: DEMO_SCHOOL_ID, full_name: 'Mr. Mugisha John', role: 'teacher', phone: '0772000003', email: 'jmugisha@demo.school', status: 'active' },
              { school_id: DEMO_SCHOOL_ID, full_name: 'Mrs. Auma Grace', role: 'bursar', phone: '0772000004', email: 'gauma@demo.school', status: 'active' },
              { school_id: DEMO_SCHOOL_ID, full_name: 'Mr. Wasswa David', role: 'dean_of_studies', phone: '0772000005', email: 'dwasswa@demo.school', status: 'active' },
              { school_id: DEMO_SCHOOL_ID, full_name: 'Mrs. Nalwoga Ruth', role: 'teacher', phone: '0772000006', email: 'rnalwoga@demo.school', status: 'active' },
            ]
            const { error: staffError } = await supabase.from('staff').upsert(staff, { onConflict: 'school_id,phone' })
            console.log('Staff seeded, error:', staffError)
            
            console.log('=== DEMO DATA SEEDING COMPLETE ===')
          }
        }
        
        const demoUser = demoUsers[cleanPhone]
        localStorage.setItem('demo_user', JSON.stringify(demoUser))
        localStorage.setItem('demo_school', JSON.stringify({ id: DEMO_SCHOOL_ID, name: demoSchool?.name || "St. Mary's Primary School (Demo)" }))
        toast.success(`Welcome, ${demoUser.name} (Demo Mode)`)
        router.push('/dashboard')
        router.refresh()
      } catch (err) {
        console.error('Demo login error:', err)
        // Still allow login even if seeding fails
        const demoUser = demoUsers[cleanPhone]
        localStorage.setItem('demo_user', JSON.stringify(demoUser))
        localStorage.setItem('demo_school', JSON.stringify({ id: DEMO_SCHOOL_ID, name: "St. Mary's Primary School (Demo)" }))
        toast.success(`Welcome, ${demoUser.name} (Demo Mode)`)
        router.push('/dashboard')
        router.refresh()
      }
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
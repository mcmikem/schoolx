'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from './supabase'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  auth_id: string
  school_id: string | null
  full_name: string
  phone: string
  role: 'super_admin' | 'school_admin' | 'headmaster' | 'dean_of_studies' | 'bursar' | 'teacher' | 'student' | 'parent' | 'secretary' | 'dorm_master'
  avatar_url: string | null
  is_active: boolean
}

interface School {
  id: string
  name: string
  school_code: string
  district: string
  logo_url: string | null
  primary_color: string
  subscription_plan: string
  subscription_status: string
  phone?: string
  email?: string
}

interface AuthContextType {
  user: User | null
  school: School | null
  loading: boolean
  isDemo: boolean
  signIn: (phone: string, password: string) => Promise<{ error: any }>
  signUp: (phone: string, password: string, name: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  refreshSchool: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [school, setSchool] = useState<School | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)
  const router = useRouter()

  useEffect(() => {
    checkUser()

    if (supabase) {
      const { data: { subscription } } = supabase!.auth.onAuthStateChange(
        async (event, session) => {
          // Don't override demo user with Supabase session
          const demoUserStr = localStorage.getItem('demo_user')
          if (demoUserStr) {
            return // Ignore Supabase auth for demo users
          }
          
          if (event === 'SIGNED_IN' && session) {
            await fetchUserData(session.user.id)
          } else if (event === 'SIGNED_OUT') {
            setUser(null)
            setSchool(null)
            setIsDemo(false)
          }
        }
      )

      return () => subscription.unsubscribe()
    }
  }, [])

  async function checkUser() {
    try {
      // Check for demo user FIRST, before any Supabase checks
      const demoUserStr = localStorage.getItem('demo_user')
      const demoSchoolStr = localStorage.getItem('demo_school')
      
      if (demoUserStr && demoSchoolStr) {
        const demoUser = JSON.parse(demoUserStr)
        const demoSchool = JSON.parse(demoSchoolStr)
        
        setUser({
          id: 'demo-user',
          auth_id: 'demo',
          school_id: demoSchool.id,
          full_name: demoUser.name,
          phone: '0700000000',
          role: demoUser.role as any,
          avatar_url: null,
          is_active: true,
        })
        setSchool(demoSchool)
        setIsDemo(true)
        setLoading(false)
        
        // Skip Supabase session check for demo users
        return
      }

      // Only check Supabase for non-demo users
      if (supabase?.auth) {
        const { data: { session } } = await supabase!.auth.getSession()
        if (session) {
          await fetchUserData(session.user.id)
          setIsDemo(false)
        }
      }
    } catch (error) {
      console.error('Error checking user:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchUserData(authId: string) {
    if (!supabase) return
    try {
      // Fetch user profile
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authId)
        .maybeSingle()


      if (userError) {
        console.error('Error fetching user:', userError)
        return
      }

      if (!userData) {
        console.error('No user profile found for auth_id:', authId)
        return
      }

      setUser(userData)

      // Fetch school if user has one
      if (userData.school_id) {
        const { data: schoolData } = await supabase
          .from('schools')
          .select('*')
          .eq('id', userData.school_id)
          .single()

        if (schoolData) {
          setSchool(schoolData)
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
    }
  }

  async function signIn(phone: string, password: string) {
    try {
      const email = `${phone}@omuto.sms`
      const { data, error } = await supabase!.auth.signInWithPassword({
        email,
        password,
      })

      if (error) return { error }

      await fetchUserData(data.user.id)

      // Route based on role
      let userRole = 'school_admin'
      if (supabase) {
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('auth_id', data.user.id)
          .single()
        userRole = userData?.role || 'school_admin'
      }

      if (userRole === 'super_admin') {
        router.push('/dashboard/schools')
      } else {
        router.push('/dashboard')
      }

      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  async function signUp(phone: string, password: string, name: string) {
    try {
      const email = `${phone}@omuto.sms`
      const { data, error } = await supabase!.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            phone: phone,
          },
        },
      })

      if (error) return { error }
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  async function refreshSchool() {
    if (!user?.school_id) return
    try {
      const { data: schoolData } = await supabase
        .from('schools')
        .select('*')
        .eq('id', user.school_id)
        .single()
      if (schoolData) {
        setSchool(schoolData)
      }
    } catch (error) {
      console.error('Error refreshing school:', error)
    }
  }

  async function signOut() {
    // Clear demo data if present
    localStorage.removeItem('demo_user')
    localStorage.removeItem('demo_school')
    
    await supabase!.auth.signOut()
    setUser(null)
    setSchool(null)
    router.push('/login')
  }

  return (
    <AuthContext.Provider value={{ user, school, loading, isDemo, signIn, signUp, signOut, refreshSchool }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

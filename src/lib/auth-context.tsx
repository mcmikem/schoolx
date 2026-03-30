'use client'
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { supabase } from './supabase'
import { useRouter } from 'next/navigation'
import { PlanType } from './payments/subscription-client'
import { FeatureStage, DEFAULT_FEATURE_STAGE } from './featureStages'

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
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  paypal_subscription_id?: string | null
  last_payment_at?: string | null
  next_payment_date?: string | null
  phone?: string
  email?: string
  feature_stage?: FeatureStage
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
  // Subscription status checking methods
  isSubscriptionActive: () => boolean
  getSubscriptionPlan: () => PlanType | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [school, setSchool] = useState<School | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)
  const router = useRouter()
  
  // Subscription status checking methods
  const isSubscriptionActive = () => {
    return school?.subscription_status === 'active' || school?.subscription_status === 'trial';
  };
  
  const getSubscriptionPlan = () => {
    return school?.subscription_plan as PlanType | null;
  };

  const fetchUserData = useCallback(async (authId: string) => {
    if (!supabase) return
    try {
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

      if (userData.school_id) {
        const { data: schoolData } = await supabase
          .from('schools')
          .select('*')
          .eq('id', userData.school_id)
          .single()

        if (schoolData) {
          setSchool({
            ...schoolData,
            feature_stage: (schoolData.feature_stage as FeatureStage) || DEFAULT_FEATURE_STAGE,
          })
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
    }
  }, [])

  const checkUser = useCallback(async () => {
    try {
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
        setSchool({
          ...demoSchool,
          feature_stage: (demoSchool.feature_stage as FeatureStage) || DEFAULT_FEATURE_STAGE,
        })
        setIsDemo(true)
        setLoading(false)
        return
      }

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
  }, [fetchUserData])

  useEffect(() => {
    checkUser()

    if (supabase) {
      const { data: { subscription } } = supabase!.auth.onAuthStateChange(
        async (event, session) => {
          // Only use demo data if explicitly in demo mode, not blocking real auth
          if (isDemo) return
          
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
  }, [checkUser, fetchUserData])

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
        setSchool({
          ...schoolData,
          feature_stage: (schoolData.feature_stage as FeatureStage) || DEFAULT_FEATURE_STAGE,
        })
      }
    } catch (error) {
      console.error('Error refreshing school:', error)
    }
  }

  async function signOut() {
    // Clear demo data if present
    localStorage.removeItem('demo_user')
    localStorage.removeItem('demo_school')
    
    try {
      await supabase!.auth.signOut()
    } catch (e) {
      // Continue even if signOut fails
    }
    setUser(null)
    setSchool(null)
    setIsDemo(false)
    router.push('/login')
  }

  return (
    <AuthContext.Provider value={{ user, school, loading, isDemo, signIn, signUp, signOut, refreshSchool, isSubscriptionActive, getSubscriptionPlan }}>
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

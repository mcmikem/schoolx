import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const isProd = process.env.NODE_ENV === 'production'
const isNonProd = !isProd
const isDev = process.env.NODE_ENV === 'development'
const debugLog = (...args: unknown[]) => {
  if (isDev) console.log(...args)
}

// Debug logging
debugLog('[Supabase Debug] URL:', supabaseUrl)
debugLog('[Supabase Debug] Anon Key:', supabaseAnonKey ? supabaseAnonKey.substring(0, 20) + '...' : 'null')

const isValidHttpUrl = (value?: string | null) => {
  if (!value || value.includes('your-supabase-url')) return false
  try {
    const parsed = new URL(value)
    const result = parsed.protocol === 'http:' || parsed.protocol === 'https:'
    debugLog('[Supabase Debug] isValidHttpUrl:', result, 'for', value)
    return result
  } catch {
    debugLog('[Supabase Debug] isValidHttpUrl: false (exception)')
    return false
  }
}

const isValidAnonKey = (key?: string) => {
  if (!key) {
    debugLog('[Supabase Debug] isValidAnonKey: false (null/empty)')
    return false
  }
  const sbPublishable = key.startsWith('sb_publishable_') && key.length > 20
  const eyJ = key.startsWith('eyJ') && key.length > 50
  const result = sbPublishable || eyJ
  debugLog('[Supabase Debug] isValidAnonKey:', result, '| sb_publishable_:', sbPublishable, '| eyJ:', eyJ, '| key:', key.substring(0, 30) + '...')
  return result
}

const hasUsableSupabaseConfig =
  isValidHttpUrl(supabaseUrl) &&
  isValidAnonKey(supabaseAnonKey)

debugLog('[Supabase Debug] hasUsableSupabaseConfig:', hasUsableSupabaseConfig)

const createMockQueryBuilder = () => {
  const listResult = { data: [], error: null, count: 0 }
  const itemResult = { data: null, error: null, count: 0 }

  const builder: Record<string, any> = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    upsert: () => builder,
    delete: () => builder,
    eq: () => builder,
    neq: () => builder,
    gt: () => builder,
    gte: () => builder,
    lt: () => builder,
    lte: () => builder,
    like: () => builder,
    ilike: () => builder,
    in: () => builder,
    contains: () => builder,
    overlaps: () => builder,
    is: () => builder,
    or: () => builder,
    order: () => builder,
    limit: () => builder,
    range: () => builder,
    match: () => builder,
    abortSignal: () => builder,
    then: (resolve: (value: typeof listResult) => unknown) => Promise.resolve(resolve(listResult)),
    catch: () => Promise.resolve(listResult),
    finally: () => Promise.resolve(listResult),
    single: async () => itemResult,
    maybeSingle: async () => itemResult,
  }

  return builder
}

const createMockClient = (): SupabaseClient => {
  const mock = {
    from: () => createMockQueryBuilder(),
    auth: {
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: null }),
      signUp: async () => ({ data: { user: null, session: null }, error: null }),
      signOut: async () => ({ error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    storage: {
      from: () => ({ upload: async () => ({ data: null, error: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }), createBucket: async () => ({ data: null, error: null }) }),
    },
  }
  return mock as unknown as SupabaseClient
}

if (!hasUsableSupabaseConfig && isProd) {
  // Fail fast in production builds/runtimes — mock clients hide incidents.
  throw new Error(
    "Supabase configuration missing/invalid. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

const realClient = hasUsableSupabaseConfig
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

// Debug output
debugLog('[Supabase] hasUsableSupabaseConfig:', hasUsableSupabaseConfig);
debugLog('[Supabase] realClient:', realClient ? 'created' : 'null');
debugLog('[Supabase] final supabase:', !!(realClient || createMockClient()) ? 'real/mock' : 'null');

export const supabase = realClient || (isNonProd ? createMockClient() : (null as unknown as SupabaseClient))


export type Database = {
  public: {
    Tables: {
      schools: {
        Row: {
          id: string
          name: string
          school_code: string
          district: string
          subcounty: string
          parish: string
          village: string
          school_type: 'primary' | 'secondary' | 'combined'
          ownership: 'private' | 'government' | 'government_aided'
          phone: string | null
          email: string | null
          logo_url: string | null
          primary_color: string
          uneab_center_number: string | null
          subscription_plan: 'free' | 'free_trial' | 'basic' | 'premium' | 'max'
          subscription_status: 'active' | 'expired' | 'trial' | 'past_due' | 'canceled' | 'unpaid' | 'suspended'
          trial_ends_at: string | null
          paypal_subscription_id: string | null
          last_payment_at: string | null
          last_payment_attempt: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['schools']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['schools']['Row']>
      }
      users: {
        Row: {
          id: string
          auth_id: string
          school_id: string | null
          full_name: string
          phone: string
          email: string | null
          role: 'super_admin' | 'school_admin' | 'admin' | 'board' | 'headmaster' | 'dean_of_studies' | 'bursar' | 'teacher' | 'secretary' | 'dorm_master' | 'student' | 'parent'
          avatar_url: string | null
          is_active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['users']['Row']>
      }
      students: {
        Row: {
          id: string
          school_id: string
          user_id: string | null
          student_number: string
          first_name: string
          last_name: string
          gender: 'M' | 'F'
          date_of_birth: string
          parent_name: string
          parent_phone: string
          parent_phone2: string | null
          address: string | null
          class_id: string
          admission_date: string
          ple_index_number: string | null
          status: 'active' | 'transferred' | 'dropped' | 'completed'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['students']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['students']['Row']>
      }
      classes: {
        Row: {
          id: string
          school_id: string
          name: string
          level: string
          stream: string | null
          class_teacher_id: string | null
          max_students: number
          academic_year: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['classes']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['classes']['Row']>
      }
      subjects: {
        Row: {
          id: string
          school_id: string
          name: string
          code: string
          level: 'primary' | 'secondary'
          is_compulsory: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['subjects']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['subjects']['Row']>
      }
      attendance: {
        Row: {
          id: string
          student_id: string
          class_id: string
          date: string
          status: 'present' | 'absent' | 'late' | 'excused'
          remarks: string | null
          recorded_by: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['attendance']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['attendance']['Row']>
      }
      grades: {
        Row: {
          id: string
          student_id: string
          subject_id: string
          class_id: string
          assessment_type: 'ca1' | 'ca2' | 'ca3' | 'ca4' | 'project' | 'exam'
          score: number
          max_score: number
          term: number
          academic_year: string
          recorded_by: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['grades']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['grades']['Row']>
      }
      fees: {
        Row: {
          id: string
          school_id: string
          class_id: string | null
          name: string
          amount: number
          term: number
          academic_year: string
          due_date: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['fees']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['fees']['Row']>
      }
      fee_payments: {
        Row: {
          id: string
          student_id: string
          fee_id: string
          amount_paid: number
          payment_method: 'cash' | 'mobile_money' | 'bank' | 'installment'
          payment_reference: string | null
          paid_by: string
          notes: string | null
          payment_date: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['fee_payments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['fee_payments']['Row']>
      }
      fee_structure: {
        Row: {
          id: string
          school_id: string
          class_id: string | null
          name: string
          amount: number
          term: number
          academic_year: string
          due_date: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['fee_structure']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['fee_structure']['Row']>
      }
    }
  }
}

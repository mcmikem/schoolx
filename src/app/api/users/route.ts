import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface AddUserRequest {
  schoolId: string
  fullName: string
  phone: string
  password: string
  role: string
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseServiceKey) {
      return apiError('Server configuration error', 500)
    }

    const body: AddUserRequest = await request.json()
    const { schoolId, fullName, phone, password, role } = body

    if (!schoolId || !fullName || !phone || !password) {
      return apiError('All fields are required', 400)
    }

    if (password.length < 6) {
      return apiError('Password must be at least 6 characters', 400)
    }

    // Normalize phone
    const normalizedPhone = phone.replace(/[^0-9]/g, '')

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Check if phone exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('phone', normalizedPhone)
      .single()

    if (existingUser) {
      return apiError('This phone number already exists', 400)
    }

    // Create auth user
    const email = `${normalizedPhone}@omuto.sms`
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone: normalizedPhone }
    })

    if (authError) throw authError

    // Create user record
    const { error: userError } = await supabaseAdmin.from('users').insert({
      auth_id: authData.user.id,
      school_id: schoolId,
      full_name: fullName,
      phone: normalizedPhone,
      role,
      is_active: true
    })

    if (userError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw userError
    }

    return apiSuccess({ userId: authData.user.id }, 'User added successfully')
  } catch (error) {
    return handleApiError(error)
  }
}

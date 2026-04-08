import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  apiSuccess,
  apiError,
  handleApiError,
  validateRequiredFields,
  requireUserWithSchool,
  assertSchoolScopeOrDeny,
} from '@/lib/api-utils'
import { sanitizeString, sanitizePhone } from '@/lib/validation'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const VALID_ROLES = [
  'school_admin', 'headmaster', 'dean_of_studies', 'bursar',
  'teacher', 'secretary', 'dorm_master', 'parent'
]

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

    const auth = await requireUserWithSchool(request)
    if (!auth.ok) return auth.response

    const body: AddUserRequest = await request.json()
    const { schoolId, fullName, phone, password, role } = body

    const scope = assertSchoolScopeOrDeny({
      userSchoolId: auth.context.schoolId,
      requestedSchoolId: schoolId,
    })
    if (!scope.ok) return scope.response

    if (!['school_admin', 'super_admin'].includes(auth.context.user.role)) {
      return apiError('Forbidden', 403)
    }
    
    const validationError = validateRequiredFields(body as unknown as Record<string, unknown>, ['schoolId', 'fullName', 'phone', 'password', 'role'])
    if (validationError) {
      return apiError(validationError, 400)
    }

    if (password.length < 6) {
      return apiError('Password must be at least 6 characters', 400)
    }

    if (!VALID_ROLES.includes(role)) {
      return apiError('Invalid role', 400)
    }

    // Sanitize inputs
    const sanitizedName = sanitizeString(fullName)
    const sanitizedPhone = sanitizePhone(phone)
    
    if (sanitizedName.length < 2) {
      return apiError('Name must be at least 2 characters', 400)
    }

    if (sanitizedPhone.length < 10 || sanitizedPhone.length > 15) {
      return apiError('Invalid phone number', 400)
    }

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Check if phone exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('phone', sanitizedPhone)
      .single()

    if (existingUser) {
      return apiError('This phone number already exists', 400)
    }

    // Create auth user
    const email = `${sanitizedPhone}@omuto.sms`
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: sanitizedName, phone: sanitizedPhone }
    })

    if (authError) throw authError

    // Create user record
    const { error: userError } = await supabaseAdmin.from('users').insert({
      auth_id: authData.user.id,
      school_id: schoolId,
      full_name: sanitizedName,
      phone: sanitizedPhone,
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

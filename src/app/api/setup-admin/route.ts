import { NextRequest } from 'next/server'
import { apiError, apiSuccess, handleApiError, validateRequiredFields, rateLimit } from '@/lib/api-utils'
import { createManagedUserAccount, createSupabaseAdminClient } from '@/lib/server/user-provisioning'

interface SetupAdminRequest {
  name: string
  phone: string
  password: string
}

let setupAdminInProgress = false

export async function POST(request: NextRequest) {
  if (setupAdminInProgress) {
    return apiError('Setup is already in progress. Please retry in a moment.', 409)
  }

  setupAdminInProgress = true
  try {
    // Rate limit: 3 attempts per IP per hour
    const { success } = rateLimit(request, 3, 3_600_000);
    if (!success) {
      return apiError("Too many attempts. Please try again later.", 429);
    }

    const body: SetupAdminRequest = await request.json()
    const validationError = validateRequiredFields(body as unknown as Record<string, unknown>, [
      'name',
      'phone',
      'password',
    ])

    if (validationError) {
      return apiError(validationError, 400)
    }

    const supabaseAdmin = createSupabaseAdminClient()

    const { data: existingSuperAdmin } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('role', 'super_admin')
      .maybeSingle()

    if (existingSuperAdmin) {
      return apiError('Setup has already been completed', 409)
    }

    const account = await createManagedUserAccount({
      supabaseAdmin,
      fullName: body.name,
      phone: body.phone,
      password: body.password,
      role: 'super_admin',
    })

    return apiSuccess({ userId: account.userId }, 'Super admin created', 201)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Super admin already exists') {
        return apiError('Super admin already exists', 409)
      }
      if (error.message === 'This phone number already exists') {
        return apiError('This phone number already exists', 400)
      }
      if (error.message === 'Password must be at least 6 characters') {
        return apiError('Password must be at least 6 characters', 400)
      }
      if (error.message === 'Invalid phone number') {
        return apiError('Invalid phone number', 400)
      }
      if (error.message === 'Name must be at least 2 characters') {
        return apiError('Name must be at least 2 characters', 400)
      }
    }

    const structuredError = error as {
      code?: string
      message?: string
      details?: string
      hint?: string
    }

    if (
      structuredError?.code === '23505' &&
      /users_single_super_admin_idx|super_admin/i.test(
        `${structuredError.message || ''} ${structuredError.details || ''} ${structuredError.hint || ''}`,
      )
    ) {
      return apiError('Setup has already been completed', 409)
    }

    return handleApiError(error)
  } finally {
    setupAdminInProgress = false
  }
}
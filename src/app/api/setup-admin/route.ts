import { NextRequest } from 'next/server'
import { apiError, apiSuccess, handleApiError, validateRequiredFields, rateLimit } from '@/lib/api-utils'
import { createManagedUserAccount, createSupabaseAdminClient } from '@/lib/server/user-provisioning'

interface SetupAdminRequest {
  name: string
  phone: string
  password: string
}

export async function POST(request: NextRequest) {
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
      return apiError('Super admin already exists', 409)
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
      if (
        error.message === 'Super admin already exists' ||
        error.message === 'This phone number already exists' ||
        error.message === 'Password must be at least 6 characters' ||
        error.message === 'Invalid phone number' ||
        error.message === 'Name must be at least 2 characters'
      ) {
        return apiError(
          error.message,
          error.message === 'Super admin already exists' ? 409 : 400,
        )
      }
    }

    return handleApiError(error)
  }
}
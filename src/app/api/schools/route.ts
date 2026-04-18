import { NextRequest } from 'next/server'
import {
  apiError,
  apiSuccess,
  handleApiError,
  requireUserWithSchool,
  validateRequiredFields,
} from '@/lib/api-utils'
import { normalizePlanType } from '@/lib/payments/subscription-client'
import { reserveUniqueSchoolCode, seedSchoolDefaults } from '@/lib/server/school-provisioning'
import {
  createManagedUserAccount,
  createSupabaseAdminClient,
  deleteManagedUserAccount,
} from '@/lib/server/user-provisioning'
import type { SchoolSetupType } from '@/lib/school-setup'

interface CreateSchoolRequest {
  name: string
  school_code?: string
  district: string
  school_type: 'primary' | 'secondary' | 'combined'
  ownership: 'private' | 'government' | 'government_aided'
  phone?: string
  subscription_plan?: string
  adminName: string
  adminPhone: string
  adminPassword: string
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request)
    if (!auth.ok) return auth.response

    if (auth.context.user.role !== 'super_admin') {
      return apiError('Forbidden', 403)
    }

    const body: CreateSchoolRequest = await request.json()
    const validationError = validateRequiredFields(body as unknown as Record<string, unknown>, [
      'name',
      'district',
      'school_type',
      'ownership',
      'adminName',
      'adminPhone',
      'adminPassword',
    ])

    if (validationError) {
      return apiError(validationError, 400)
    }

    const supabaseAdmin = createSupabaseAdminClient()
    const subscriptionPlan = normalizePlanType(body.subscription_plan || 'starter')
    const schoolCode = await reserveUniqueSchoolCode(
      supabaseAdmin,
      body.name,
      body.district,
      body.school_code,
    )

    const { data: schoolData, error: schoolError } = await supabaseAdmin
      .from('schools')
      .insert({
        name: body.name.trim(),
        school_code: schoolCode,
        district: body.district.trim(),
        subcounty: null,
        school_type: body.school_type,
        ownership: body.ownership,
        phone: body.phone?.trim() || null,
        subscription_plan: subscriptionPlan,
        subscription_status: 'trial',
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        primary_color: '#1e3a5f',
      })
      .select()
      .single()

    if (schoolError || !schoolData?.id) {
      throw schoolError || new Error('Failed to create school')
    }

    let authUserId: string | null = null

    try {
      const account = await createManagedUserAccount({
        supabaseAdmin,
        fullName: body.adminName,
        phone: body.adminPhone,
        password: body.adminPassword,
        role: 'school_admin',
        schoolId: schoolData.id,
      })
      authUserId = account.userId

      await seedSchoolDefaults(
        supabaseAdmin,
        schoolData.id,
        body.school_type as SchoolSetupType,
      )

      return apiSuccess(
        {
          schoolId: schoolData.id,
          schoolCode,
          userId: account.userId,
        },
        'School created successfully',
        201,
      )
    } catch (error) {
      if (authUserId) {
        await deleteManagedUserAccount(supabaseAdmin, authUserId)
      }
      await supabaseAdmin.from('schools').delete().eq('id', schoolData.id)
      throw error
    }
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message === 'School code already exists' ||
        error.message === 'Unable to generate unique school code. Please try again.' ||
        error.message === 'This phone number already exists' ||
        error.message === 'Password must be at least 6 characters' ||
        error.message === 'Invalid phone number' ||
        error.message === 'Name must be at least 2 characters'
      ) {
        return apiError(error.message, 400)
      }
    }

    return handleApiError(error)
  }
}
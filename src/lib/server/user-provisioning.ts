import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { normalizeAuthPhone, sanitizeString } from '@/lib/validation'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export function createSupabaseAdminClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Server configuration error')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function normalizeProvisioningPhone(phone: string) {
  const normalizedPhone = normalizeAuthPhone(phone)

  if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
    throw new Error('Invalid phone number')
  }

  return normalizedPhone
}

export function sanitizeProvisioningName(fullName: string) {
  const sanitizedName = sanitizeString(fullName)

  if (sanitizedName.length < 2) {
    throw new Error('Name must be at least 2 characters')
  }

  return sanitizedName
}

export function buildProvisioningEmail(phone: string) {
  return `${phone}@omuto.org`
}

interface CreateManagedUserAccountInput {
  supabaseAdmin: SupabaseClient
  fullName: string
  phone: string
  password: string
  role: string
  schoolId?: string | null
  email?: string | null
  isActive?: boolean
}

export async function createManagedUserAccount({
  supabaseAdmin,
  fullName,
  phone,
  password,
  role,
  schoolId = null,
  email = null,
  isActive = true,
}: CreateManagedUserAccountInput) {
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters')
  }

  const sanitizedName = sanitizeProvisioningName(fullName)
  const sanitizedPhone = normalizeProvisioningPhone(phone)

  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('phone', sanitizedPhone)
    .maybeSingle()

  if (existingUser) {
    throw new Error('This phone number already exists')
  }

  const authEmail = buildProvisioningEmail(sanitizedPhone)
  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: sanitizedName,
        phone: sanitizedPhone,
        role,
      },
    })

  if (authError || !authData.user?.id) {
    throw authError || new Error('Failed to create auth user')
  }

  const { error: userError } = await supabaseAdmin.from('users').insert({
    auth_id: authData.user.id,
    school_id: schoolId,
    full_name: sanitizedName,
    phone: sanitizedPhone,
    email,
    role,
    is_active: isActive,
  })

  if (userError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    throw userError
  }

  return {
    userId: authData.user.id,
    phone: sanitizedPhone,
    authEmail,
  }
}

export async function deleteManagedUserAccount(
  supabaseAdmin: SupabaseClient,
  authUserId: string,
) {
  await supabaseAdmin.from('users').delete().eq('auth_id', authUserId)
  await supabaseAdmin.auth.admin.deleteUser(authUserId)
}
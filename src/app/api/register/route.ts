import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Get default subjects based on school type
function getDefaultSubjects(schoolType: string) {
  if (schoolType === 'primary') {
    return [
      { name: 'English', code: 'ENG', level: 'primary', is_compulsory: true },
      { name: 'Mathematics', code: 'MTC', level: 'primary', is_compulsory: true },
      { name: 'Integrated Science', code: 'SCI', level: 'primary', is_compulsory: true },
      { name: 'Social Studies', code: 'SST', level: 'primary', is_compulsory: true },
      { name: 'Religious Education', code: 'CRE', level: 'primary', is_compulsory: true },
      { name: 'Physical Education', code: 'PE', level: 'primary', is_compulsory: true },
      { name: 'Local Language', code: 'LNG', level: 'primary', is_compulsory: false },
    ]
  } else if (schoolType === 'secondary') {
    return [
      { name: 'English', code: 'ENG', level: 'secondary', is_compulsory: true },
      { name: 'Mathematics', code: 'MTC', level: 'secondary', is_compulsory: true },
      { name: 'Biology', code: 'BIO', level: 'secondary', is_compulsory: true },
      { name: 'Chemistry', code: 'CHEM', level: 'secondary', is_compulsory: true },
      { name: 'Physics', code: 'PHY', level: 'secondary', is_compulsory: true },
      { name: 'Geography', code: 'GEO', level: 'secondary', is_compulsory: true },
      { name: 'History', code: 'HIS', level: 'secondary', is_compulsory: true },
      { name: 'Christian Religious Education', code: 'CRE', level: 'secondary', is_compulsory: true },
    ]
  } else {
    // Combined - primary + secondary subjects
    return [
      { name: 'English', code: 'ENG', level: 'primary', is_compulsory: true },
      { name: 'Mathematics', code: 'MTC', level: 'primary', is_compulsory: true },
      { name: 'Science', code: 'SCI', level: 'primary', is_compulsory: true },
      { name: 'Social Studies', code: 'SST', level: 'primary', is_compulsory: true },
      { name: 'Religious Education', code: 'CRE', level: 'primary', is_compulsory: true },
      // Secondary
      { name: 'English', code: 'ENG', level: 'secondary', is_compulsory: true },
      { name: 'Mathematics', code: 'MTC', level: 'secondary', is_compulsory: true },
      { name: 'Biology', code: 'BIO', level: 'secondary', is_compulsory: true },
      { name: 'Chemistry', code: 'CHEM', level: 'secondary', is_compulsory: true },
    ]
  }
}

// Get default classes based on school type
function getDefaultClasses(schoolType: string, schoolId: string) {
  const currentYear = new Date().getFullYear()
  
  if (schoolType === 'primary') {
    return [
      { school_id: schoolId, name: 'Baby', level: 'primary', stream: null, academic_year: currentYear.toString() },
      { school_id: schoolId, name: 'Middle', level: 'primary', stream: null, academic_year: currentYear.toString() },
      { school_id: schoolId, name: 'Top', level: 'primary', stream: null, academic_year: currentYear.toString() },
      { school_id: schoolId, name: 'P1', level: 'primary', stream: null, academic_year: currentYear.toString() },
      { school_id: schoolId, name: 'P2', level: 'primary', stream: null, academic_year: currentYear.toString() },
      { school_id: schoolId, name: 'P3', level: 'primary', stream: null, academic_year: currentYear.toString() },
      { school_id: schoolId, name: 'P4', level: 'primary', stream: null, academic_year: currentYear.toString() },
      { school_id: schoolId, name: 'P5', level: 'primary', stream: null, academic_year: currentYear.toString() },
      { school_id: schoolId, name: 'P6', level: 'primary', stream: null, academic_year: currentYear.toString() },
      { school_id: schoolId, name: 'P7', level: 'primary', stream: null, academic_year: currentYear.toString() },
    ]
  } else if (schoolType === 'secondary') {
    return [
      { school_id: schoolId, name: 'S1', level: 'secondary', stream: null, academic_year: currentYear.toString() },
      { school_id: schoolId, name: 'S2', level: 'secondary', stream: null, academic_year: currentYear.toString() },
      { school_id: schoolId, name: 'S3', level: 'secondary', stream: null, academic_year: currentYear.toString() },
      { school_id: schoolId, name: 'S4', level: 'secondary', stream: null, academic_year: currentYear.toString() },
      { school_id: schoolId, name: 'S5', level: 'secondary', stream: null, academic_year: currentYear.toString() },
      { school_id: schoolId, name: 'S6', level: 'secondary', stream: null, academic_year: currentYear.toString() },
    ]
  } else {
    // Combined - include both primary and secondary
    return [
      { school_id: schoolId, name: 'P1', level: 'primary', stream: null, academic_year: currentYear.toString() },
      { school_id: schoolId, name: 'P2', level: 'primary', stream: null, academic_year: currentYear.toString() },
      { school_id: schoolId, name: 'P3', level: 'primary', stream: null, academic_year: currentYear.toString() },
      { school_id: schoolId, name: 'P4', level: 'primary', stream: null, academic_year: currentYear.toString() },
      { school_id: schoolId, name: 'P5', level: 'primary', stream: null, academic_year: currentYear.toString() },
      { school_id: schoolId, name: 'P6', level: 'primary', stream: null, academic_year: currentYear.toString() },
      { school_id: schoolId, name: 'P7', level: 'primary', stream: null, academic_year: currentYear.toString() },
      { school_id: schoolId, name: 'S1', level: 'secondary', stream: null, academic_year: currentYear.toString() },
      { school_id: schoolId, name: 'S2', level: 'secondary', stream: null, academic_year: currentYear.toString() },
      { school_id: schoolId, name: 'S3', level: 'secondary', stream: null, academic_year: currentYear.toString() },
      { school_id: schoolId, name: 'S4', level: 'secondary', stream: null, academic_year: currentYear.toString() },
      { school_id: schoolId, name: 'S5', level: 'secondary', stream: null, academic_year: currentYear.toString() },
      { school_id: schoolId, name: 'S6', level: 'secondary', stream: null, academic_year: currentYear.toString() },
    ]
  }
}

interface RegisterRequest {
  schoolName: string
  district: string
  subcounty: string
  schoolType: 'primary' | 'secondary' | 'combined'
  ownership: 'private' | 'government' | 'government_aided'
  phone?: string
  email?: string
  adminName: string
  adminPhone: string
  password: string
}

// Generate a unique school code based on school name and district
function generateSchoolCode(schoolName: string, district: string): string {
  // Get first 2 letters of each word in school name (max 4 letters)
  const nameWords = schoolName.toUpperCase().replace(/[^A-Z\s]/g, '').split(/\s+/).filter(w => w.length > 0)
  let nameCode = ''
  for (const word of nameWords.slice(0, 3)) {
    nameCode += word.substring(0, 2)
    if (nameCode.length >= 4) break
  }
  nameCode = nameCode.substring(0, 4) || 'SCHL'
  
  // Get first 2 letters of district
  const districtCode = district.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 2) || 'UG'
  
  // Generate random 3-digit number
  const randomNum = Math.floor(100 + Math.random() * 900)
  
  return `${nameCode}${districtCode}${randomNum}`
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseServiceKey) {
      return apiError('Server configuration error: SUPABASE_SERVICE_ROLE_KEY not set', 500)
    }

    const body: RegisterRequest = await request.json()
    const {
      schoolName,
      district,
      subcounty,
      schoolType,
      ownership,
      phone,
      email,
      adminName,
      adminPhone,
      password,
    } = body

    // Validate required fields
    if (!schoolName || !district || !subcounty || !adminName || !adminPhone || !password) {
      return apiError('All required fields must be filled', 400)
    }

    if (password.length < 6) {
      return apiError('Password must be at least 6 characters', 400)
    }

    // Normalize phone number (remove spaces, dashes, keep only digits)
    const normalizedPhone = adminPhone.replace(/[^0-9]/g, '')

    if (normalizedPhone.length < 9 || normalizedPhone.length > 12) {
      return apiError('Invalid phone number format', 400)
    }

    // Create admin client (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // 1. Check if phone number already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('phone', normalizedPhone)
      .single()

    if (existingUser) {
      return apiError('This phone number is already registered. Please sign in or use a different number.', 400)
    }

    // 2. Generate unique school code
    let schoolCode = generateSchoolCode(schoolName, district)
    let attempts = 0
    const maxAttempts = 10

    while (attempts < maxAttempts) {
      const { data: existingSchool } = await supabaseAdmin
        .from('schools')
        .select('id')
        .eq('school_code', schoolCode)
        .single()

      if (!existingSchool) break
      
      // Generate new code if collision
      schoolCode = generateSchoolCode(schoolName, district)
      attempts++
    }

    if (attempts >= maxAttempts) {
      return apiError('Unable to generate unique school code. Please try again.', 400)
    }

    // 3. Create auth user using admin client
    const emailForAuth = `${normalizedPhone}@omuto.sms`
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: emailForAuth,
      password: password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: adminName,
        phone: normalizedPhone,
        role: 'school_admin',
      },
    })

    if (authError) {
      // Check if it's a duplicate email error
      if (authError.message.includes('already registered') || authError.message.includes('duplicate')) {
        return apiError('This phone number is already registered. Please sign in.', 400)
      }
      throw authError
    }

    // 4. Create school record
    const { data: schoolData, error: schoolError } = await supabaseAdmin
      .from('schools')
      .insert({
        name: schoolName,
        school_code: schoolCode,
        district,
        subcounty,
        school_type: schoolType,
        ownership,
        phone: phone || null,
        email: email || null,
        subscription_plan: 'free',
        subscription_status: 'trial',
        trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        primary_color: '#1e3a5f',
      })
      .select()
      .single()

    if (schoolError) {
      // Cleanup: delete auth user if school creation fails
      if (authData?.user) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      }
      throw schoolError
    }

    // 5. Create user record
    const { error: userError } = await supabaseAdmin.from('users').insert({
      auth_id: authData.user.id,
      school_id: schoolData.id,
      full_name: adminName,
      phone: normalizedPhone,
      email: email || null,
      role: 'school_admin',
      is_active: true,
    })

    if (userError) {
      // Cleanup: delete auth user and school if user creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      await supabaseAdmin.from('schools').delete().eq('id', schoolData.id)
      throw userError
    }

    // 6. Auto-seed in background (don't fail registration if this fails)
    // Run setup asynchronously to avoid timeout
    const setupPromise = (async () => {
      try {
        const currentYear = new Date().getFullYear().toString()
        
        // Create subjects
        const defaultSubjects = getDefaultSubjects(schoolType)
        if (defaultSubjects.length > 0) {
          const subjectRecords = defaultSubjects.map(s => ({
            school_id: schoolData.id,
            name: s.name,
            code: s.code,
            level: s.level,
            is_compulsory: s.is_compulsory,
          }))
          await supabaseAdmin.from('subjects').insert(subjectRecords)
        }

        // Create classes
        const defaultClasses = getDefaultClasses(schoolType, schoolData.id)
        if (defaultClasses.length > 0) {
          await supabaseAdmin.from('classes').insert(defaultClasses)
        }

        // Create academic year (use correct column names from schema)
        const { data: academicYear } = await supabaseAdmin
          .from('academic_years')
          .insert({
            school_id: schoolData.id,
            year: `${currentYear}`,
            is_current: true,
          })
          .select()
          .single()

        // Create terms
        if (academicYear) {
          await supabaseAdmin.from('terms').insert([
            { school_id: schoolData.id, academic_year_id: academicYear.id, term_number: 1, start_date: `${currentYear}-02-01`, end_date: `${currentYear}-04-30`, is_current: true },
            { school_id: schoolData.id, academic_year_id: academicYear.id, term_number: 2, start_date: `${currentYear}-05-01`, end_date: `${currentYear}-07-31`, is_current: false },
            { school_id: schoolData.id, academic_year_id: academicYear.id, term_number: 3, start_date: `${currentYear}-08-01`, end_date: `${currentYear}-11-30`, is_current: false },
          ])
        }
        
        console.log('[Setup] Auto-setup completed for school:', schoolData.id)
      } catch (setupError) {
        console.error('[Setup] Auto-setup failed:', setupError)
        // Don't throw - registration already succeeded
      }
    })()

    // Don't await - let it run in background

    // Return success - client will sign in separately
    return apiSuccess(
      {
        schoolId: schoolData.id,
        userId: authData.user.id,
        schoolCode,
      },
      'Registration successful'
    )
  } catch (error) {
    console.error('[Register Error]', error)
    return handleApiError(error)
  }
}

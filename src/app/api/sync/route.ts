import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  apiSuccess,
  apiError,
  handleApiError,
  requireUserWithSchool,
  assertSchoolScopeOrDeny,
  assertUserRoleOrDeny,
} from '@/lib/api-utils'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

interface SyncItem {
  id: string
  table: string
  action: 'create' | 'update' | 'delete'
  data: Record<string, unknown>
}

const VALID_TABLES = [
  'students',
  'classes',
  'subjects',
  'attendance',
  'grades',
  'fee_payments',
  'fee_structure',
  'fee_adjustments',
  'messages',
  'events',
  'timetable',
]
const SOFT_DELETE_TABLES = new Set(['grades', 'fee_payments', 'fee_structure', 'fee_adjustments'])
const DIRECT_SCHOOL_TABLES = new Set([
  'students',
  'classes',
  'subjects',
  'fee_structure',
  'fee_adjustments',
  'messages',
  'events',
  'timetable',
])
const OWNED_RELATION_TABLES = new Set(['attendance', 'grades', 'fee_payments'])
const SYNC_ALLOWED_ROLES = [
  'super_admin',
  'school_admin',
  'admin',
  'headmaster',
  'dean_of_studies',
  'teacher',
  'bursar',
  'secretary',
  'dorm_master',
]

async function resolveSchoolOwnership(params: {
  supabase: ReturnType<typeof createClient>
  table: string
  action: SyncItem['action']
  data: Record<string, unknown>
  schoolId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, table, action, data, schoolId } = params

  if (DIRECT_SCHOOL_TABLES.has(table)) {
    if (action === 'create') {
      return data.school_id === schoolId
        ? { ok: true }
        : { ok: false, error: `Forbidden: school scope mismatch for ${table}` }
    }

    const recordId = data.id
    if (typeof recordId !== 'string' || recordId.length === 0) {
      return { ok: false, error: `Missing id for ${action} on ${table}` }
    }

    const { data: existing, error } = await supabase
      .from(table)
      .select('school_id')
      .eq('id', recordId)
      .maybeSingle()

    if (error || !existing || existing.school_id !== schoolId) {
      return { ok: false, error: `Forbidden: school scope mismatch for ${table}` }
    }

    return { ok: true }
  }

  if (table === 'attendance') {
    if (action === 'create') {
      const classId = data.class_id
      const studentId = data.student_id

      if (typeof classId === 'string') {
        const { data: classRow } = await supabase
          .from('classes')
          .select('school_id')
          .eq('id', classId)
          .maybeSingle()
        if (classRow?.school_id === schoolId) return { ok: true }
      }

      if (typeof studentId === 'string') {
        const { data: studentRow } = await supabase
          .from('students')
          .select('school_id')
          .eq('id', studentId)
          .maybeSingle()
        if (studentRow?.school_id === schoolId) return { ok: true }
      }

      return { ok: false, error: 'Forbidden: attendance record is outside school scope' }
    }

    const recordId = data.id
    if (typeof recordId !== 'string' || recordId.length === 0) {
      return { ok: false, error: `Missing id for ${action} on attendance` }
    }

    const { data: existing } = await supabase
      .from('attendance')
      .select('student_id, class_id')
      .eq('id', recordId)
      .maybeSingle()

    if (!existing) {
      return { ok: false, error: 'Forbidden: attendance record not found in school scope' }
    }

    return resolveSchoolOwnership({
      supabase,
      table: 'attendance',
      action: 'create',
      data: existing as Record<string, unknown>,
      schoolId,
    })
  }

  if (table === 'grades') {
    if (action === 'create') {
      const classId = data.class_id
      const studentId = data.student_id

      if (typeof classId === 'string') {
        const { data: classRow } = await supabase
          .from('classes')
          .select('school_id')
          .eq('id', classId)
          .maybeSingle()
        if (classRow?.school_id === schoolId) return { ok: true }
      }

      if (typeof studentId === 'string') {
        const { data: studentRow } = await supabase
          .from('students')
          .select('school_id')
          .eq('id', studentId)
          .maybeSingle()
        if (studentRow?.school_id === schoolId) return { ok: true }
      }

      return { ok: false, error: 'Forbidden: grade record is outside school scope' }
    }

    const recordId = data.id
    if (typeof recordId !== 'string' || recordId.length === 0) {
      return { ok: false, error: `Missing id for ${action} on grades` }
    }

    const { data: existing } = await supabase
      .from('grades')
      .select('student_id, class_id')
      .eq('id', recordId)
      .maybeSingle()

    if (!existing) {
      return { ok: false, error: 'Forbidden: grade record not found in school scope' }
    }

    return resolveSchoolOwnership({
      supabase,
      table: 'grades',
      action: 'create',
      data: existing as Record<string, unknown>,
      schoolId,
    })
  }

  if (table === 'fee_payments') {
    if (action === 'create') {
      const studentId = data.student_id
      if (typeof studentId !== 'string') {
        return { ok: false, error: 'Missing student_id for fee_payments create' }
      }

      const { data: studentRow } = await supabase
        .from('students')
        .select('school_id')
        .eq('id', studentId)
        .maybeSingle()

      return studentRow?.school_id === schoolId
        ? { ok: true }
        : { ok: false, error: 'Forbidden: fee payment is outside school scope' }
    }

    const recordId = data.id
    if (typeof recordId !== 'string' || recordId.length === 0) {
      return { ok: false, error: `Missing id for ${action} on fee_payments` }
    }

    const { data: existing } = await supabase
      .from('fee_payments')
      .select('student_id')
      .eq('id', recordId)
      .maybeSingle()

    if (!existing) {
      return { ok: false, error: 'Forbidden: fee payment not found in school scope' }
    }

    return resolveSchoolOwnership({
      supabase,
      table: 'fee_payments',
      action: 'create',
      data: existing as Record<string, unknown>,
      schoolId,
    })
  }

  return { ok: false, error: `Unsupported sync table: ${table}` }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const items: SyncItem[] = body.items
    const schoolId = body.schoolId as unknown

    if (!items || !Array.isArray(items) || items.length === 0) {
      return apiError('No sync items provided', 400)
    }

    if (items.length > 100) {
      return apiError('Too many items in a single sync request (max 100)', 400)
    }

    const auth = await requireUserWithSchool(request)
    if (!auth.ok) return auth.response

    const roleCheck = assertUserRoleOrDeny({
      userRole: auth.context.user.role,
      allowedRoles: SYNC_ALLOWED_ROLES,
    })
    if (!roleCheck.ok) return roleCheck.response

    const scope = assertSchoolScopeOrDeny({
      userSchoolId: auth.context.schoolId,
      requestedSchoolId: schoolId,
    })
    if (!scope.ok) return scope.response

    // Use service role to support background sync for offline clients, but enforce tenancy checks below.
    const key = supabaseServiceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!key) return apiError('Server configuration error', 500)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient(supabaseUrl, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }) as any

    let successCount = 0
    let failedCount = 0
    const errors: string[] = []

    for (const item of items) {
      try {
        if (!VALID_TABLES.includes(item.table)) {
          failedCount++
          errors.push(`Invalid table: ${item.table}`)
          continue
        }

        if (!item.data || typeof item.data !== 'object') {
          failedCount++
          errors.push(`Invalid data for item ${item.id}`)
          continue
        }

        // Basic tenancy enforcement: require school_id to match on all scoped tables.
        const ownership = await resolveSchoolOwnership({
          supabase,
          table: item.table,
          action: item.action,
          data: item.data,
          schoolId: scope.schoolId,
        })
        if (!ownership.ok) {
          failedCount++
          errors.push(ownership.error)
          continue
        }

        switch (item.action) {
          case 'create': {
            const { error } = await supabase.from(item.table).insert(item.data)
            if (error) {
              failedCount++
              errors.push(`Create failed for ${item.table}: ${error.message}`)
            } else {
              successCount++
            }
            break
          }

          case 'update': {
            const recordId = item.data.id as string
            if (!recordId) {
              failedCount++
              errors.push(`Missing id for update on ${item.table}`)
              continue
            }
            const { id, ...updateData } = item.data
            const query = supabase.from(item.table).update(updateData).eq('id', recordId)
            const { error } = await query
            if (error) {
              failedCount++
              errors.push(`Update failed for ${item.table}: ${error.message}`)
            } else {
              successCount++
            }
            break
          }

          case 'delete': {
            const deleteId = item.data.id as string
            if (!deleteId) {
              failedCount++
              errors.push(`Missing id for delete on ${item.table}`)
              continue
            }
            const query = supabase.from(item.table)
            const { error } = SOFT_DELETE_TABLES.has(item.table)
              ? await query.update({ deleted_at: new Date().toISOString() }).eq('id', deleteId)
              : await query.delete().eq('id', deleteId)
            if (error) {
              failedCount++
              errors.push(`Delete failed for ${item.table}: ${error.message}`)
            } else {
              successCount++
            }
            break
          }

          default:
            failedCount++
            errors.push(`Unknown action: ${item.action}`)
        }
      } catch (err) {
        failedCount++
        errors.push(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown'}`)
      }
    }

    return apiSuccess({
      success: successCount,
      failed: failedCount,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

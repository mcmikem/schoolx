import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils'

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const items: SyncItem[] = body.items

    if (!items || !Array.isArray(items) || items.length === 0) {
      return apiError('No sync items provided', 400)
    }

    if (items.length > 100) {
      return apiError('Too many items in a single sync request (max 100)', 400)
    }

    const key = supabaseServiceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!key) {
      return apiError('Server configuration error', 500)
    }

    const supabase = createClient(supabaseUrl, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

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
            const { error } = await supabase
              .from(item.table)
              .update(updateData)
              .eq('id', recordId)
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

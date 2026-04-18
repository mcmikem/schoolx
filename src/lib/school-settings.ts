import { supabase } from './supabase'
import { getErrorMessage } from './validation'

export type SchoolSettingsMap = Record<string, string>

export function serializeSettingValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return JSON.stringify(value)
}

export function parseSettingValue<T>(value: string | null | undefined, fallback: T): T {
  if (value === undefined || value === null || value === '') return fallback

  try {
    return JSON.parse(value) as T
  } catch {
    return value as T
  }
}

export async function loadSchoolSettings(
  schoolId: string,
  keys?: string[],
): Promise<SchoolSettingsMap> {
  if (!schoolId || !supabase) return {}

  try {
    let query = supabase
      .from('school_settings')
      .select('key, value')
      .eq('school_id', schoolId)

    if (keys && keys.length > 0) {
      query = query.in('key', keys)
    }

    const { data, error } = await query
    if (error) throw error

    const entries = (data || []).map((row) => [row.key, row.value ?? ''] as const)
    return Object.fromEntries(entries)
  } catch (error) {
    console.warn('School settings fallback in use:', getErrorMessage(error))
    return {}
  }
}

export async function loadSchoolSetting<T>(
  schoolId: string,
  key: string,
  fallback: T,
): Promise<T> {
  const settings = await loadSchoolSettings(schoolId, [key])
  return parseSettingValue(settings[key], fallback)
}

export async function saveSchoolSetting(
  schoolId: string,
  key: string,
  value: unknown,
): Promise<void> {
  if (!schoolId || !supabase) return

  const { error } = await supabase
    .from('school_settings')
    .upsert(
      {
        school_id: schoolId,
        key,
        value: serializeSettingValue(value),
      },
      { onConflict: 'school_id,key' },
    )

  if (error) {
    throw error
  }
}

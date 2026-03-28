// Audit logging utility - persisted to database

import { supabase } from './supabase'

export interface AuditEntry {
  id: string
  school_id?: string
  user_id?: string
  user_name: string
  action: string
  module: string
  description: string
  record_id?: string
  old_value?: Record<string, unknown>
  new_value?: Record<string, unknown>
  created_at: string
}

export async function logAuditEvent(
  schoolId: string,
  userId: string,
  userName: string,
  action: 'create' | 'update' | 'delete' | 'view' | 'login' | 'logout',
  module: string,
  description: string,
  recordId?: string,
  oldValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>
) {
  const { error } = await supabase.from('audit_log').insert({
    school_id: schoolId,
    user_id: userId,
    user_name: userName,
    action,
    module,
    description,
    record_id: recordId,
    old_value: oldValue,
    new_value: newValue,
  })
  
  if (error) {
    console.error('Failed to log audit event:', error)
  }
}

export async function getAuditLog(schoolId: string, options?: {
  action?: string
  module?: string
  limit?: number
}): Promise<AuditEntry[]> {
  let query = supabase
    .from('audit_log')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })

  if (options?.action && options.action !== 'all') {
    query = query.eq('action', options.action)
  }
  
  if (options?.module && options.module !== 'all') {
    query = query.eq('module', options.module)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  } else {
    query = query.limit(100)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch audit log:', error)
    return []
  }

  return data || []
}

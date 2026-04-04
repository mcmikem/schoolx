// Audit logging utility - persisted to database

import { supabase } from './supabase'
import { buildAuditDiff } from './operations'
import { offlineDB } from './offline'

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

export async function logAuditEventWithOfflineSupport(
  online: boolean,
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
  const payload = {
    school_id: schoolId,
    user_id: userId,
    user_name: userName,
    action,
    module,
    description,
    record_id: recordId,
    old_value: oldValue,
    new_value: newValue,
    created_at: new Date().toISOString(),
  }

  if (online) {
    const { error } = await supabase.from('audit_log').insert(payload)
    if (error) {
      console.error('Failed to log audit event:', error)
    }
    return
  }

  try {
    await offlineDB.save('audit_log', payload)
  } catch (error) {
    console.error('Failed to queue audit event offline:', error)
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

export async function logRecordChange(
  schoolId: string,
  userId: string,
  userName: string,
  module: string,
  description: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  recordId?: string
) {
  const changes = buildAuditDiff(before, after)

  return logAuditEvent(
    schoolId,
    userId,
    userName,
    'update',
    module,
    `${description} (${changes.length} field${changes.length === 1 ? '' : 's'} changed)`,
    recordId,
    before,
    {
      ...after,
      _changes: changes,
    }
  )
}

export async function logRecordChangeWithOfflineSupport(
  online: boolean,
  schoolId: string,
  userId: string,
  userName: string,
  module: string,
  description: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  recordId?: string
) {
  const changes = buildAuditDiff(before, after)

  return logAuditEventWithOfflineSupport(
    online,
    schoolId,
    userId,
    userName,
    'update',
    module,
    `${description} (${changes.length} field${changes.length === 1 ? '' : 's'} changed)`,
    recordId,
    before,
    {
      ...after,
      _changes: changes,
    }
  )
}

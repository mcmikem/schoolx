// Audit logging utility - persisted to database

import { supabase } from './supabase'
import { buildAuditDiff } from './operations'
import { offlineDB } from './offline'
import { logger } from './logger'

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
  ip_address?: string
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
    logger.error('Failed to log audit event:', error)
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
      logger.error('Failed to log audit event:', error)
    }
    return
  }

  try {
    await offlineDB.save('audit_log', payload)
  } catch (error) {
    logger.error('Failed to queue audit event offline:', error)
  }
}

export async function getAuditLog(
  schoolId: string,
  options?: {
    action?: string
    module?: string
    userSearch?: string
    dateFrom?: string
    dateTo?: string
    offset?: number
    limit?: number
  },
): Promise<{ data: AuditEntry[]; total: number }> {
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  let query = supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })

  if (options?.action && options.action !== 'all') {
    query = query.eq('action', options.action)
  }

  if (options?.module && options.module !== 'all') {
    query = query.eq('module', options.module)
  }

  if (options?.userSearch) {
    query = query.ilike('user_name', `%${options.userSearch}%`)
  }

  if (options?.dateFrom) {
    query = query.gte('created_at', options.dateFrom)
  }

  if (options?.dateTo) {
    query = query.lte('created_at', options.dateTo)
  }

  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    logger.error('Failed to fetch audit log:', error)
    return { data: [], total: 0 }
  }

  return { data: data || [], total: count ?? 0 }
}

export async function getAuditSummary(schoolId: string): Promise<{
  todayCount: number
  uniqueUsers: number
  mostCommonAction: string
  actionCounts: Record<string, number>
}> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { count: todayRaw, error: todayErr } = await supabase
    .from('audit_log')
    .select('*', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .gte('created_at', today.toISOString())
  const todayCount = todayErr || todayRaw === null ? 0 : todayRaw

  const { data: recent, error: recentErr } = await supabase
    .from('audit_log')
    .select('user_name, action')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .limit(1000)

  if (recentErr) {
    return { todayCount: 0, uniqueUsers: 0, mostCommonAction: 'N/A', actionCounts: {} }
  }

  const users = new Set(recent.map((r) => r.user_name).filter(Boolean))
  const actionCounts: Record<string, number> = {}
  for (const r of recent) {
    actionCounts[r.action] = (actionCounts[r.action] || 0) + 1
  }

  const mostCommonAction = Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A'

  return {
    todayCount,
    uniqueUsers: users.size,
    mostCommonAction,
    actionCounts,
  }
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

export async function getDistinctModules(schoolId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("audit_log")
    .select("module")
    .eq("school_id", schoolId)
    .order("module")

  if (error || !data) return []
  return [...new Set(data.map((r) => r.module))]
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

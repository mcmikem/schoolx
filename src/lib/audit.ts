// Audit logging utility

export interface AuditEntry {
  id: string
  user_name: string
  action: string
  module: string
  description: string
  timestamp: string
}

// In-memory audit log (in production, this would be in database)
const auditLog: AuditEntry[] = []

export function logAuditEvent(
  userId: string,
  userName: string,
  action: 'create' | 'update' | 'delete' | 'view' | 'login' | 'logout',
  module: string,
  description: string
) {
  auditLog.unshift({
    id: crypto.randomUUID(),
    user_name: userName,
    action,
    module,
    description,
    timestamp: new Date().toISOString()
  })
  
  // Keep only last 100 entries
  if (auditLog.length > 100) {
    auditLog.pop()
  }
}

export function getAuditLog(): AuditEntry[] {
  return [...auditLog]
}

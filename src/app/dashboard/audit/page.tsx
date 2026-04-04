'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { getAuditLog, AuditEntry } from '@/lib/audit'
import MaterialIcon from '@/components/MaterialIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Select } from '@/components/ui/index'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/EmptyState'

export default function AuditLogPage() {
  const { user, school } = useAuth()
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [filterAction, setFilterAction] = useState('all')
  const [filterModule, setFilterModule] = useState('all')
  const [filterRisk, setFilterRisk] = useState<'all' | 'high'>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchLogs() {
      if (!school?.id) return
      setLoading(true)
      const data = await getAuditLog(school.id)
      setLogs(data)
      setLoading(false)
    }
    fetchLogs()
  }, [school?.id])

  const isHighRisk = (log: AuditEntry) => {
    if (log.action === 'delete') return true
    if (['fees', 'grades', 'automation', 'settings'].includes(log.module)) return true
    return /publish|lock|unlock|write-off|write off|bursary|delete|approve/i.test(log.description)
  }

  const filteredLogs = logs.filter(log => {
    if (filterAction !== 'all' && log.action !== filterAction) return false
    if (filterModule !== 'all' && log.module !== filterModule) return false
    if (filterRisk === 'high' && !isHighRisk(log)) return false
    return true
  })

  const modules = Array.from(new Set(logs.map(l => l.module)))

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader 
        title="Audit Log"
        subtitle="Track all system activities"
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <Select 
          value={filterAction} 
          onChange={(e) => setFilterAction(e.target.value)} 
          options={[
            { value: 'all', label: 'All Actions' },
            { value: 'create', label: 'Create' },
            { value: 'update', label: 'Update' },
            { value: 'delete', label: 'Delete' },
            { value: 'view', label: 'View' },
            { value: 'login', label: 'Login' },
          ]}
          className="sm:w-40"
        />
        <Select 
          value={filterModule} 
          onChange={(e) => setFilterModule(e.target.value)} 
          options={[
            { value: 'all', label: 'All Modules' },
            ...modules.map(m => ({ value: m, label: m }))
          ]}
          className="sm:w-40"
        />
        <Select
          value={filterRisk}
          onChange={(e) => setFilterRisk(e.target.value as 'all' | 'high')}
          options={[
            { value: 'all', label: 'All Risk Levels' },
            { value: 'high', label: 'High Risk Only' },
          ]}
          className="sm:w-44"
        />
      </div>

      {loading ? (
        <TableSkeleton rows={5} />
      ) : filteredLogs.length === 0 ? (
        <EmptyState 
          icon="description"
          title="No activity recorded"
          description="Activities will appear here as users interact with the system"
        />
      ) : (
        <Card>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--surface-container-low)]">
                  <tr>
                    <th className="text-left p-3 text-sm font-semibold text-[var(--t1)]">Time</th>
                    <th className="text-left p-3 text-sm font-semibold text-[var(--t1)]">User</th>
                    <th className="text-left p-3 text-sm font-semibold text-[var(--t1)]">Action</th>
                    <th className="text-left p-3 text-sm font-semibold text-[var(--t1)]">Module</th>
                    <th className="text-left p-3 text-sm font-semibold text-[var(--t1)]">Description</th>
                    <th className="text-left p-3 text-sm font-semibold text-[var(--t1)]">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="border-t border-[var(--border)]">
                      <td className="p-3 text-[var(--t3)] whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="p-3 font-medium text-[var(--t1)]">{log.user_name}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          log.action === 'create' ? 'bg-[var(--green-soft)] text-[var(--green)]' :
                          log.action === 'update' ? 'bg-[var(--navy-soft)] text-[var(--navy)]' :
                          log.action === 'delete' ? 'bg-[var(--red-soft)] text-[var(--red)]' :
                          'bg-[var(--surface-container)] text-[var(--t3)]'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 text-[var(--t3)]">{log.module}</td>
                      <td className="p-3 text-[var(--t3)]">{log.description}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          isHighRisk(log) ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {isHighRisk(log) ? 'High' : 'Standard'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      <Card className="max-w-2xl">
        <CardBody>
          <h2 className="font-semibold text-[var(--t1)] mb-4">About Audit Log</h2>
          <ul className="space-y-2 text-sm text-[var(--t3)]">
            <li>Audit log tracks all important actions in the system</li>
            <li>Activities include: creating, updating, deleting, and viewing records</li>
            <li>Useful for accountability and tracking changes</li>
            <li>Log entries are kept for the current session</li>
          </ul>
        </CardBody>
      </Card>
    </div>
  )
}

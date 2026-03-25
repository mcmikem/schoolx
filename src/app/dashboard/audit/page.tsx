'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { getAuditLog, AuditEntry } from '@/lib/audit'

export default function AuditLogPage() {
  const { user } = useAuth()
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [filterAction, setFilterAction] = useState('all')
  const [filterModule, setFilterModule] = useState('all')

  useEffect(() => {
    // Load audit logs
    setLogs(getAuditLog())
  }, [])

  const filteredLogs = logs.filter(log => {
    if (filterAction !== 'all' && log.action !== filterAction) return false
    if (filterModule !== 'all' && log.module !== filterModule) return false
    return true
  })

  const modules = Array.from(new Set(logs.map(l => l.module)))

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Log</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Track all system activities</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="input sm:w-40">
          <option value="all">All Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
          <option value="view">View</option>
          <option value="login">Login</option>
        </select>
        <select value={filterModule} onChange={(e) => setFilterModule(e.target.value)} className="input sm:w-40">
          <option value="all">All Modules</option>
          {modules.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Log List */}
      {filteredLogs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No activity recorded</h3>
          <p className="text-gray-500 dark:text-gray-400">Activities will appear here as users interact with the system</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Module</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td className="text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="font-medium text-gray-900 dark:text-white">{log.user_name}</td>
                  <td>
                    <span className={`badge ${
                      log.action === 'create' ? 'badge-success' :
                      log.action === 'update' ? 'badge-info' :
                      log.action === 'delete' ? 'badge-danger' :
                      'badge-neutral'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="text-gray-600 dark:text-gray-400">{log.module}</td>
                  <td className="text-gray-600 dark:text-gray-400">{log.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Info */}
      <div className="card mt-6 max-w-2xl">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">About Audit Log</h2>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li>Audit log tracks all important actions in the system</li>
          <li>Activities include: creating, updating, deleting, and viewing records</li>
          <li>Useful for accountability and tracking changes</li>
          <li>Log entries are kept for the current session</li>
        </ul>
      </div>
    </div>
  )
}

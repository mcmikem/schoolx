'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui'
import { useSyncStatus } from '@/lib/useSyncStatus'
import { offlineDB } from '@/lib/offline'

interface QueueItem {
  id?: string
  table: string
  action: string
  data: Record<string, unknown>
  attempts?: number
  timestamp?: number
}

export default function SyncCenterPage() {
  const { isOnline, pendingCount, isSyncing, lastSynced, syncErrors, syncNow, refreshAll, checkPending } = useSyncStatus()
  const [pendingItems, setPendingItems] = useState<QueueItem[]>([])
  const [failedItems, setFailedItems] = useState<QueueItem[]>([])

  useEffect(() => {
    async function loadQueue() {
      const [pending, failed] = await Promise.all([
        offlineDB.getPendingSync(),
        offlineDB.getFailedSync(),
      ])
      setPendingItems(pending as QueueItem[])
      setFailedItems(failed as QueueItem[])
    }

    loadQueue()
  }, [pendingCount, isSyncing, lastSynced])

  const handleSyncNow = async () => {
    await syncNow()
    await checkPending()
    const [pending, failed] = await Promise.all([offlineDB.getPendingSync(), offlineDB.getFailedSync()])
    setPendingItems(pending as QueueItem[])
    setFailedItems(failed as QueueItem[])
  }

  const handleRefresh = async () => {
    await refreshAll()
    await checkPending()
    const [pending, failed] = await Promise.all([offlineDB.getPendingSync(), offlineDB.getFailedSync()])
    setPendingItems(pending as QueueItem[])
    setFailedItems(failed as QueueItem[])
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader
        title="Sync Center"
        subtitle={isOnline ? 'Review queued offline work and push it safely to the server.' : 'Offline mode is active. New records will queue here until connectivity returns.'}
        actions={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleRefresh} disabled={isSyncing}>
              Refresh Cache
            </Button>
            <Button onClick={handleSyncNow} disabled={!isOnline || isSyncing}>
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardBody><div className="text-sm text-[var(--t3)]">Connection</div><div className="mt-2 text-2xl font-semibold text-[var(--t1)]">{isOnline ? 'Online' : 'Offline'}</div></CardBody></Card>
        <Card><CardBody><div className="text-sm text-[var(--t3)]">Queued Records</div><div className="mt-2 text-2xl font-semibold text-[var(--t1)]">{pendingCount}</div></CardBody></Card>
        <Card><CardBody><div className="text-sm text-[var(--t3)]">Last Sync</div><div className="mt-2 text-sm font-semibold text-[var(--t1)]">{lastSynced ? lastSynced.toLocaleString() : 'Never synced'}</div></CardBody></Card>
      </div>

      {syncErrors.length > 0 && (
        <Card>
          <CardBody className="space-y-2">
            <div className="font-semibold text-red-700">Recent Sync Errors</div>
            {syncErrors.map((error, index) => (
              <div key={`${error}-${index}`} className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--t1)]">Pending Queue</h2>
            <span className="text-sm text-[var(--t3)]">{pendingItems.length} item(s)</span>
          </div>
          {pendingItems.length === 0 ? (
            <div className="text-sm text-[var(--t3)]">No pending offline records.</div>
          ) : (
            <div className="space-y-3">
              {pendingItems.map((item, index) => (
                <div key={`${item.table}-${String(item.id)}-${index}`} className="rounded-2xl border border-[var(--border)] p-4">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">{item.table}</span>
                    <span className="rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-700">{item.action}</span>
                    <span className="text-[var(--t3)]">Attempts: {item.attempts || 0}</span>
                    <span className="text-[var(--t3)]">{item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Queued'}</span>
                  </div>
                  <div className="mt-3 text-xs text-[var(--t3)] break-all">
                    Record: {String(item.data?.id || item.data?.student_id || 'Unknown')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--t1)]">Failed Queue</h2>
            <span className="text-sm text-[var(--t3)]">{failedItems.length} item(s)</span>
          </div>
          {failedItems.length === 0 ? (
            <div className="text-sm text-[var(--t3)]">No failed items have reached the retry limit.</div>
          ) : (
            <div className="space-y-3">
              {failedItems.map((item, index) => (
                <div key={`${item.table}-${String(item.id)}-${index}`} className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="rounded-full bg-red-100 px-3 py-1 font-medium text-red-700">{item.table}</span>
                    <span className="text-red-700">Exceeded retry limit</span>
                    <span className="text-red-700">Attempts: {item.attempts || 0}</span>
                  </div>
                  <div className="mt-3 text-xs text-red-700 break-all">
                    Record: {String(item.data?.id || item.data?.student_id || 'Unknown')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="text-sm text-[var(--t3)]">
          If a record remains failed, correct the underlying data issue, reconnect, then use <Link href="/dashboard" className="font-semibold text-[var(--navy)]">Sync Now</Link> here again.
        </CardBody>
      </Card>
    </div>
  )
}

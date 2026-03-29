'use client'
import { useState, useEffect, useCallback } from 'react'
import { offlineDB } from './offline'

interface SyncStatus {
  isOnline: boolean
  pendingCount: number
  isSyncing: boolean
  lastSynced: Date | null
  lastSyncedPerTable: Record<string, Date>
  isFromCache: boolean
  syncErrors: string[]
}

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: true,
    pendingCount: 0,
    isSyncing: false,
    lastSynced: null,
    lastSyncedPerTable: {},
    isFromCache: false,
    syncErrors: []
  })

  const checkPending = useCallback(async () => {
    try {
      const pending = await offlineDB.getPendingSync()
      const allSynced = await offlineDB.getAllLastSynced()

      const perTable: Record<string, Date> = {}
      for (const [table, ts] of Object.entries(allSynced)) {
        perTable[table] = new Date(ts)
      }

      // Global last synced = most recent table sync
      const timestamps = Object.values(allSynced)
      const latestGlobal = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null

      setStatus(prev => ({
        ...prev,
        pendingCount: pending.length,
        lastSynced: latestGlobal,
        lastSyncedPerTable: perTable
      }))
    } catch (e) {
      console.error('Error checking pending:', e)
    }
  }, [])

  const syncNow = useCallback(async () => {
    if (!status.isOnline || status.isSyncing) return

    setStatus(prev => ({ ...prev, isSyncing: true, syncErrors: [] }))
    try {
      const result = await offlineDB.syncToServer()
      await checkPending()
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSynced: result.failed === 0 ? new Date() : prev.lastSynced,
        syncErrors: result.errors
      }))
      return result
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sync failed'
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        syncErrors: [...prev.syncErrors, msg]
      }))
      throw e
    }
  }, [status.isOnline, status.isSyncing, checkPending])

  const refreshAll = useCallback(async (tables?: string[]) => {
    const tablesToSync = tables || [
      'students', 'classes', 'subjects', 'attendance', 'grades',
      'fee_payments', 'fee_structure', 'messages', 'events', 'timetable'
    ]

    setStatus(prev => ({ ...prev, isSyncing: true, syncErrors: [] }))
    try {
      const result = await offlineDB.refreshAll(tablesToSync)
      await checkPending()
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSynced: new Date(),
        syncErrors: result.errors
      }))
      return result
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Refresh failed'
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        syncErrors: [...prev.syncErrors, msg]
      }))
      throw e
    }
  }, [checkPending])

  const setIsFromCache = useCallback((value: boolean) => {
    setStatus(prev => ({ ...prev, isFromCache: value }))
  }, [])

  useEffect(() => {
    const handleOnline = () => setStatus(prev => ({ ...prev, isOnline: true }))
    const handleOffline = () => setStatus(prev => ({ ...prev, isOnline: false }))

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    setStatus(prev => ({ ...prev, isOnline: navigator.onLine }))

    checkPending()

    const interval = setInterval(checkPending, 30000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [checkPending])

  return {
    ...status,
    syncNow,
    checkPending,
    refreshAll,
    setIsFromCache
  }
}

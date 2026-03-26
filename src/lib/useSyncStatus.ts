'use client'
import { useState, useEffect, useCallback } from 'react'
import { offlineDB } from './offline'

interface SyncStatus {
  isOnline: boolean
  pendingCount: number
  isSyncing: boolean
  lastSynced: Date | null
}

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: true,
    pendingCount: 0,
    isSyncing: false,
    lastSynced: null
  })

  const checkPending = useCallback(async () => {
    try {
      const pending = await offlineDB.getPendingSync()
      setStatus(prev => ({ ...prev, pendingCount: pending.length }))
    } catch (e) {
      console.error('Error checking pending:', e)
    }
  }, [])

  const syncNow = useCallback(async () => {
    if (!status.isOnline || status.isSyncing) return

    setStatus(prev => ({ ...prev, isSyncing: true }))
    try {
      const result = await offlineDB.syncToServer('/api/sync')
      await checkPending()
      setStatus(prev => ({ 
        ...prev, 
        isSyncing: false, 
        lastSynced: result.failed === 0 ? new Date() : prev.lastSynced 
      }))
      return result
    } catch (e) {
      setStatus(prev => ({ ...prev, isSyncing: false }))
      throw e
    }
  }, [status.isOnline, status.isSyncing, checkPending])

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

  return { ...status, syncNow, checkPending }
}

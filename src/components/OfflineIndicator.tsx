'use client'
import { useState, useEffect } from 'react'
import { offlineDB } from '@/lib/offline'

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingSync, setPendingSync] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [showIndicator, setShowIndicator] = useState(false)

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true)
      setShowIndicator(true)
      // Auto-sync when back online
      await syncData()
      setTimeout(() => setShowIndicator(false), 3000)
    }
    
    const handleOffline = () => {
      setIsOnline(false)
      setShowIndicator(true)
    }

    // Check pending sync count
    const checkPending = async () => {
      try {
        const pending = await offlineDB.getPendingSync()
        setPendingSync(pending.length)
      } catch {
        // Ignore errors
      }
    }
    
    checkPending()
    const interval = setInterval(checkPending, 10000)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [])

  const syncData = async () => {
    if (!navigator.onLine) return
    setSyncing(true)
    try {
      const result = await offlineDB.syncToServer('/api/sync')
      if (result.success > 0) {
        console.log(`Synced ${result.success} records`)
      }
    } catch (e) {
      console.error('Sync failed:', e)
    }
    setSyncing(false)
  }

  if (!showIndicator && isOnline && pendingSync === 0) return null

  return (
    <div className={`offline-indicator ${isOnline ? 'online' : 'offline'}`}
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99999,
        padding: '10px 20px',
        borderRadius: 25,
        fontSize: 13,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        background: isOnline ? '#22c55e' : '#ef4444',
        color: '#fff',
      }}
    >
      {syncing ? (
        <>
          <span style={{ animation: 'spin 1s linear infinite' }}>⟳</span>
          Syncing...
        </>
      ) : !isOnline ? (
        <>
          <span>📴</span>
          Offline Mode - Changes saved locally
          {pendingSync > 0 && <span style={{ opacity: 0.8 }}>({pendingSync} pending)</span>}
        </>
      ) : pendingSync > 0 ? (
        <>
          <span>📶</span>
          {pendingSync} changes pending sync
        </>
      ) : (
        <>
          <span>✓</span>
          Back online
        </>
      )}
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0)
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    const check = async () => {
      try {
        const pending = await offlineDB.getPendingSync()
        setPendingCount(pending.length)
      } catch {}
    }
    
    check()
    const interval = setInterval(check, 5000)
    
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    setIsOnline(navigator.onLine)

    return () => {
      clearInterval(interval)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const sync = async () => {
    if (!navigator.onLine) return { success: 0, failed: 0 }
    return await offlineDB.syncToServer('/api/sync')
  }

  return { pendingCount, isOnline, sync }
}

// Offline-first database using IndexedDB
// This allows the app to work without internet connection

import { useState, useEffect } from 'react'

const DB_NAME = 'omuto-sms-db'
const DB_VERSION = 4

interface OfflineRecord {
  id?: string
  table: string
  data: Record<string, unknown>
  action: 'create' | 'update' | 'delete'
  timestamp: number
  synced: boolean
  attempts: number
}

const MAX_RETRY_ATTEMPTS = 3

class OfflineDB {
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null

  async init(): Promise<void> {
    if (this.db) return
    if (this.initPromise) return this.initPromise

    this.initPromise = new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        this.initPromise = null
        reject(request.error)
      }
      request.onsuccess = () => {
        this.db = request.result
        this.initPromise = null
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        const stores = [
          'students',
          'classes',
          'subjects',
          'attendance',
          'grades',
          'fee_payments',
          'fee_structure',
          'fee_adjustments',
          'messages',
          'events',
          'timetable',
          'users',
          'audit_log',
          'sync_queue',
          'sync_metadata'
        ]

        stores.forEach((storeName) => {
          if (!db.objectStoreNames.contains(storeName)) {
            if (storeName === 'sync_metadata') {
              const store = db.createObjectStore(storeName, { keyPath: 'table' })
              store.createIndex('table', 'table', { unique: true })
            } else {
              const store = db.createObjectStore(storeName, { keyPath: 'id' })
              store.createIndex('school_id', 'school_id', { unique: false })
              store.createIndex('created_at', 'created_at', { unique: false })

              if (storeName === 'attendance') {
                store.createIndex('student_id', 'student_id', { unique: false })
                store.createIndex('date', 'date', { unique: false })
                store.createIndex('class_id', 'class_id', { unique: false })
              }

              if (storeName === 'grades') {
                store.createIndex('student_id', 'student_id', { unique: false })
                store.createIndex('subject_id', 'subject_id', { unique: false })
                store.createIndex('class_id', 'class_id', { unique: false })
              }

              if (storeName === 'fee_payments') {
                store.createIndex('student_id', 'student_id', { unique: false })
              }
            }
          }
        })
      }
    })

    return this.initPromise
  }

  private async ensureDb(): Promise<IDBDatabase> {
    if (!this.db) await this.init()
    return this.db!
  }

  // Save data locally and queue for sync
  async save(table: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const db = await this.ensureDb()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([table, 'sync_queue'], 'readwrite')
      const store = transaction.objectStore(table)
      const syncStore = transaction.objectStore('sync_queue')

      const record = {
        ...data,
        id: data.id || crypto.randomUUID(),
        updated_at: new Date().toISOString()
      }

      store.put(record)

      syncStore.add({
        table,
        data: record,
        action: data.id ? 'update' : 'create',
        timestamp: Date.now(),
        synced: false,
        attempts: 0
      })

      transaction.oncomplete = () => resolve(record)
      transaction.onerror = () => reject(transaction.error)
    })
  }

  // Get a single record from local storage
  async get(table: string, id: string): Promise<Record<string, unknown> | null> {
    const db = await this.ensureDb()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([table], 'readonly')
      const store = transaction.objectStore(table)
      const request = store.get(id)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  // Get all data from a table with optional filters
  async getAll(table: string, filters?: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    const db = await this.ensureDb()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([table], 'readonly')
      const store = transaction.objectStore(table)
      const request = store.getAll()

      request.onsuccess = () => {
        let results = request.result || []

        if (filters) {
          results = results.filter((item) => {
            return Object.entries(filters).every(([key, value]) => item[key] === value)
          })
        }

        resolve(results)
      }
      request.onerror = () => reject(request.error)
    })
  }

  // Delete data locally and queue for sync
  async delete(table: string, id: string): Promise<void> {
    const db = await this.ensureDb()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([table, 'sync_queue'], 'readwrite')
      const store = transaction.objectStore(table)
      const syncStore = transaction.objectStore('sync_queue')

      store.delete(id)

      syncStore.add({
        table,
        data: { id },
        action: 'delete',
        timestamp: Date.now(),
        synced: false,
        attempts: 0
      })

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  // Store data fetched from server into cache
  async cacheFromServer(table: string, data: Record<string, unknown>[]): Promise<void> {
    const db = await this.ensureDb()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([table, 'sync_metadata'], 'readwrite')
      const store = transaction.objectStore(table)
      const metaStore = transaction.objectStore('sync_metadata')

      data.forEach((item) => {
        if (item.id) {
          store.put(item)
        }
      })

      metaStore.put({
        table,
        last_synced: Date.now(),
        record_count: data.length
      })

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  // Get all cached data from a table (alias for getAll, for clarity)
  async getAllFromCache(table: string, filters?: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    return this.getAll(table, filters)
  }

  // Get the age of cached data in milliseconds
  async getCacheAge(table: string): Promise<number | null> {
    const db = await this.ensureDb()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['sync_metadata'], 'readonly')
      const store = transaction.objectStore('sync_metadata')
      const request = store.get(table)

      request.onsuccess = () => {
        const meta = request.result
        if (!meta || !meta.last_synced) {
          resolve(null)
        } else {
          resolve(Date.now() - meta.last_synced)
        }
      }
      request.onerror = () => reject(request.error)
    })
  }

  // Get last synced timestamp for a table
  async getLastSynced(table: string): Promise<number | null> {
    const db = await this.ensureDb()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['sync_metadata'], 'readonly')
      const store = transaction.objectStore('sync_metadata')
      const request = store.get(table)

      request.onsuccess = () => {
        const meta = request.result
        resolve(meta?.last_synced || null)
      }
      request.onerror = () => reject(request.error)
    })
  }

  // Get last synced timestamps for all tables
  async getAllLastSynced(): Promise<Record<string, number>> {
    const db = await this.ensureDb()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['sync_metadata'], 'readonly')
      const store = transaction.objectStore('sync_metadata')
      const request = store.getAll()

      request.onsuccess = () => {
        const result: Record<string, number> = {}
        for (const meta of request.result || []) {
          if (meta.last_synced) {
            result[meta.table] = meta.last_synced
          }
        }
        resolve(result)
      }
      request.onerror = () => reject(request.error)
    })
  }

  // Get pending sync items
  async getPendingSync(): Promise<OfflineRecord[]> {
    const db = await this.ensureDb()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['sync_queue'], 'readonly')
      const store = transaction.objectStore('sync_queue')
      const request = store.getAll()

      request.onsuccess = () => {
        const items = (request.result || []).filter(
          (item) => !item.synced && item.attempts < MAX_RETRY_ATTEMPTS
        )
        resolve(items)
      }
      request.onerror = () => reject(request.error)
    })
  }

  // Mark item as synced
  async markSynced(id: number): Promise<void> {
    const db = await this.ensureDb()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['sync_queue'], 'readwrite')
      const store = transaction.objectStore('sync_queue')
      const request = store.get(id)

      request.onsuccess = () => {
        const item = request.result
        if (item) {
          item.synced = true
          store.put(item)
        }
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  // Increment retry attempts for a sync item
  async incrementAttempts(id: number): Promise<void> {
    const db = await this.ensureDb()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['sync_queue'], 'readwrite')
      const store = transaction.objectStore('sync_queue')
      const request = store.get(id)

      request.onsuccess = () => {
        const item = request.result
        if (item) {
          item.attempts = (item.attempts || 0) + 1
          store.put(item)
        }
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  // Remove a sync queue item
  async removeSyncItem(id: number): Promise<void> {
    const db = await this.ensureDb()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['sync_queue'], 'readwrite')
      const store = transaction.objectStore('sync_queue')
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // Clear sync queue
  async clearSyncQueue(): Promise<void> {
    const db = await this.ensureDb()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['sync_queue'], 'readwrite')
      const store = transaction.objectStore('sync_queue')
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // Check if online
  isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true
  }

  // Sync a single item to server
  private async syncSingleItem(item: OfflineRecord): Promise<boolean> {
    try {
      const { supabase } = await import('@/lib/supabase')

      if (item.action === 'delete') {
        const { error } = await supabase
          .from(item.table)
          .delete()
          .eq('id', (item.data as Record<string, unknown>).id as string)
        if (error) throw error
      } else if (item.table === 'attendance') {
        const { error } = await supabase
          .from('attendance')
          .upsert(item.data, { onConflict: 'student_id,date' })
        if (error) throw error
      } else if (item.table === 'grades') {
        const { error } = await supabase
          .from('grades')
          .upsert(item.data, { onConflict: 'student_id,subject_id,assessment_type,term,academic_year' })
        if (error) throw error
      } else if (item.action === 'update') {
        const { id, ...updateData } = item.data as Record<string, unknown> & { id: string }
        const { error } = await supabase
          .from(item.table)
          .update(updateData)
          .eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from(item.table)
          .insert(item.data)
        if (error) throw error
      }
      return true
    } catch {
      return false
    }
  }

  // Sync all pending data to server with retry logic
  // apiUrl parameter is accepted for backward compatibility but unused (uses supabase directly)
  async syncToServer(_apiUrl?: string): Promise<{ success: number; failed: number; errors: string[] }> {
    const pending = await this.getPendingSync()
    let success = 0
    let failed = 0
    const errors: string[] = []

    for (const item of pending) {
      const itemId = item.id as unknown as number
      const ok = await this.syncSingleItem(item)

      if (ok) {
        await this.markSynced(itemId)
        success++
      } else {
        await this.incrementAttempts(itemId)
        const newAttempts = (item.attempts || 0) + 1
        if (newAttempts >= MAX_RETRY_ATTEMPTS) {
          errors.push(`Failed to sync ${item.table} (id: ${item.data?.id}) after ${MAX_RETRY_ATTEMPTS} attempts`)
        }
        failed++
      }
    }

    return { success, failed, errors }
  }

  // Bulk sync: sync all pending, then re-fetch cache from server for given tables
  async refreshAll(tables: string[]): Promise<{ synced: number; errors: string[] }> {
    const errors: string[] = []

    // First push local changes
    const syncResult = await this.syncToServer()
    errors.push(...syncResult.errors)

    // Then pull fresh data from server into cache
    try {
      const { supabase } = await import('@/lib/supabase')
      for (const table of tables) {
        try {
          const { data, error } = await supabase.from(table).select('*')
          if (error) throw error
          if (data) {
            await this.cacheFromServer(table, data as Record<string, unknown>[])
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : `Failed to refresh ${table}`
          errors.push(msg)
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to import supabase'
      errors.push(msg)
    }

    return { synced: syncResult.success, errors }
  }

  // Conflict resolution: server data wins, overwrite local cache
  async resolveConflicts(table: string, serverData: Record<string, unknown>[]): Promise<void> {
    await this.cacheFromServer(table, serverData)
  }
}

// Singleton instance
export const offlineDB = new OfflineDB()

// React hook for offline status
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

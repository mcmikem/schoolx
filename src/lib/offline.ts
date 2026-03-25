// Offline-first database using IndexedDB
// This allows the app to work without internet connection

const DB_NAME = 'omuto-sms-db'
const DB_VERSION = 1

interface OfflineRecord {
  id?: string
  table: string
  data: Record<string, unknown>
  action: 'create' | 'update' | 'delete'
  timestamp: number
  synced: boolean
}

class OfflineDB {
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create object stores for each table
        const stores = [
          'students',
          'classes',
          'subjects',
          'attendance',
          'grades',
          'fee_payments',
          'fee_structure',
          'messages',
          'events',
          'timetable',
          'users',
          'sync_queue'
        ]

        stores.forEach((storeName) => {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: 'id' })
            store.createIndex('school_id', 'school_id', { unique: false })
            store.createIndex('created_at', 'created_at', { unique: false })
            
            if (storeName === 'attendance') {
              store.createIndex('student_id', 'student_id', { unique: false })
              store.createIndex('date', 'date', { unique: false })
            }
            
            if (storeName === 'grades') {
              store.createIndex('student_id', 'student_id', { unique: false })
              store.createIndex('subject_id', 'subject_id', { unique: false })
            }
            
            if (storeName === 'fee_payments') {
              store.createIndex('student_id', 'student_id', { unique: false })
            }
          }
        })

        // Sync queue for offline changes
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true })
        }
      }
    })
  }

  // Save data locally
  async save(table: string, data: Record<string, unknown>): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([table, 'sync_queue'], 'readwrite')
      const store = transaction.objectStore(table)
      const syncStore = transaction.objectStore('sync_queue')

      const record = {
        ...data,
        id: data.id || crypto.randomUUID(),
        updated_at: new Date().toISOString()
      }

      store.put(record)

      // Add to sync queue
      syncStore.add({
        table,
        data: record,
        action: data.id ? 'update' : 'create',
        timestamp: Date.now(),
        synced: false
      })

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  // Get data from local storage
  async get(table: string, id: string): Promise<Record<string, unknown> | null> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([table], 'readonly')
      const store = transaction.objectStore(table)
      const request = store.get(id)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  // Get all data from a table
  async getAll(table: string, filters?: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([table], 'readonly')
      const store = transaction.objectStore(table)
      const request = store.getAll()

      request.onsuccess = () => {
        let results = request.result || []
        
        // Apply filters
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

  // Delete data locally
  async delete(table: string, id: string): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([table, 'sync_queue'], 'readwrite')
      const store = transaction.objectStore(table)
      const syncStore = transaction.objectStore('sync_queue')

      store.delete(id)

      // Add delete to sync queue
      syncStore.add({
        table,
        data: { id },
        action: 'delete',
        timestamp: Date.now(),
        synced: false
      })

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  // Get pending sync items
  async getPendingSync(): Promise<OfflineRecord[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sync_queue'], 'readonly')
      const store = transaction.objectStore('sync_queue')
      const request = store.getAll()

      request.onsuccess = () => {
        const items = (request.result || []).filter((item) => !item.synced)
        resolve(items)
      }
      request.onerror = () => reject(request.error)
    })
  }

  // Mark item as synced
  async markSynced(id: number): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sync_queue'], 'readwrite')
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

  // Clear sync queue
  async clearSyncQueue(): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sync_queue'], 'readwrite')
      const store = transaction.objectStore('sync_queue')
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // Check if online
  isOnline(): boolean {
    return navigator.onLine
  }

  // Sync pending data when online
  async syncToServer(apiUrl: string): Promise<{ success: number; failed: number }> {
    const pending = await this.getPendingSync()
    let success = 0
    let failed = 0

    for (const item of pending) {
      try {
        const itemId = item.id as unknown as number
        const response = await fetch(`${apiUrl}/${item.table}`, {
          method: item.action === 'delete' ? 'DELETE' : item.action === 'update' ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.data)
        })

        if (response.ok) {
          await this.markSynced(itemId)
          success++
        } else {
          failed++
        }
      } catch {
        failed++
      }
    }

    return { success, failed }
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

import { useState, useEffect } from 'react'

// Offline-first IndexedDB storage for rural Uganda
// Stores data locally and syncs when online

const DB_NAME = 'omuto.org_offline'
const DB_VERSION = 1

interface OfflineRecord {
  id: string
  table: string
  data: any
  action: 'insert' | 'update' | 'delete'
  timestamp: number
  synced: boolean
}

let db: IDBDatabase | null = null

export function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result

      // Pending sync queue
      if (!database.objectStoreNames.contains('sync_queue')) {
        const store = database.createObjectStore('sync_queue', { keyPath: 'id' })
        store.createIndex('table', 'table', { unique: false })
        store.createIndex('synced', 'synced', { unique: false })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }

      // Cached data stores
      const cachedTables = [
        'students', 'attendance', 'grades', 'classes', 'fee_payments',
        'staff_salaries', 'salary_payments', 'assets', 'inventory_transactions',
        'timetable_slots', 'teacher_timetable', 'dorm_rooms', 'transport_routes'
      ]
      cachedTables.forEach((tableName) => {
        if (!database.objectStoreNames.contains(tableName)) {
          database.createObjectStore(tableName, { keyPath: 'id' })
        }
      })

      // Settings store
      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'key' })
      }
    }
  })
}

// Add to sync queue
export async function addToSyncQueue(
  table: string,
  data: any,
  action: 'insert' | 'update' | 'delete'
): Promise<void> {
  const database = await getDB()
  const record: OfflineRecord = {
    id: `${table}_${data.id || Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    table,
    data,
    action,
    timestamp: Date.now(),
    synced: false,
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['sync_queue'], 'readwrite')
    const store = transaction.objectStore('sync_queue')
    const request = store.add(record)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// Get pending sync items
export async function getPendingSync(): Promise<OfflineRecord[]> {
  const database = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['sync_queue'], 'readonly')
    const store = transaction.objectStore('sync_queue')
    const request = store.getAll()
    request.onsuccess = () => {
      const all = request.result || []
      const pending = all.filter((item: OfflineRecord) => !item.synced)
      resolve(pending)
    }
    request.onerror = () => reject(request.error)
  })
}

// Mark as synced
export async function markSynced(id: string): Promise<void> {
  const database = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['sync_queue'], 'readwrite')
    const store = transaction.objectStore('sync_queue')
    const getRequest = store.get(id)
    getRequest.onsuccess = () => {
      const record = getRequest.result
      if (record) {
        record.synced = true
        const putRequest = store.put(record)
        putRequest.onsuccess = () => resolve()
        putRequest.onerror = () => reject(putRequest.error)
      } else {
        resolve()
      }
    }
    getRequest.onerror = () => reject(getRequest.error)
  })
}

// Cache data locally
export async function cacheData(table: string, data: any[]): Promise<void> {
  const database = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([table], 'readwrite')
    const store = transaction.objectStore(table)

    data.forEach((item) => {
      store.put(item)
    })

    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

// Get cached data
export async function getCachedData(table: string): Promise<any[]> {
  const database = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([table], 'readonly')
    const store = transaction.objectStore(table)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

// Save setting
export async function saveSetting(key: string, value: any): Promise<void> {
  const database = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['settings'], 'readwrite')
    const store = transaction.objectStore('settings')
    const request = store.put({ key, value, updated_at: Date.now() })
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// Get setting
export async function getSetting(key: string): Promise<any> {
  const database = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['settings'], 'readonly')
    const store = transaction.objectStore('settings')
    const request = store.get(key)
    request.onsuccess = () => resolve(request.result?.value)
    request.onerror = () => reject(request.error)
  })
}

// Check if online
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

// Sync with Supabase when online
export async function syncWithServer(supabase: any): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingSync()
  let synced = 0
  let failed = 0

  for (const item of pending) {
    try {
      if (item.action === 'insert') {
        await supabase.from(item.table).insert(item.data)
      } else if (item.action === 'update') {
        await supabase.from(item.table).update(item.data).eq('id', item.data.id)
      } else if (item.action === 'delete') {
        await supabase.from(item.table).delete().eq('id', item.data.id)
      }
      await markSynced(item.id)
      synced++
    } catch (error) {
      failed++
      console.error(`Failed to sync ${item.table}:`, error)
    }
  }

  return { synced, failed }
}

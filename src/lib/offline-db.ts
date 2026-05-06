import { logger } from "@/lib/logger";

const DB_NAME = "skoolmate-offline";
const DB_VERSION = 1;

const STORES = {
  CACHE: "api-cache",
  MUTATIONS: "pending-mutations",
  SESSION: "session",
} as const;

let db: IDBDatabase | null = null;

async function openDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      if (!database.objectStoreNames.contains(STORES.CACHE)) {
        const cacheStore = database.createObjectStore(STORES.CACHE, { keyPath: "key" });
        cacheStore.createIndex("timestamp", "timestamp", { unique: false });
      }

      if (!database.objectStoreNames.contains(STORES.MUTATIONS)) {
        const mutationStore = database.createObjectStore(STORES.MUTATIONS, { keyPath: "id", autoIncrement: true });
        mutationStore.createIndex("timestamp", "timestamp", { unique: false });
        mutationStore.createIndex("synced", "synced", { unique: false });
      }

      if (!database.objectStoreNames.contains(STORES.SESSION)) {
        database.createObjectStore(STORES.SESSION, { keyPath: "key" });
      }
    };
  });
}

export function generateCacheKey(endpoint: string, params?: Record<string, unknown>): string {
  const url = new URL(endpoint, typeof window !== "undefined" ? window.location.origin : "");
  if (params) {
    Object.entries(params).sort().forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

export async function cacheResponse(
  endpoint: string,
  data: unknown,
  params?: Record<string, unknown>,
  ttl = 5 * 60 * 1000
): Promise<void> {
  try {
    const database = await openDB();
    const key = generateCacheKey(endpoint, params);
    const transaction = database.transaction(STORES.CACHE, "readwrite");
    const store = transaction.objectStore(STORES.CACHE);

    await new Promise((resolve, reject) => {
      const request = store.put({
        key,
        endpoint,
        params,
        data,
        timestamp: Date.now(),
        expiry: Date.now() + ttl,
      });
      request.onsuccess = () => resolve(undefined);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    logger.error("Failed to cache response:", err);
  }
}

export async function getCachedResponse<T>(endpoint: string, params?: Record<string, unknown>): Promise<T | null> {
  try {
    const database = await openDB();
    const key = generateCacheKey(endpoint, params);
    const transaction = database.transaction(STORES.CACHE, "readonly");
    const store = transaction.objectStore(STORES.CACHE);

    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(null);
          return;
        }
        if (result.expiry && result.expiry < Date.now()) {
          store.delete(key);
          resolve(null);
          return;
        }
        resolve(result.data as T);
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

export async function clearCache(): Promise<void> {
  try {
    const database = await openDB();
    const transaction = database.transaction(STORES.CACHE, "readwrite");
    const store = transaction.objectStore(STORES.CACHE);
    store.clear();
  } catch (err) {
    logger.error("Failed to clear cache:", err);
  }
}

export interface PendingMutation {
  id?: number;
  endpoint: string;
  method: string;
  body: unknown;
  timestamp: number;
  synced: boolean;
}

export async function queueMutation(mutation: Omit<PendingMutation, "id" | "timestamp" | "synced">): Promise<number> {
  const database = await openDB();
  const transaction = database.transaction(STORES.MUTATIONS, "readwrite");
  const store = transaction.objectStore(STORES.MUTATIONS);

  return new Promise((resolve, reject) => {
    const request = store.add({
      ...mutation,
      timestamp: Date.now(),
      synced: false,
    });
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingMutations(): Promise<PendingMutation[]> {
  const database = await openDB();
  const transaction = database.transaction(STORES.MUTATIONS, "readonly");
  const store = transaction.objectStore(STORES.MUTATIONS);
  const index = store.index("synced");

  return new Promise((resolve, reject) => {
    const request = index.getAll(IDBKeyRange.only(false));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function markMutationSynced(id: number): Promise<void> {
  const database = await openDB();
  const transaction = database.transaction(STORES.MUTATIONS, "readwrite");
  const store = transaction.objectStore(STORES.MUTATIONS);

  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => {
      const mutation = request.result;
      if (mutation) {
        mutation.synced = true;
        store.put(mutation);
      }
      resolve(undefined);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteSyncedMutations(): Promise<void> {
  const database = await openDB();
  const transaction = database.transaction(STORES.MUTATIONS, "readwrite");
  const store = transaction.objectStore(STORES.MUTATIONS);
  const index = store.index("synced");

  const request = index.openCursor(IDBKeyRange.only(true));
  request.onsuccess = (event) => {
    const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
    if (cursor) {
      cursor.delete();
      cursor.continue();
    }
  };
}

export interface CachedSession {
  access_token: string;
  refresh_token: string;
  user: unknown;
  expires_at: number;
}

export async function saveSession(session: CachedSession): Promise<void> {
  const database = await openDB();
  const transaction = database.transaction(STORES.SESSION, "readwrite");
  const store = transaction.objectStore(STORES.SESSION);

  store.put({ key: "session", ...session });
}

export async function getSession(): Promise<CachedSession | null> {
  const database = await openDB();
  const transaction = database.transaction(STORES.SESSION, "readonly");
  const store = transaction.objectStore(STORES.SESSION);

  return new Promise((resolve, reject) => {
    const request = store.get("session");
    request.onsuccess = () => {
      const result = request.result;
      if (!result) {
        resolve(null);
        return;
      }
      if (result.expires_at * 1000 < Date.now()) {
        store.delete("session");
        resolve(null);
        return;
      }
      resolve(result as CachedSession);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearSession(): Promise<void> {
  const database = await openDB();
  const transaction = database.transaction(STORES.SESSION, "readwrite");
  transaction.objectStore(STORES.SESSION).clear();
}

export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}
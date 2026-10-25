"use client";

/**
 * Offline reads for every page, without rewriting every page.
 *
 * Only a handful of screens were built on `useOffline*` hooks. The other ~60
 * call `supabase.from(...).select()` directly, so losing signal turned them
 * into empty tables even though the same rows had been on screen a minute
 * earlier. Wrapping the browser client's fetch gives those pages the last
 * successful response for the same query.
 *
 * Scope and safety:
 * - GET `/rest/v1/` only. Auth, storage, realtime and RPC writes are untouched.
 * - Keyed by the JWT `sub`, so one user is never served another user's cache
 *   on a shared phone (and the cache is purged on sign-out).
 * - The `Accept` header is part of the key because `.single()` asks PostgREST
 *   for an object instead of an array.
 * - Bounded: small bodies only, oldest entries evicted, failures are silent.
 *
 * A hit is last-known-good, not live. The sync indicator still owns telling
 * the user whether they are online; this layer only stops the screen going
 * blank when the radio drops.
 */

export interface CachedQueryResponse {
  key: string;
  userId: string;
  status: number;
  statusText: string;
  headers: [string, string][];
  body: string;
  savedAt: number;
}

export interface QueryCacheStore {
  get(key: string): Promise<CachedQueryResponse | null>;
  put(record: CachedQueryResponse): Promise<void>;
  clear(): Promise<void>;
}

const DB_NAME = "skoolmate-query-cache";
const DB_VERSION = 1;
const STORE = "responses";
const MAX_RECORDS = 300;
const MAX_BODY_BYTES = 512 * 1024;
const OPEN_TIMEOUT_MS = 3000;
// The body is replayed as decoded text, so keeping the original encoding
// header would make the browser try to decompress it a second time.
const STRIPPED_HEADERS = new Set(["content-encoding", "content-length", "transfer-encoding", "connection"]);

export function isCacheableRequest(url: string, method: string, destination?: string): boolean {
  if (method.toUpperCase() !== "GET") return false;
  if (destination === "document" || destination === "image" || destination === "script") return false;
  try {
    const parsed = new URL(url, "https://app.local");
    return parsed.pathname.includes("/rest/v1/") && !parsed.pathname.includes("/storage/v1/");
  } catch {
    return false;
  }
}

export function userIdFromAuthorization(header: string | null | undefined): string | null {
  if (!header) return null;
  const token = header.replace(/^Bearer\s+/i, "").trim();
  const payloadPart = token.split(".")[1];
  if (!payloadPart) return null;
  try {
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const json = globalThis.atob(padded);
    const payload = JSON.parse(json) as { sub?: unknown };
    return typeof payload.sub === "string" && payload.sub.length > 0 ? payload.sub : null;
  } catch {
    return null;
  }
}

export function queryCacheKey(url: string, accept: string, userId: string): string {
  return `${userId}::${accept || "application/json"}::${url}`;
}

/** Read one header from Headers, a plain object, or an entry array. */
export function readHeader(source: HeadersInit | null | undefined, name: string): string | null {
  if (!source) return null;
  const maybeHeaders = source as { get?: unknown };
  if (typeof maybeHeaders.get === "function") {
    try {
      return (source as Headers).get(name);
    } catch {
      return null;
    }
  }
  if (Array.isArray(source)) {
    for (const entry of source as [string, string][]) {
      if (String(entry[0]).toLowerCase() === name) return entry[1];
    }
    return null;
  }
  const record = source as Record<string, string>;
  for (const key of Object.keys(record)) {
    if (key.toLowerCase() === name) return record[key] ?? null;
  }
  return null;
}

export function recordToResponse(record: CachedQueryResponse): Response {
  // Pass the pairs directly: `ResponseInit.headers` accepts [name, value][],
  // and this avoids depending on a Headers constructor that some runtimes shim.
  return new Response(record.body, {
    status: record.status,
    statusText: record.statusText,
    headers: record.headers,
  });
}

function withDeadline<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), OPEN_TIMEOUT_MS)),
  ]);
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (db: IDBDatabase | null) => {
      if (settled) return;
      settled = true;
      resolve(db);
    };
    setTimeout(() => finish(null), OPEN_TIMEOUT_MS);
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "key" });
          store.createIndex("savedAt", "savedAt");
        }
      };
      request.onerror = () => finish(null);
      request.onblocked = () => finish(null);
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        finish(db);
      };
    } catch {
      finish(null);
    }
  });
}

let dbPromise: Promise<IDBDatabase | null> | null = null;
function database(): Promise<IDBDatabase | null> {
  if (!dbPromise) dbPromise = openDatabase();
  return dbPromise;
}

async function trimOldest(db: IDBDatabase): Promise<void> {
  const count = await new Promise<number>((resolve) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(0);
  });
  if (count <= MAX_RECORDS) return;
  const excess = count - MAX_RECORDS;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    const index = tx.objectStore(STORE).index("savedAt");
    let removed = 0;
    const cursor = index.openCursor();
    cursor.onsuccess = () => {
      const current = cursor.result;
      if (!current || removed >= excess) return;
      current.delete();
      removed += 1;
      current.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
}

const idbStore: QueryCacheStore = {
  async get(key) {
    const db = await withDeadline(database(), null);
    if (!db) return null;
    return withDeadline(
      new Promise<CachedQueryResponse | null>((resolve) => {
        const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
        request.onsuccess = () => resolve((request.result as CachedQueryResponse | undefined) ?? null);
        request.onerror = () => resolve(null);
      }),
      null,
    );
  },
  async put(record) {
    const db = await withDeadline(database(), null);
    if (!db) return;
    await withDeadline(
      new Promise<void>((resolve) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      }),
      undefined,
    );
    await withDeadline(trimOldest(db), undefined);
  },
  async clear() {
    const db = await withDeadline(database(), null);
    if (!db) return;
    await withDeadline(
      new Promise<void>((resolve) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      }),
      undefined,
    );
  },
};

export async function clearOfflineQueryCache(): Promise<void> {
  try {
    await idbStore.clear();
  } catch {
    // Storage can be unavailable in private mode; nothing to clear.
  }
}

async function persistResponse(store: QueryCacheStore, key: string, userId: string, response: Response): Promise<void> {
  try {
    const headers = Array.from(response.headers.entries()).filter(
      ([name]) => !STRIPPED_HEADERS.has(name.toLowerCase()),
    );
    const body = await response.text();
    if (body.length > MAX_BODY_BYTES) return;
    await store.put({
      key,
      userId,
      status: response.status,
      statusText: response.statusText,
      headers,
      body,
      savedAt: Date.now(),
    });
  } catch {
    // Quota, private mode, a body that cannot be re-read: keep the live data.
  }
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type ResponseBuilder = (record: CachedQueryResponse) => Response;

export function createOfflineAwareFetch(
  baseFetch: FetchLike,
  store: QueryCacheStore = idbStore,
  buildResponse: ResponseBuilder = recordToResponse,
) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = typeof Request !== "undefined" && input instanceof Request ? input : null;
    const url = request ? request.url : input instanceof URL ? input.href : String(input);
    const method = init?.method ?? request?.method ?? "GET";

    if (!isCacheableRequest(url, method, request?.destination)) {
      return baseFetch(input, init);
    }

    const headerSource = init?.headers ?? request?.headers;
    const userId = userIdFromAuthorization(readHeader(headerSource, "authorization"));
    if (!userId) {
      // Anonymous/public data is not cached: there is no user to scope it to.
      return baseFetch(input, init);
    }

    const key = queryCacheKey(url, readHeader(headerSource, "accept") ?? "", userId);
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;

    if (offline) {
      const cached = await store.get(key);
      if (cached) return buildResponse(cached);
      return baseFetch(input, init);
    }

    try {
      const response = await baseFetch(input, init);
      if (response.ok) {
        void persistResponse(store, key, userId, response.clone());
      }
      return response;
    } catch (error) {
      // A caller that cancelled its own request does not want stale data, but a
      // request that merely timed out on a weak link should still show the last
      // successful read instead of an error screen.
      const timedOut = error instanceof Error && /timed out/i.test(error.message);
      if (init?.signal?.aborted && !timedOut) throw error;
      const cached = await store.get(key);
      if (cached) return buildResponse(cached);
      throw error;
    }
  };
}

/** Browser entry point: real fetch, IndexedDB-backed cache. */
export const offlineAwareFetch = createOfflineAwareFetch((input, init) => fetch(input, init));

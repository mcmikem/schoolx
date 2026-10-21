// Offline-first database using IndexedDB
// This allows the app to work without internet connection

import { useEffect, useState } from "react";
import { logger } from "@/lib/logger";

const DB_NAME = "omuto.org-db";
// 10 -> 11: adds the academic_terms, homework and homework_submissions stores.
// Existing browsers only run onupgradeneeded when the version rises, so a
// version bump is what actually creates them.
const DB_VERSION = 11;

/**
 * IndexedDB key configuration for each object store, exported so unit tests can
 * assert it without a live IndexedDB (jsdom ships none).
 *
 * `sync_queue` MUST be autoIncrement: its rows are added by `save()`/`delete()`
 * without an `id`, and IndexedDB rejects an add whose keyPath (`id`) resolves
 * to `undefined` unless the store generates the key itself. v9 created this
 * store without `autoIncrement`, so every queue write threw a synchronous
 * `DataError` and the offline write pipeline had never held a single row.
 */
/**
 * Collision-resistant local id without requiring crypto.randomUUID
 * (Chrome 92+). Old Android WebViews throw on crypto.randomUUID, which used
 * to crash every offline cache write on those phones.
 */
export function newOfflineId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // fall through to the Math.random fallback below
  }
  return `id-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

export function storeOptions(storeName: string): { keyPath: string; autoIncrement?: boolean } {
  if (storeName === "sync_metadata") return { keyPath: "table" };
  if (storeName === "sync_queue") return { keyPath: "id", autoIncrement: true };
  return { keyPath: "id" };
}

/**
 * Fired whenever the sync queue changes -- a record queued, pushed or
 * dropped.
 *
 * The queue length is the one number a teacher needs ("is my work safe?"), and
 * a 30-second poll made it lie: the register said "saved" while the count
 * still said zero. The writer now announces itself, so the number moves the
 * moment the work is queued.
 */
export const SYNC_QUEUE_EVENT = "skoolmate:sync-queue-changed";

function announceQueueChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SYNC_QUEUE_EVENT));
}

interface OfflineRecord {
  id?: string;
  table: string;
  data: Record<string, unknown>;
  action: "create" | "update" | "delete";
  timestamp: number;
  synced: boolean;
  attempts: number;
  reason?: string;
}

const MAX_RETRY_ATTEMPTS = 3;

/**
 * How long the app waits for the local database to open before giving up on
 * it and loading from the network instead.
 *
 * Opening this database means creating 44 object stores and their indexes on
 * a first run. A low-end Android under memory pressure can take ten seconds
 * to get there, and a deadline that fires first does not just cost a slow
 * screen: it throws away the connection the browser is still building, so the
 * next visit starts from scratch. Ten seconds is long enough for a slow
 * phone and still bounded, so a genuinely blocked upgrade cannot hang the
 * screen.
 */
export const DB_OPEN_TIMEOUT_MS = 10000;
const SOFT_DELETE_TABLES = new Set(["grades", "fee_payments", "fee_structure", "fee_adjustments"]);

// PostgREST answers 404 with code PGRST205 for a table that is not in the
// schema. The refresh list that runs after every successful sign-in still
// names `timetable`, which was replaced by `timetable_slots` and whose cache
// entry nothing reads, so it is seeded here rather than paying a 404 on the
// first sync of every page load. Any other table that drifts is remembered on
// its first miss instead of on every sync after it.
const MISSING_TABLE_CODE = "PGRST205";
const missingTables = new Set<string>(["timetable"]);

type SyncItemResult =
  | { status: "synced" }
  | { status: "conflict"; reason: string }
  | { status: "failed"; reason?: string };

class OfflineDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<void>((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (settle: () => void) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        settle();
      };

      // An IndexedDB upgrade blocks until every other tab/PWA connection on an
      // older version closes. Without a deadline the open request never fires
      // onsuccess or onerror, so every caller that reads the cache (students,
      // fee structure) sits on `loading: true` forever and the screen renders
      // zeros. Fail fast instead: the callers catch this and load from the
      // network.
      //
      // Four seconds was too impatient for a slow phone. Opening this
      // database means creating 44 stores and their indexes on a first run,
      // and a low-end Android under memory pressure can take ten seconds to
      // get there. A deadline that fires first does not just cost a slow
      // screen: it throws away the connection the browser is still building,
      // so the caller gives up and the next visit starts from scratch --
      // which is why the page showed zeros until the user refreshed.
      timer = setTimeout(() => {
        finish(() => {
          this.initPromise = null;
          reject(new Error("Offline database open timed out"));
        });
      }, DB_OPEN_TIMEOUT_MS);

      let request: IDBOpenDBRequest;
      try {
        request = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (error) {
        finish(() => {
          this.initPromise = null;
          reject(error instanceof Error ? error : new Error(String(error)));
        });
        return;
      }

      request.onerror = () => {
        finish(() => {
          this.initPromise = null;
          reject(request.error ?? new Error("Offline database failed to open"));
        });
      };
      request.onblocked = () => {
        finish(() => {
          this.initPromise = null;
          reject(new Error("Offline database upgrade blocked by another open tab"));
        });
      };
      request.onsuccess = () => {
        const db = request.result;
        // Release this connection when another tab wants to upgrade, so a
        // future deploy cannot deadlock on the open we are holding now.
        db.onversionchange = () => {
          db.close();
          if (this.db === db) this.db = null;
        };
        // The deadline already fired, but the open did finish. Keep the
        // connection: the caller that gave up will be back, and handing it a
        // database that is already open is the difference between a page
        // that loads and a page that shows zeros until it is refreshed.
        if (settled) {
          if (this.db) {
            // Another connection is already in use. Keep the one we have.
            db.close();
          } else {
            this.db = db;
          }
          this.initPromise = null;
          return;
        }
        finish(() => {
          this.db = db;
          this.initPromise = null;
          resolve();
        });
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        const stores = [
          "students",
          "classes",
          "subjects",
          // Cached and read by offline-hooks but never given a store, so every
          // read threw NotFoundError: Failed to execute 'transaction' on
          // 'IDBDatabase'. The academic term is the one that matters most --
          // without it the app cannot tell which term it is in while offline.
          "academic_terms",
          "homework",
          "homework_submissions",
          // Same story: read through the offline cache by hooks/attendance.ts
          // with no store to read from.
          "dorms",
          "dorm_students",
          "dorm_attendance",
          "attendance",
          "period_attendance",
          "grades",
          "fee_payments",
          "fee_structure",
          "fee_adjustments",
          "messages",
          "events",
          "timetable",
          "users",
          "staff",
          "staff_attendance",
          "lesson_plans",
          "canteen_orders",
          "canteen_items",
          "canteen_sales",
          "inventory",
          "behavior_logs",
          "counseling_sessions",
          "health_records",
          "leave_requests",
          "transport_routes",
          "transport_students",
          "teacher_substitutions",
          "promotion_history",
          "audit_log",
          "report_cards",
          "dashboard_cache",
          "sync_queue",
          "sync_metadata",
        ];

        stores.forEach((storeName) => {
          // IndexedDB cannot change a store's keyPath/autoIncrement in place —
          // the options must be deleted and recreated. This is the v9→v10
          // migration for sync_queue, which v9 created without autoIncrement.
          if (storeName === "sync_queue" && db.objectStoreNames.contains(storeName)) {
            db.deleteObjectStore(storeName);
          }

          if (!db.objectStoreNames.contains(storeName)) {
            const options = storeOptions(storeName);

            if (storeName === "sync_metadata") {
              const store = db.createObjectStore(storeName, {
                keyPath: options.keyPath,
              });
              store.createIndex("table", "table", { unique: true });
            } else {
              const store = db.createObjectStore(storeName, {
                keyPath: options.keyPath,
                ...(options.autoIncrement ? { autoIncrement: true } : {}),
              });
              store.createIndex("school_id", "school_id", { unique: false });
              store.createIndex("created_at", "created_at", { unique: false });

              if (storeName === "attendance") {
                store.createIndex("student_id", "student_id", {
                  unique: false,
                });
                store.createIndex("date", "date", { unique: false });
                store.createIndex("class_id", "class_id", { unique: false });
              }

              if (storeName === "period_attendance") {
                store.createIndex("student_id", "student_id", {
                  unique: false,
                });
                store.createIndex("date", "date", { unique: false });
                store.createIndex("class_id", "class_id", { unique: false });
                store.createIndex("period", "period", { unique: false });
              }

              if (storeName === "grades") {
                store.createIndex("student_id", "student_id", {
                  unique: false,
                });
                store.createIndex("subject_id", "subject_id", {
                  unique: false,
                });
                store.createIndex("class_id", "class_id", { unique: false });
              }

              if (storeName === "fee_payments") {
                store.createIndex("student_id", "student_id", {
                  unique: false,
                });
              }
            }
          }
        });
      };
    });

    return this.initPromise;
  }

  private async ensureDb(): Promise<IDBDatabase> {
    if (!this.db) await this.init();
    return this.db!;
  }

  // Save data locally and queue for sync
  async save(table: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([table, "sync_queue"], "readwrite");
      const store = transaction.objectStore(table);
      const syncStore = transaction.objectStore("sync_queue");

      const record = {
        ...data,
        id: data.id || newOfflineId(),
        updated_at: new Date().toISOString(),
      };

      store.put(record);

      // The local table write above is the durable one — a queue failure must
      // never reject it. (With autoIncrement on sync_queue the add can no
      // longer throw the v9 DataError; this guard covers quota/abort cases.)
      try {
        syncStore.add({
          table,
          data: record,
          action: data.id ? "update" : "create",
          timestamp: Date.now(),
          synced: false,
          attempts: 0,
        });
      } catch (queueErr) {
        logger.warn("Failed to enqueue offline record for sync", { table, queueErr });
      }

      transaction.oncomplete = () => {
        this.queueSync().catch(() => {});
        announceQueueChange();
        resolve(record);
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Get a single record from local storage
  async get(table: string, id: string): Promise<Record<string, unknown> | null> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([table], "readonly");
      const store = transaction.objectStore(table);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // Get all data from a table with optional filters
  async getAll(table: string, filters?: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([table], "readonly");
      const store = transaction.objectStore(table);
      const filterEntries = Object.entries(filters ?? {});
      const indexedFilter = filterEntries.find(
        ([key, value]) => store.indexNames.contains(key) && (typeof value === "string" || typeof value === "number"),
      );
      const request = indexedFilter
        ? store.index(indexedFilter[0]).getAll(IDBKeyRange.only(indexedFilter[1]))
        : store.getAll();

      request.onsuccess = () => {
        let results = request.result || [];

        if (filterEntries.length > 0) {
          results = results.filter((item) => {
            return filterEntries.every(([key, value]) => item[key] === value);
          });
        }

        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Delete data locally and queue for sync
  async delete(table: string, id: string): Promise<void> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([table, "sync_queue"], "readwrite");
      const store = transaction.objectStore(table);
      const syncStore = transaction.objectStore("sync_queue");

      // Capture the record's updated_at BEFORE deleting it locally so the sync
      // step can detect a delete that races a newer edit from another device.
      // Without it a queued delete silently destroys the other device's change.
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const localUpdatedAt = (getRequest.result as Record<string, unknown> | undefined)?.updated_at as
          | string
          | undefined;

        store.delete(id);

        try {
          syncStore.add({
            table,
            data: { id, ...(localUpdatedAt ? { updated_at: localUpdatedAt } : {}) },
            action: "delete",
            timestamp: Date.now(),
            synced: false,
            attempts: 0,
          });
        } catch (queueErr) {
          logger.warn("Failed to enqueue offline delete for sync", { table, queueErr });
        }
      };

      transaction.oncomplete = () => {
        this.queueSync().catch(() => {});
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Store data fetched from server into cache
  async cacheFromServer(table: string, data: Record<string, unknown>[]): Promise<void> {
    try {
      const db = await this.ensureDb();

      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([table, "sync_metadata"], "readwrite");
        const store = transaction.objectStore(table);
        const metaStore = transaction.objectStore("sync_metadata");

        data.forEach((item) => {
          if (item.id) {
            store.put(item);
          }
        });

        metaStore.put({
          table,
          last_synced: Date.now(),
          record_count: data.length,
        });

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      logger.warn(`Could not cache server data for ${table}; server data remains available`, error);
    }
  }

  // Get all cached data from a table (alias for getAll, for clarity)
  async getAllFromCache(table: string, filters?: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    return this.getAll(table, filters);
  }

  // Get the age of cached data in milliseconds
  async getCacheAge(table: string): Promise<number | null> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["sync_metadata"], "readonly");
      const store = transaction.objectStore("sync_metadata");
      const request = store.get(table);

      request.onsuccess = () => {
        const meta = request.result;
        if (!meta || !meta.last_synced) {
          resolve(null);
        } else {
          resolve(Date.now() - meta.last_synced);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Get last synced timestamp for a table
  async getLastSynced(table: string): Promise<number | null> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["sync_metadata"], "readonly");
      const store = transaction.objectStore("sync_metadata");
      const request = store.get(table);

      request.onsuccess = () => {
        const meta = request.result;
        resolve(meta?.last_synced || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Get last synced timestamps for all tables
  async getAllLastSynced(): Promise<Record<string, number>> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["sync_metadata"], "readonly");
      const store = transaction.objectStore("sync_metadata");
      const request = store.getAll();

      request.onsuccess = () => {
        const result: Record<string, number> = {};
        for (const meta of request.result || []) {
          if (meta.last_synced) {
            result[meta.table] = meta.last_synced;
          }
        }
        resolve(result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Get pending sync items
  async getPendingSync(): Promise<OfflineRecord[]> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["sync_queue"], "readonly");
      const store = transaction.objectStore("sync_queue");
      const request = store.getAll();

      request.onsuccess = () => {
        const items = (request.result || []).filter((item) => !item.synced && item.attempts < MAX_RETRY_ATTEMPTS);
        resolve(items);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getFailedSync(): Promise<OfflineRecord[]> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["sync_queue"], "readonly");
      const store = transaction.objectStore("sync_queue");
      const request = store.getAll();

      request.onsuccess = () => {
        const items = (request.result || []).filter((item) => !item.synced && item.attempts >= MAX_RETRY_ATTEMPTS);
        resolve(items);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Mark item as synced
  async markSynced(id: number): Promise<void> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["sync_queue"], "readwrite");
      const store = transaction.objectStore("sync_queue");
      const request = store.get(id);

      request.onsuccess = () => {
        const item = request.result;
        if (item) {
          item.synced = true;
          store.put(item);
        }
        announceQueueChange();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Increment retry attempts for a sync item
  async incrementAttempts(id: number): Promise<void> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["sync_queue"], "readwrite");
      const store = transaction.objectStore("sync_queue");
      const request = store.get(id);

      request.onsuccess = () => {
        const item = request.result;
        if (item) {
          item.attempts = (item.attempts || 0) + 1;
          store.put(item);
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Keep a conflicted item visible instead of silently dropping it: cap its
  // retries so it surfaces in Sync Center with the reason, and the local copy
  // stays in cache so the user can review before deciding to discard it.
  async markConflicted(id: number, reason: string): Promise<void> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["sync_queue"], "readwrite");
      const store = transaction.objectStore("sync_queue");
      const request = store.get(id);

      request.onsuccess = () => {
        const item = request.result;
        if (item) {
          item.synced = false;
          item.attempts = MAX_RETRY_ATTEMPTS;
          item.reason = reason;
          store.put(item);
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Re-apply the local version of a conflicted item. Bumps the local
  // updated_at to "now" so the server-wins guard lets it through on the next
  // sync, and clears the retry cap/reason that kept it parked.
  async retrySyncItem(id: number): Promise<void> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["sync_queue"], "readwrite");
      const store = transaction.objectStore("sync_queue");
      const request = store.get(id);

      request.onsuccess = () => {
        const item = request.result as OfflineRecord | undefined;
        if (item) {
          item.synced = false;
          item.attempts = 0;
          delete item.reason;
          item.data = { ...item.data, updated_at: new Date().toISOString() };
          store.put(item);
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Remove a sync queue item
  async removeSyncItem(id: number): Promise<void> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["sync_queue"], "readwrite");
      const store = transaction.objectStore("sync_queue");
      const request = store.delete(id);

      request.onsuccess = () => {
        announceQueueChange();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Clear sync queue
  async clearSyncQueue(): Promise<void> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["sync_queue"], "readwrite");
      const store = transaction.objectStore("sync_queue");
      const request = store.clear();

      request.onsuccess = () => {
        announceQueueChange();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Ask the browser to fire a background-sync event once the device reconnects.
  // Fire-and-forget: if Background Sync is unavailable, the shared sync store
  // (src/lib/useSyncStatus.ts) still pushes the queue when the connection
  // comes back.
  private async queueSync(): Promise<void> {
    try {
      if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
      const reg = await navigator.serviceWorker.ready;
      const syncManager = (reg as unknown as { sync?: { register(tag: string): Promise<void> } }).sync;
      if (syncManager) {
        await syncManager.register("sync-queue");
      }
    } catch {
      // Background Sync not supported / registration failed — safe to ignore.
    }
  }

  // Check if online
  isOnline(): boolean {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  }

  // offlineDB.save() stamps every record with updated_at, and callers pass
  // client-only flags alongside the row. Sending any of these to PostgREST
  // makes it reject the write with PGRST204 (unknown column), so strip them
  // before the record enters the sync queue.
  // (canteen_sales does its own deletes inline and is left untouched.)
  private stripSyncKeys(data: Record<string, unknown>): Record<string, unknown> {
    const {
      updated_at: _updatedAt,
      isDemo: _isDemo,
      schoolId: _schoolId,
      pending_wallet_deduction: _pendingWallet,
      ...rest
    } = data;
    void _updatedAt;
    void _isDemo;
    void _schoolId;
    void _pendingWallet;
    return rest;
  }

  // Sync a single item to server
  private async syncSingleItem(item: OfflineRecord): Promise<SyncItemResult> {
    try {
      const { supabase } = await import("@/lib/supabase");
      const rowId = (item.data as Record<string, unknown>)?.id as string | undefined;
      const localUpdatedAt = (item.data as Record<string, unknown>)?.updated_at as string | undefined;

      // Server-wins conflict policy for mutable records when updated_at is available.
      // If server has a newer version, skip local write and treat as resolved conflict.
      if (
        rowId &&
        localUpdatedAt &&
        item.table !== "attendance" &&
        item.table !== "grades" &&
        item.table !== "canteen_sales"
      ) {
        const { data: serverRow } = await supabase.from(item.table).select("updated_at").eq("id", rowId).maybeSingle();

        const serverUpdatedAt = (serverRow as Record<string, unknown> | null)?.updated_at as string | undefined;

        if (serverUpdatedAt && new Date(serverUpdatedAt).getTime() > new Date(localUpdatedAt).getTime()) {
          return {
            status: "conflict",
            reason: `${item.table}:${rowId} server newer than offline mutation`,
          };
        }
      }

      if (item.action === "delete") {
        const deleteId = (item.data as Record<string, unknown>).id as string;
        const query = supabase.from(item.table);
        const { error } = SOFT_DELETE_TABLES.has(item.table)
          ? await query.update({ deleted_at: new Date().toISOString() }).eq("id", deleteId)
          : await query.delete().eq("id", deleteId);
        if (error) throw error;
      } else if (item.table === "attendance") {
        const { error } = await supabase
          .from("attendance")
          .upsert(this.stripSyncKeys(item.data), { onConflict: "student_id,date,period_number" });
        if (error) throw error;
      } else if (item.table === "grades") {
        const { error } = await supabase.from("grades").upsert(this.stripSyncKeys(item.data), {
          onConflict: "student_id,subject_id,assessment_type,term,academic_year",
        });
        if (error) throw error;
      } else if (item.table === "report_cards") {
        const { error } = await supabase
          .from("report_cards")
          .upsert(this.stripSyncKeys(item.data), { onConflict: "student_id,academic_year,term" });
        if (error) throw error;
      } else if (item.table === "canteen_sales") {
        const data = { ...(item.data as Record<string, unknown>) };
        // Columns the canteen_sales table doesn't have / client-only flags
        delete data.updated_at;
        delete data.pending_wallet_deduction;
        const rowId = data.id as string | undefined;

        // Sale ids are client-generated; guard against double-insert when a
        // previous attempt inserted the row but failed on the wallet step.
        if (rowId) {
          const { data: existing } = await supabase.from("canteen_sales").select("id").eq("id", rowId).maybeSingle();
          if (!existing) {
            const { error } = await supabase.from("canteen_sales").insert(data);
            if (error) throw error;
          }
        } else {
          const { error } = await supabase.from("canteen_sales").insert(data);
          if (error) throw error;
        }

        const pendingWallet = (item.data as Record<string, unknown>).pending_wallet_deduction as
          | { student_id?: string; amount?: number }
          | undefined;
        if (pendingWallet?.student_id && pendingWallet.amount != null) {
          const { error } = await supabase.rpc("deduct_student_wallet", {
            p_student_id: pendingWallet.student_id,
            p_amount: pendingWallet.amount,
            p_description: "Purchase at Canteen (synced from offline)",
            p_ref: rowId || null,
          });
          if (error) throw error;
        }
        return { status: "synced" };
      } else if (item.action === "update") {
        const { id, ...updateData } = item.data as Record<string, unknown> & {
          id: string;
        };
        const { error } = await supabase.from(item.table).update(updateData).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(item.table).insert(item.data);
        if (error) throw error;
      }
      return { status: "synced" };
    } catch (err) {
      return {
        status: "failed",
        reason: err instanceof Error ? err.message : "Unknown sync error",
      };
    }
  }

  // Sync all pending data to server with retry logic
  // apiUrl parameter is accepted for backward compatibility but unused (uses supabase directly)
  async syncToServer(_apiUrl?: string): Promise<{ success: number; failed: number; errors: string[] }> {
    const pending = await this.getPendingSync();
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const item of pending) {
      const itemId = item.id as unknown as number;
      const result = await this.syncSingleItem(item);

      if (result.status === "synced") {
        await this.markSynced(itemId);
        success++;
      } else if (result.status === "conflict") {
        await this.markConflicted(itemId, result.reason || "server copy is newer");
        errors.push(
          `Conflict on ${item.table} (id: ${item.data?.id}): the server has a newer version. ` +
            (item.action === "delete"
              ? `Your offline delete was NOT applied because another device changed the record afterwards. ` +
                `Review it in Sync Center before deciding.`
              : `Your offline change was kept locally and NOT overwritten — review it in Sync Center before deciding.`),
        );
      } else {
        await this.incrementAttempts(itemId);
        const newAttempts = (item.attempts || 0) + 1;
        if (newAttempts >= MAX_RETRY_ATTEMPTS) {
          errors.push(`Failed to sync ${item.table} (id: ${item.data?.id}) after ${MAX_RETRY_ATTEMPTS} attempts`);
        } else if (result.reason) {
          errors.push(`Temporary sync failure for ${item.table} (id: ${item.data?.id}): ${result.reason}`);
        }
        failed++;
      }
    }

    return { success, failed, errors };
  }

  // Bulk sync: sync all pending, then re-fetch cache from server for given tables
  async refreshAll(tables: string[]): Promise<{ synced: number; errors: string[] }> {
    const errors: string[] = [];

    // First push local changes
    const syncResult = await this.syncToServer();
    errors.push(...syncResult.errors);

    // Then pull fresh data from server into cache
    try {
      const { supabase } = await import("@/lib/supabase");
      for (const table of tables) {
        if (missingTables.has(table)) continue;
        try {
          const { data, error } = await supabase.from(table).select("*");
          if (error) {
            if (error.code === MISSING_TABLE_CODE) {
              missingTables.add(table);
              continue;
            }
            throw error;
          }
          if (data) {
            await this.cacheFromServer(table, data as Record<string, unknown>[]);
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : `Failed to refresh ${table}`;
          errors.push(msg);
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to import supabase";
      errors.push(msg);
    }

    return { synced: syncResult.success, errors };
  }

  // Conflict resolution: server data wins, overwrite local cache
  async resolveConflicts(table: string, serverData: Record<string, unknown>[]): Promise<void> {
    await this.cacheFromServer(table, serverData);
  }
}

// Singleton instance
export const offlineDB = new OfflineDB();

// React hook for offline status
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

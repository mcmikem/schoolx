import { findPendingWrite, mergeOfflineRecord, storeOptions } from "@/lib/offline";

/**
 * Regression tests for the offline write pipeline.
 *
 * The v9 `sync_queue` store was created with `{ keyPath: "id" }` and no
 * `autoIncrement`, but `save()`/`delete()` add rows without an `id`. IndexedDB
 * rejects such an add with a synchronous DataError, so the queue never held a
 * single row and offline attendance/marks were silently dropped.
 */
describe("offline store key configuration", () => {
  it("gives sync_queue an autoIncrement key so id-less adds succeed", () => {
    // The exact bug: without autoIncrement, syncStore.add({...}) has no key.
    expect(storeOptions("sync_queue")).toEqual({ keyPath: "id", autoIncrement: true });
  });

  it("gives sync_metadata a table keyPath", () => {
    expect(storeOptions("sync_metadata")).toEqual({ keyPath: "table" });
  });

  it("gives every data store a string id keyPath", () => {
    const dataStores = [
      "students",
      "classes",
      "subjects",
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
    ];
    for (const store of dataStores) {
      expect(storeOptions(store).keyPath).toBe("id");
    }
  });

  it("only sync_queue auto-generates its key", () => {
    // Data stores receive an explicit id from the caller; only the queue relies
    // on IndexedDB assigning one.
    expect(storeOptions("students").autoIncrement).toBeUndefined();
    expect(storeOptions("grades").autoIncrement).toBeUndefined();
    expect(storeOptions("attendance").autoIncrement).toBeUndefined();
  });
});

describe("offline edits", () => {
  it("keeps the cached student fields when saving a partial offline edit", () => {
    const record = mergeOfflineRecord(
      {
        id: "student-1",
        school_id: "school-1",
        first_name: "Amina",
        class_id: "class-1",
        parent_phone: "0700000000",
      },
      { id: "student-1", parent_phone: "0711111111" },
      "student-1",
      "2026-10-29T08:00:00.000Z",
    );

    expect(record).toEqual({
      id: "student-1",
      school_id: "school-1",
      first_name: "Amina",
      class_id: "class-1",
      parent_phone: "0711111111",
      updated_at: "2026-10-29T08:00:00.000Z",
    });
  });

  it("coalesces edits into a pending create or update for the same row only", () => {
    const create = {
      id: 1,
      table: "students",
      data: { id: "student-1" },
      action: "create" as const,
      timestamp: 1,
      synced: false,
      attempts: 0,
    };
    const synced = { ...create, id: 2, synced: true };
    const otherRow = { ...create, id: 3, data: { id: "student-2" } };

    expect(findPendingWrite([synced, otherRow, create], "students", "student-1")).toBe(create);
    expect(findPendingWrite([create], "grades", "student-1")).toBeUndefined();
  });
});

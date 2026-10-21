/**
 * A blocked IndexedDB upgrade must not leave the whole tenant looking empty.
 *
 * When a new deploy bumps DB_VERSION while another tab or installed PWA still
 * holds the old connection, `indexedDB.open` fires `onblocked` and otherwise
 * never calls `onsuccess`/`onerror`. The hooks that read the cache first
 * (students, fee structure) awaited that promise forever, so they stayed on
 * `loading: true` with `[]` -- the Fees Tracker rendered all zeros while
 * payments loaded normally. These tests pin the failure-fast behaviour.
 */

const originalIndexedDB = globalThis.indexedDB;

function setIndexedDB(value: unknown): void {
  Object.defineProperty(globalThis, "indexedDB", { value, configurable: true, writable: true });
}

afterEach(() => {
  setIndexedDB(originalIndexedDB);
  jest.useRealTimers();
  jest.resetModules();
});

describe("offline database open failures", () => {
  it("rejects instead of hanging when the open request never settles", async () => {
    jest.useFakeTimers();
    setIndexedDB({ open: () => ({}) as IDBOpenDBRequest });
    jest.resetModules();
    const { offlineDB } = await import("@/lib/offline");

    const read = offlineDB.getAllFromCache("students", { school_id: "school-1" });
    const assertion = expect(read).rejects.toThrow(/timed out/i);
    jest.advanceTimersByTime(4000);
    await assertion;
  });

  it("rejects instead of throwing when IndexedDB is unavailable", async () => {
    setIndexedDB(undefined);
    jest.resetModules();
    const { offlineDB } = await import("@/lib/offline");

    await expect(offlineDB.getAllFromCache("students")).rejects.toThrow();
  });
});

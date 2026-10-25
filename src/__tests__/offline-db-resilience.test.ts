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
    const { offlineDB, DB_OPEN_TIMEOUT_MS } = await import("@/lib/offline");

    const read = offlineDB.getAllFromCache("students", { school_id: "school-1" });
    const assertion = expect(read).rejects.toThrow(/timed out/i);
    jest.advanceTimersByTime(DB_OPEN_TIMEOUT_MS + 10);
    await assertion;
  });

  it("keeps successful server fetches usable when a cache write times out", async () => {
    jest.useFakeTimers();
    setIndexedDB({ open: () => ({}) as IDBOpenDBRequest });
    jest.resetModules();
    const { offlineDB, DB_OPEN_TIMEOUT_MS } = await import("@/lib/offline");

    const cacheWrite = offlineDB.cacheFromServer("fee_structure", []);
    const assertion = expect(cacheWrite).resolves.toBeUndefined();
    jest.advanceTimersByTime(DB_OPEN_TIMEOUT_MS + 10);
    await assertion;
  });

  it("reopens without a version when a tab left open by an old deploy asks for an older schema", async () => {
    const calls: Array<number | undefined> = [];
    const db = { onversionchange: null as (() => void) | null, close: jest.fn() };
    setIndexedDB({
      open: (_name: string, version?: number) => {
        calls.push(version);
        const request: {
          error: { name: string } | null;
          result?: typeof db;
          onsuccess?: () => void;
          onerror?: () => void;
        } = { error: null };
        if (version !== undefined) {
          request.error = { name: "VersionError" };
          setTimeout(() => request.onerror?.(), 0);
        } else {
          request.result = db;
          setTimeout(() => request.onsuccess?.(), 0);
        }
        return request as unknown as IDBOpenDBRequest;
      },
    });
    jest.resetModules();
    const { offlineDB } = await import("@/lib/offline");

    await expect((offlineDB as unknown as { ensureDb: () => Promise<unknown> }).ensureDb()).resolves.toBeDefined();
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual(expect.any(Number));
    expect(calls[1]).toBeUndefined();
  });

  it("rejects instead of throwing when IndexedDB is unavailable", async () => {
    setIndexedDB(undefined);
    jest.resetModules();
    const { offlineDB } = await import("@/lib/offline");

    await expect(offlineDB.getAllFromCache("students")).rejects.toThrow();
  });
});

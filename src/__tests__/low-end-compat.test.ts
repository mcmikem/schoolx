import { timeoutSignal } from "@/lib/hooks/utils";
import { newOfflineId } from "@/lib/offline";

/**
 * Old Android WebViews (frozen pre-88 Chrome, common on Android 8 phones):
 * - AbortSignal.timeout does not exist -> auth init threw before any request.
 * - crypto.randomUUID does not exist (pre-92) -> offline cache writes threw.
 * These shims must work with AND without the modern APIs.
 */
describe("timeoutSignal", () => {
  it("aborts after the timeout via the native API when available", async () => {
    if (typeof AbortSignal.timeout !== "function") return;
    const { signal, cancel } = timeoutSignal(20);
    expect(signal.aborted).toBe(false);
    await new Promise((r) => setTimeout(r, 50));
    expect(signal.aborted).toBe(true);
    cancel();
  });

  it("falls back to AbortController when AbortSignal.timeout is missing", async () => {
    const realTimeout = (AbortSignal as any).timeout;
    Object.defineProperty(AbortSignal, "timeout", { value: undefined, configurable: true });
    try {
      const { signal, cancel } = timeoutSignal(20);
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal.aborted).toBe(false);
      await new Promise((r) => setTimeout(r, 50));
      expect(signal.aborted).toBe(true);
      cancel();
    } finally {
      Object.defineProperty(AbortSignal, "timeout", { value: realTimeout, configurable: true });
    }
  });

  it("cancel() suppresses the fallback timer", async () => {
    const realTimeout = (AbortSignal as any).timeout;
    Object.defineProperty(AbortSignal, "timeout", { value: undefined, configurable: true });
    try {
      const { signal, cancel } = timeoutSignal(10000);
      cancel();
      await new Promise((r) => setTimeout(r, 30));
      expect(signal.aborted).toBe(false);
    } finally {
      Object.defineProperty(AbortSignal, "timeout", { value: realTimeout, configurable: true });
    }
  });
});

describe("newOfflineId", () => {
  it("returns unique non-empty ids", () => {
    const ids = new Set(Array.from({ length: 100 }, () => newOfflineId()));
    expect(ids.size).toBe(100);
    for (const id of ids) expect(id.length).toBeGreaterThan(0);
  });

  it("falls back to a UUID even when crypto.randomUUID is missing", () => {
    const realCrypto = (globalThis as any).crypto;
    Object.defineProperty(globalThis, "crypto", { value: {}, configurable: true });
    try {
      const id = newOfflineId();
      // Offline-created rows are replayed into Postgres uuid columns, so a
      // human-readable "id-..." would be rejected by the sync endpoint.
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally {
      Object.defineProperty(globalThis, "crypto", { value: realCrypto, configurable: true });
    }
  });
});

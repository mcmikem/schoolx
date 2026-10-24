import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  BUILD_RECOVERY_COOLDOWN_MS,
  claimStaleBuildRecovery,
  clearAppCaches,
  isChunkLoadError,
  retryStaleBuildOnce,
} from "@/lib/build-recovery";

const RECOVERY_KEY = "skoolmate-stale-build-recovery";

describe("stale build recovery", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("recognises the failures a stale module graph produces", () => {
    expect(isChunkLoadError(new Error("ChunkLoadError: Loading chunk 8123 failed"))).toBe(true);
    expect(
      isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: /_next/static/chunks/app.js")),
    ).toBe(true);
    expect(isChunkLoadError(new Error("Importing a module script failed."))).toBe(true);
    expect(isChunkLoadError("error loading dynamically imported module")).toBe(true);
    expect(isChunkLoadError(new Error("Unexpected token '<'"))).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });

  it("allows one automatic reload per cooldown window", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-24T09:00:00Z"));
    expect(claimStaleBuildRecovery()).toBe(true);
    expect(claimStaleBuildRecovery()).toBe(false);

    jest.setSystemTime(new Date(Date.now() + BUILD_RECOVERY_COOLDOWN_MS + 1000));
    expect(claimStaleBuildRecovery()).toBe(true);
  });

  it("survives a browser that blocks sessionStorage", () => {
    const spy = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(claimStaleBuildRecovery()).toBe(false);
    spy.mockRestore();
  });

  it("unregisters the worker and drops only the app's caches", async () => {
    const unregister = jest.fn(async () => true);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { getRegistrations: jest.fn(async () => [{ unregister }, { unregister }]) },
    });

    const deleteCache = jest.fn(async (_key: string) => true);
    const keys = jest.fn(async () => ["skoolmate-v15-pages", "skoolmate-v15-static", "unrelated-cache"]);
    Object.defineProperty(window, "caches", {
      configurable: true,
      value: { keys, delete: deleteCache },
    });

    await clearAppCaches();

    expect(unregister).toHaveBeenCalledTimes(2);
    expect(deleteCache).toHaveBeenCalledWith("skoolmate-v15-pages");
    expect(deleteCache).toHaveBeenCalledWith("skoolmate-v15-static");
    expect(deleteCache).not.toHaveBeenCalledWith("unrelated-cache");
  });

  it("does not trigger recovery for unrelated errors", async () => {
    await expect(retryStaleBuildOnce(new Error("database offline"))).resolves.toBe(false);
    expect(window.sessionStorage.getItem(RECOVERY_KEY)).toBeNull();
  });
});

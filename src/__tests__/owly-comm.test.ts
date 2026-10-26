/**
 * The wording of status communications is one voice: Owly's. These pin the
 * pure builders the CommCenter sends through the owly bus.
 */

import {
  backOnlineComm,
  commToMessage,
  failedSyncComm,
  isSlowConnection,
  offlineComm,
  slowInternetComm,
  syncedComm,
} from "@/lib/owly-comm";

describe("owly status comms", () => {
  it("detects 2g-class connections and data-saver as slow", () => {
    expect(isSlowConnection({ effectiveType: "2g" })).toBe(true);
    expect(isSlowConnection({ effectiveType: "slow-2g" })).toBe(true);
    expect(isSlowConnection({ saveData: true })).toBe(true);
    expect(isSlowConnection({ effectiveType: "4g" })).toBe(false);
    expect(isSlowConnection(undefined)).toBe(false);
  });

  it("warns on slow signal once with the offline-copy reassurance", () => {
    const comm = slowInternetComm({ effectiveType: "2g" });
    expect(comm?.severity).toBe("warning");
    expect(comm?.title).toBe("Slow connection detected");
    expect(comm?.detail).toMatch(/syncs when the signal improves/);
    expect(slowInternetComm({ effectiveType: "4g" })).toBeNull();
  });

  it("describes offline save-now-sync-later", () => {
    expect(offlineComm()).toMatchObject({ severity: "warning", title: "You are offline" });
  });

  it("is quieter back online when there was nothing to sync", () => {
    expect(backOnlineComm(0)).toEqual({ severity: "success", title: "Back online" });
    expect(backOnlineComm(3)).toMatchObject({ severity: "info", detail: /3 changes/ });
  });

  it("reports drained queue as success and failures with a next step", () => {
    expect(syncedComm(1).title).toBe("1 change synced");
    expect(syncedComm(2).title).toBe("2 changes synced");
    expect(failedSyncComm(1).detail).toMatch(/Sync Center/);
  });

  it("renders as a chat message", () => {
    expect(commToMessage({ title: "Back online", severity: "success" })).toBe("Back online");
    expect(commToMessage(offlineComm())).toContain("\n\n");
  });
});

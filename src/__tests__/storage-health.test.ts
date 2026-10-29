import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CRITICAL_FREE_BYTES, LOW_FREE_BYTES, assessStorageHealth, formatStorageSize } from "@/lib/storage-health";

const MB = 1024 * 1024;

describe("assessing what is left on the phone", () => {
  it("says unknown when the browser cannot report a quota", () => {
    expect(assessStorageHealth({ supported: false }).level).toBe("unknown");
    expect(assessStorageHealth({ usage: 10, quota: null }).level).toBe("unknown");
    expect(assessStorageHealth({ usage: 10, quota: 0 }).level).toBe("unknown");
  });

  it("is calm while there is room for days of offline work", () => {
    const health = assessStorageHealth({ usage: 100 * MB, quota: 2 * 1024 * MB, persisted: true });
    expect(health.level).toBe("ok");
    expect(health.free).toBeGreaterThan(LOW_FREE_BYTES);
    expect(health.persisted).toBe(true);
  });

  it("warns before the quota is too tight to download a class", () => {
    const health = assessStorageHealth({ usage: 60 * MB, quota: 100 * MB });
    expect(health.free).toBeLessThan(LOW_FREE_BYTES);
    expect(health.level).toBe("low");
  });

  it("warns on quota pressure even when the absolute free space looks generous", () => {
    const health = assessStorageHealth({ usage: 8.5 * 1024 * MB, quota: 10 * 1024 * MB });
    expect(health.free).toBeGreaterThan(LOW_FREE_BYTES);
    expect(health.usedPercent).toBeGreaterThanOrEqual(80);
    expect(health.level).toBe("low");
  });

  it("raises the alarm when the next write can fail", () => {
    expect(assessStorageHealth({ usage: 95 * MB, quota: 100 * MB }).level).toBe("critical");
    expect(assessStorageHealth({ usage: 96 * MB, quota: 100 * MB }).level).toBe("critical");
    expect(CRITICAL_FREE_BYTES).toBeLessThan(LOW_FREE_BYTES);
  });

  it("never reports negative room when usage is above quota", () => {
    const health = assessStorageHealth({ usage: 120 * MB, quota: 100 * MB });
    expect(health.free).toBe(0);
    expect(health.usedPercent).toBe(100);
    expect(health.level).toBe("critical");
  });
});

describe("formatting storage for a phone screen", () => {
  it("uses compact units", () => {
    expect(formatStorageSize(0)).toBe("0 B");
    expect(formatStorageSize(1023)).toBe("1023 B");
    expect(formatStorageSize(1024)).toBe("1.0 KB");
    expect(formatStorageSize(20 * MB)).toBe("20 MB");
    expect(formatStorageSize(2.1 * 1024 * MB)).toBe("2.1 GB");
    expect(formatStorageSize(null)).toBe("—");
  });
});

describe("the warning is wired into the app, not just available", () => {
  it("mounts in the dashboard shell", () => {
    const layout = readFileSync(join(__dirname, "..", "app", "dashboard", "layout.tsx"), "utf8");
    expect(layout).toContain("<StorageWarning />");
  });

  it("shows what is saved in the sync centre", () => {
    const page = readFileSync(join(__dirname, "..", "app", "dashboard", "sync-center", "page.tsx"), "utf8");
    expect(page).toContain("offlineDB.getCacheSummary()");
    expect(page).toContain("On this phone");
  });
});

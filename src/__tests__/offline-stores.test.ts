/**
 * Every table the app caches offline must have an IndexedDB object store.
 *
 * A missing store does not fail loudly. The transaction simply throws
 * "NotFoundError: Failed to execute 'transaction' on 'IDBDatabase'", the read
 * is swallowed, and the cache is permanently empty for that table -- so the
 * feature quietly stops working offline, which is exactly where it matters.
 *
 * Six tables were in this state: academic_terms, homework, homework_submissions,
 * dorms, dorm_students and dorm_attendance. The academic term is the worst of
 * them: without it the app cannot tell which term it is in while offline.
 *
 * This compares the store list against every table referenced against the
 * offline cache, so adding a cached table without a store fails the build
 * rather than the field.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { readdirSync, statSync } from "fs";

const ROOT = process.cwd();
const offlineSrc = readFileSync(join(ROOT, "src/lib/offline.ts"), "utf8");

function listFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) listFiles(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe("offline cache stores cover every cached table", () => {
  const start = offlineSrc.indexOf("const stores = [");
  const stores = new Set(
    Array.from(
      offlineSrc
        .slice(start, offlineSrc.indexOf("];", start))
        .matchAll(/"([a-z_]+)"/g),
    ).map((m) => m[1]),
  );

  it("defines a store list", () => {
    expect(stores.size).toBeGreaterThan(20);
  });

  it("has a store for every table read through the offline cache", () => {
    const used = new Map<string, string[]>();
    for (const file of listFiles(join(ROOT, "src"))) {
      if (file.includes("__tests__")) continue;
      const text = readFileSync(file, "utf8");
      const patterns = [
        /offlineDB\.\w+\(\s*"([a-z_]+)"/g,
        /cacheFromServer\(\s*"([a-z_]+)"/g,
      ];
      for (const re of patterns) {
        for (const m of text.matchAll(re)) {
          if (!used.has(m[1])) used.set(m[1], []);
          used.get(m[1])!.push(file.replace(ROOT + "/", ""));
        }
      }
    }

    const missing = [...used.entries()]
      .filter(([table]) => !stores.has(table))
      .map(([table, files]) => `${table} (${[...new Set(files)].slice(0, 2).join(", ")})`);

    expect(missing).toEqual([]);
  });

  it("has a store for the academic term", () => {
    // The one whose absence leaves the app unable to say what term it is in
    // while offline.
    expect(stores.has("academic_terms")).toBe(true);
  });

  it("bumps the database version when a store is added", () => {
    // A new store is only created for existing browsers when the version
    // rises, so a store added without a version bump would never appear for
    // anyone who already has the app installed.
    const version = Number(offlineSrc.match(/const DB_VERSION = (\d+)/)?.[1] ?? 0);
    expect(version).toBeGreaterThanOrEqual(11);
  });
});
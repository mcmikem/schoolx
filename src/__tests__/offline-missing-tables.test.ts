import fs from "node:fs";
import path from "node:path";

// `timetable` was replaced by `timetable_slots`, but three refresh lists still
// name it — including the one that runs on every successful sign-in — so the
// console showed a 404 for a table that will never come back, and refreshAll
// recorded it as a sync failure. The refresh path now asks once, believes the
// answer, and moves on.
describe("refreshAll never asks twice for a table the schema dropped", () => {
  const src = fs.readFileSync(path.join(process.cwd(), "src/lib/offline.ts"), "utf8");
  const refresh = src.slice(src.indexOf("async refreshAll"), src.indexOf("async resolveConflicts"));

  it("recognises PostgREST's missing-table answer", () => {
    expect(src).toContain('const MISSING_TABLE_CODE = "PGRST205"');
    expect(refresh).toContain("error.code === MISSING_TABLE_CODE");
  });

  it("remembers the miss instead of failing every sync after it", () => {
    expect(refresh).toContain("if (missingTables.has(table)) continue;");
    expect(refresh).toContain("missingTables.add(table)");
  });

  it("skips before the request and never reports it as a sync error", () => {
    const guardAt = refresh.indexOf("if (missingTables.has(table)) continue;");
    const fetchAt = refresh.indexOf("supabase.from(table)");
    const pushAt = refresh.indexOf("errors.push(msg)");
    expect(guardAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(fetchAt);
    // The "add it to the set" branch continues out of the loop, so the catch
    // that pushes onto errors[] never sees a missing table.
    const addAt = refresh.indexOf("missingTables.add(table)");
    expect(refresh.slice(addAt, addAt + 60)).toContain("continue;");
    expect(fetchAt).toBeLessThan(pushAt);
  });

  it("seeds the renamed table so the first sync of a page load is silent too", () => {
    expect(src).toMatch(/new Set<string>\(\["timetable"\]\)/);
  });

  it("the default refresh list no longer names it", () => {
    const sync = fs.readFileSync(path.join(process.cwd(), "src/lib/useSyncStatus.ts"), "utf8");
    const start = sync.indexOf("const tablesToSync");
    expect(start).toBeGreaterThan(-1);
    const block = sync.slice(start, sync.indexOf("];", start));
    expect(block).not.toContain('"timetable"');
  });
});

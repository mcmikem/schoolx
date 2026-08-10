import {
  SYNC_VALID_TABLES,
  SYNC_VALID_ACTIONS,
  SYNC_MAX_ITEMS,
  validateSyncItem,
  isValidSyncTable,
  isValidSyncAction,
  isValidSyncData,
} from "../lib/server/sync-validation";

describe("Sync API Validation", () => {
  describe("Sync Item Validation", () => {
    test("validates sync items structure", () => {
      const item = { id: "1", table: "students", action: "create", data: { name: "John" } };
      expect(validateSyncItem(item)).toHaveLength(0);
    });

    test("rejects incomplete sync items", () => {
      expect(validateSyncItem({} as never)).toHaveLength(4);
      expect(validateSyncItem({ id: "1" } as never)).toHaveLength(3);
    });

    test("every declared table is valid", () => {
      for (const table of SYNC_VALID_TABLES) {
        expect(isValidSyncTable(table)).toBe(true);
      }
    });

    test("rejects table names not in the allowlist", () => {
      expect(isValidSyncTable("students")).toBe(true);
      expect(isValidSyncTable("users")).toBe(false);
      expect(isValidSyncTable("invalid_table")).toBe(false);
    });

    test("every declared action is valid", () => {
      for (const action of SYNC_VALID_ACTIONS) {
        expect(isValidSyncAction(action)).toBe(true);
      }
    });

    test("rejects unknown actions", () => {
      expect(isValidSyncAction("drop")).toBe(false);
      expect(isValidSyncAction("rename")).toBe(false);
    });

    test("enforces max items limit constant", () => {
      expect(SYNC_MAX_ITEMS).toBeGreaterThan(0);
      expect(SYNC_MAX_ITEMS).toBe(100);
    });

    test("validates data must be a plain object", () => {
      expect(isValidSyncData({ name: "John" })).toBe(true);
      expect(isValidSyncData([])).toBe(false);
      expect(isValidSyncData("string")).toBe(false);
      expect(isValidSyncData(null)).toBe(false);
    });

    test("prevents SQL injection in table names via allowlist", () => {
      const maliciousTable = "students; DROP TABLE users--";
      expect(isValidSyncTable(maliciousTable)).toBe(false);
    });
  });
});
